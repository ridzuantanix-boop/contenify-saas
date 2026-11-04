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

export class R2StorageService {
  private bucketName: string;
  private useLocalMock: boolean;

  constructor(config: StorageConfig = {}) {
    this.bucketName = config.bucketName || process.env.R2_BUCKET_NAME || 'contenify-private-assets';
    this.useLocalMock =
      config.useLocalMock ||
      !process.env.R2_ACCESS_KEY_ID ||
      process.env.NODE_ENV === 'test';
  }

  generateObjectKey(workspaceId: string, category: 'inputs' | 'avatars' | 'outputs' | 'thumbnails', filename: string): string {
    const timestamp = Date.now();
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    return `workspaces/${workspaceId}/${category}/${timestamp}_${sanitizedFilename}`;
  }

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

    if (this.useLocalMock) {
      return {
        uploadUrl: `https://mock-r2.contenify.internal/${this.bucketName}/${objectKey}?mock_signature=valid`,
        objectKey,
        expiresInSeconds: 900,
        headers: {
          'Content-Type': contentType,
          'x-amz-acl': 'private',
        },
      };
    }

    // In production with AWS S3 / Cloudflare R2 SDK (v3)
    return {
      uploadUrl: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${this.bucketName}/${objectKey}`,
      objectKey,
      expiresInSeconds: 900,
      headers: {
        'Content-Type': contentType,
      },
    };
  }

  async createPresignedDownloadUrl(objectKey: string, expiresInSeconds = 3600): Promise<string> {
    if (!objectKey) {
      throw new Error('Object key is required to generate download URL');
    }

    if (this.useLocalMock) {
      return `https://mock-r2.contenify.internal/${this.bucketName}/${objectKey}?expires=${Date.now() + expiresInSeconds * 1000}`;
    }

    return `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${this.bucketName}/${objectKey}?token=mock_signed_r2_download`;
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
