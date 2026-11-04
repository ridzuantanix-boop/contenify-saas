import { describe, it, expect } from 'vitest';
import { R2StorageService } from '../src/lib/storage/r2';

describe('R2 Storage Service', () => {
  const storage = new R2StorageService({ useLocalMock: true });

  it('generates presigned upload URL for valid image', async () => {
    const result = await storage.createPresignedUploadUrl(
      'ws_123',
      'product_screenshot.png',
      'image/png',
      1024 * 1024
    );

    expect(result.uploadUrl).toBeDefined();
    expect(result.objectKey).toContain('workspaces/ws_123/inputs/');
    expect(result.headers['Content-Type']).toBe('image/png');
  });

  it('rejects uploads exceeding 50MB', async () => {
    await expect(
      storage.createPresignedUploadUrl(
        'ws_123',
        'huge_file.mp4',
        'video/mp4',
        60 * 1024 * 1024 // 60MB
      )
    ).rejects.toThrow(/exceeds maximum permitted 50MB/);
  });

  it('rejects disallowed file types', async () => {
    await expect(
      storage.createPresignedUploadUrl(
        'ws_123',
        'malicious.exe',
        'application/octet-stream',
        1024
      )
    ).rejects.toThrow(/Content type .* is not permitted/);
  });

  it('generates presigned download URL for stored outputs with caller workspace', async () => {
    const downloadUrl = await storage.createPresignedDownloadUrl(
      'workspaces/ws_123/outputs/video_final.mp4',
      'ws_123'
    );
    expect(downloadUrl).toContain('test-r2.contenify.internal');
  });

  it('enforces strict tenant isolation and prevents cross-workspace file access', async () => {
    // Customer in ws_attacker tries to access ws_victim file
    await expect(
      storage.createPresignedDownloadUrl(
        'workspaces/ws_victim/outputs/sensitive_campaign.mp4',
        'ws_attacker'
      )
    ).rejects.toThrow(/Akses Ditolak: Anda tidak mempunyai kebenaran mengakses fail milik workspace ws_victim/);
  });

  it('generates genuine AWS SigV4 signed presigned URL when R2 credentials provided', async () => {
    const liveStorage = new R2StorageService({
      accountId: 'test_account_id',
      accessKeyId: 'test_access_key',
      secretAccessKey: 'test_secret_key_12345',
      useLocalMock: false,
    });

    const downloadUrl = await liveStorage.createPresignedDownloadUrl(
      'workspaces/ws_123/outputs/video_final.mp4',
      'ws_123'
    );

    expect(downloadUrl).toContain('test_account_id.r2.cloudflarestorage.com');
    expect(downloadUrl).toContain('X-Amz-Algorithm=AWS4-HMAC-SHA256');
    expect(downloadUrl).toContain('X-Amz-Credential=test_access_key');
    expect(downloadUrl).toContain('X-Amz-Signature=');
  });
});
