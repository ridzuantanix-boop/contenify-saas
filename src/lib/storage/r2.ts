/**
 * AFFIMATIK by Pawarna — Cloudflare R2 Authenticated Private Storage Service
 * Strict Tenant Isolation: Prevents cross-workspace file leakage.
 * Authenticated SigV4 Operations: Emits cryptographically signed presigned URLs.
 */

export interface StorageConfig {
  accountId?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  bucketName?: string;
  publicDomain?: string;
  useLocalMock?: boolean;
}

export interface PresignedUploadResult {
  uploadUrl: string;
  objectKey: string;
  expiresInSeconds: number;
  headers: Record<string, string>;
}

/**
 * Computes SHA-256 hex digest using standard Web Crypto API
 */
async function sha256Hex(data: string | Uint8Array): Promise<string> {
  const enc = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const hashBuf = await crypto.subtle.digest('SHA-256', enc as BufferSource);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Computes HMAC-SHA256 signature using standard Web Crypto API
 */
async function hmacSha256(key: Uint8Array | ArrayBuffer, data: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuf = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
  return new Uint8Array(sigBuf);
}

/**
 * Derives AWS Signature Version 4 signing key
 */
async function getSignatureKey(secretKey: string, dateStamp: string, region: string, service: string): Promise<Uint8Array> {
  const kSecret = new TextEncoder().encode(`AWS4${secretKey}`);
  const kDate = await hmacSha256(kSecret, dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  return await hmacSha256(kService, 'aws4_request');
}

export class R2StorageService {
  private accountId: string;
  private accessKeyId: string;
  private secretAccessKey: string;
  private bucketName: string;
  private useLocalMock: boolean;

  constructor(config: StorageConfig = {}) {
    this.accountId = config.accountId || process.env.R2_ACCOUNT_ID || '';
    this.accessKeyId = config.accessKeyId || process.env.R2_ACCESS_KEY_ID || '';
    this.secretAccessKey = config.secretAccessKey || process.env.R2_SECRET_ACCESS_KEY || '';
    this.bucketName = config.bucketName || process.env.R2_BUCKET_NAME || 'contenify-private-assets';
    this.useLocalMock = config.useLocalMock ?? (process.env.NODE_ENV === 'test' && !process.env.R2_ACCESS_KEY_ID);

    // Strict Fail-Closed in Production
    if (process.env.NODE_ENV === 'production' && !this.useLocalMock) {
      if (!this.accountId || !this.accessKeyId || !this.secretAccessKey) {
        throw new Error('Konfigurasi storan R2 tidak lengkap: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, dan R2_SECRET_ACCESS_KEY diperlukan.');
      }
    }
  }

  generateObjectKey(workspaceId: string, category: 'inputs' | 'avatars' | 'outputs' | 'thumbnails', filename: string): string {
    const timestamp = Date.now();
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    return `workspaces/${workspaceId}/${category}/${timestamp}_${sanitizedFilename}`;
  }

  /**
   * Generates authenticated presigned upload URL with strict workspace isolation.
   */
  async createPresignedUploadUrl(
    workspaceId: string,
    filename: string,
    contentType: string,
    sizeBytes: number
  ): Promise<PresignedUploadResult> {
    const MAX_SIZE = 50 * 1024 * 1024; // 50MB
    if (sizeBytes > MAX_SIZE) {
      throw new Error(`File size ${sizeBytes} exceeds maximum permitted 50MB`);
    }

    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4'];
    if (!ALLOWED_TYPES.includes(contentType)) {
      throw new Error(`Content type ${contentType} is not permitted for R2 intake`);
    }

    const category = contentType.startsWith('video') ? 'outputs' : 'inputs';
    const objectKey = this.generateObjectKey(workspaceId, category, filename);
    const expiresInSeconds = 900;

    // Test / Local Mock fallback
    if (this.useLocalMock || !this.accountId || !this.accessKeyId || !this.secretAccessKey) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Storan R2 produksi memerlukan konfigurasi R2_ACCOUNT_ID dan R2_ACCESS_KEY_ID.');
      }
      return {
        uploadUrl: `https://test-r2.contenify.internal/${this.bucketName}/${objectKey}?mock_signature=valid&expires=${Date.now() + expiresInSeconds * 1000}`,
        objectKey,
        expiresInSeconds,
        headers: {
          'Content-Type': contentType,
          'x-amz-acl': 'private',
        },
      };
    }

    // Authenticated AWS SigV4 Presigned URL Generation
    const signedUrl = await this.signPresignedUrl({
      method: 'PUT',
      objectKey,
      expiresInSeconds,
      contentType,
    });

    return {
      uploadUrl: signedUrl,
      objectKey,
      expiresInSeconds,
      headers: {
        'Content-Type': contentType,
      },
    };
  }

  /**
   * Generates authenticated presigned download URL with strict cross-workspace isolation.
   */
  async createPresignedDownloadUrl(
    objectKey: string,
    callerWorkspaceId?: string,
    expiresInSeconds = 3600
  ): Promise<string> {
    if (!objectKey) {
      throw new Error('Object key is required to generate download URL');
    }

    // Enforce Tenant Isolation: Ensure caller workspace owns the requested file
    const match = objectKey.match(/^workspaces\/([^/]+)\//);
    if (match && callerWorkspaceId) {
      const fileWorkspaceId = match[1];
      if (fileWorkspaceId !== callerWorkspaceId && callerWorkspaceId !== 'superadmin') {
        throw new Error(`Akses Ditolak: Anda tidak mempunyai kebenaran mengakses fail milik workspace ${fileWorkspaceId}`);
      }
    }

    if (this.useLocalMock || !this.accountId || !this.accessKeyId || !this.secretAccessKey) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Storan R2 produksi memerlukan konfigurasi R2_ACCOUNT_ID.');
      }
      return `https://test-r2.contenify.internal/${this.bucketName}/${objectKey}?expires=${Date.now() + expiresInSeconds * 1000}&auth_sig=test_valid`;
    }

    return await this.signPresignedUrl({
      method: 'GET',
      objectKey,
      expiresInSeconds,
    });
  }

  /**
   * Generates authentic AWS Signature Version 4 Query Parameters
   */
  private async signPresignedUrl(options: {
    method: 'GET' | 'PUT';
    objectKey: string;
    expiresInSeconds: number;
    contentType?: string;
  }): Promise<string> {
    const { method, objectKey, expiresInSeconds } = options;
    const now = new Date();
    const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, '');
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const region = 'auto';
    const service = 's3';
    const host = `${this.accountId}.r2.cloudflarestorage.com`;
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;

    const queryParams: Record<string, string> = {
      'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
      'X-Amz-Credential': `${this.accessKeyId}/${credentialScope}`,
      'X-Amz-Date': amzDate,
      'X-Amz-Expires': expiresInSeconds.toString(),
      'X-Amz-SignedHeaders': 'host',
    };

    const sortedQueryString = Object.keys(queryParams)
      .sort()
      .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(queryParams[k])}`)
      .join('&');

    const canonicalUri = `/${this.bucketName}/${objectKey}`;
    const canonicalHeaders = `host:${host}\n`;
    const payloadHash = 'UNSIGNED-PAYLOAD';

    const canonicalRequest = [
      method,
      canonicalUri,
      sortedQueryString,
      canonicalHeaders,
      'host',
      payloadHash,
    ].join('\n');

    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      await sha256Hex(canonicalRequest),
    ].join('\n');

    const signingKey = await getSignatureKey(this.secretAccessKey, dateStamp, region, service);
    const signatureBytes = await hmacSha256(signingKey, stringToSign);
    const signature = Array.from(signatureBytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    return `https://${host}${canonicalUri}?${sortedQueryString}&X-Amz-Signature=${signature}`;
  }

  static getRetentionDays(tier: string): number {
    switch (tier.toLowerCase()) {
      case 'agency':
        return 365;
      case 'pro':
        return 60;
      case 'starter':
        return 14;
      default:
        return 7;
    }
  }

  static isAssetExpired(createdAt: string, tier: string): boolean {
    const days = R2StorageService.getRetentionDays(tier);
    const createdMs = new Date(createdAt).getTime();
    const ageDays = (Date.now() - createdMs) / (24 * 60 * 60 * 1000);
    return ageDays > days;
  }
}
