export class MediaDownloadError extends Error {}

/**
 * Downloads only a verified MP4 response. This prevents Safari and other
 * browsers from saving an authentication/error JSON body with an .mp4 name.
 */
export async function downloadPrivateMp4(url: string, filename: string): Promise<void> {
  const target = new URL(url, window.location.origin);
  target.searchParams.set('download', '1');
  const response = await fetch(target.toString(), { credentials: 'include', cache: 'no-store' });
  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  if (!response.ok || !contentType.startsWith('video/mp4')) {
    let message = 'Video tidak dapat dimuat turun. Sila muat semula dan cuba lagi.';
    if (contentType.includes('application/json')) {
      const body = await response.json().catch(() => null) as { error?: string } | null;
      if (body?.error) message = body.error;
    }
    throw new MediaDownloadError(message);
  }
  const blob = await response.blob();
  if (blob.size < 1024 || !blob.type.toLowerCase().startsWith('video/mp4')) {
    throw new MediaDownloadError('Fail yang diterima bukan video MP4 yang sah. Sila cuba semula.');
  }
  const objectUrl = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename.endsWith('.mp4') ? filename : `${filename}.mp4`;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
  }
}
