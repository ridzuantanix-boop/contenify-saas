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

  it('generates presigned download URL for stored outputs', async () => {
    const downloadUrl = await storage.createPresignedDownloadUrl(
      'workspaces/ws_123/outputs/video_final.mp4'
    );
    expect(downloadUrl).toContain('test-r2.contenify.internal');
  });
});
