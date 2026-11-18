const TARGET_UPLOAD_BYTES = 1200 * 1024;

export type UploadImageRole = 'product' | 'avatar' | 'background';

/**
 * Compresses only the browser upload copy. The source file on the customer's
 * device is never modified. JPEG is used because it is consistently supported
 * by iPhone Safari canvas, unlike WebP encoding on some Safari versions.
 */
export async function prepareImageUpload(file: File, role: UploadImageRole): Promise<File> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Imej mesti dalam format JPEG, PNG atau WebP.');
  if (file.size <= TARGET_UPLOAD_BYTES) return file;

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('Imej tidak dapat dibaca untuk pengoptimuman.'));
      element.src = objectUrl;
    });
    const maxEdge = role === 'product' ? 1600 : 1280;
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    if (!sourceWidth || !sourceHeight || sourceWidth * sourceHeight > 50_000_000) throw new Error('Resolusi imej terlalu besar. Pilih imej di bawah 50 megapiksel.');

    let scale = Math.min(1, maxEdge / Math.max(sourceWidth, sourceHeight));
    let latest: Blob | null = null;
    for (let pass = 0; pass < 4; pass++) {
      const width = Math.max(1, Math.round(sourceWidth * scale));
      const height = Math.max(1, Math.round(sourceHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d', { alpha: false });
      if (!context) throw new Error('Pelayar tidak menyokong pemprosesan imej.');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      for (const quality of [0.9, 0.82, 0.74, 0.66]) {
        latest = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
        if (latest && latest.size <= TARGET_UPLOAD_BYTES) break;
      }
      if (latest && latest.size <= TARGET_UPLOAD_BYTES) break;
      scale *= 0.78;
    }
    if (!latest || latest.size > 1536 * 1024) throw new Error('Imej masih terlalu besar selepas dioptimumkan. Sila pilih imej lain.');
    const baseName = file.name.replace(/\.[^.]+$/, '').slice(0, 90) || role;
    return new File([latest], `${baseName}-affimatik.jpg`, { type: 'image/jpeg', lastModified: file.lastModified });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
