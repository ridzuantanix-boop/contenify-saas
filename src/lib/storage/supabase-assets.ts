const BUCKET = 'affimatik-assets';

function configuration() {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error('Storan Supabase tidak dikonfigurasi.');
  return { base: base.replace(/\/$/, ''), key };
}

function encodedPath(path: string) {
  return path.split('/').map(encodeURIComponent).join('/');
}

export async function uploadPrivateAsset(path: string, bytes: ArrayBuffer, contentType: string, allowExisting = false): Promise<void> {
  const { base, key } = configuration();
  const response = await fetch(`${base}/storage/v1/object/${BUCKET}/${encodedPath(path)}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': contentType, 'x-upsert': 'false' },
    body: bytes,
  });
  if (!response.ok) {
    const duplicate = allowExisting && (response.status === 409 || (response.status === 400 && (await response.text()).includes('ResourceAlreadyExists')));
    if (!duplicate) throw new Error(`Muat naik storan gagal (HTTP ${response.status}).`);
  }
}

export async function deletePrivateAsset(path: string): Promise<void> {
  const { base, key } = configuration();
  const response = await fetch(`${base}/storage/v1/object/${BUCKET}/${encodedPath(path)}`, {
    method: 'DELETE',
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!response.ok && response.status !== 404) throw new Error(`Padam storan gagal (HTTP ${response.status}).`);
}

export async function signPrivateAsset(path: string, expiresIn = 3600): Promise<string> {
  const { base, key } = configuration();
  const response = await fetch(`${base}/storage/v1/object/sign/${BUCKET}/${encodedPath(path)}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresIn }),
  });
  if (!response.ok) throw new Error(`Pautan storan tidak dapat ditandatangani (HTTP ${response.status}).`);
  const data = await response.json() as { signedURL?: string; signedUrl?: string };
  const signed = data.signedURL || data.signedUrl;
  if (!signed) throw new Error('Respons pautan storan tidak sah.');
  if (signed.startsWith('/object/sign/')) return `${base}/storage/v1${signed}`;
  if (signed.startsWith('/storage/v1/object/sign/')) return `${base}${signed}`;
  const absolute = new URL(signed);
  if (absolute.origin !== new URL(base).origin || !absolute.pathname.startsWith('/storage/v1/object/sign/')) {
    throw new Error('Domain pautan storan tidak sah.');
  }
  return absolute.toString();
}

export async function privateAssetResponse(path: string, range?: string): Promise<Response> {
  const { base, key } = configuration();
  return fetch(`${base}/storage/v1/object/authenticated/${BUCKET}/${encodedPath(path)}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, ...(range ? { Range: range } : {}) },
  });
}

export async function privateImageDataUri(path: string, mimeType: string): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) throw new Error('Jenis imej produk tidak sah.');
  const response = await privateAssetResponse(path);
  if (!response.ok) throw new Error('Imej produk tersimpan tidak dapat dibaca.');
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.length || bytes.length > 15 * 1024 * 1024) throw new Error('Saiz imej produk tersimpan tidak sah.');
  const chunks: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    chunks.push(String.fromCharCode(...Array.from(bytes.subarray(offset, offset + 0x8000))));
  }
  return `data:${mimeType};base64,${btoa(chunks.join(''))}`;
}

export function inspectMp4(bytes: ArrayBuffer): { durationSeconds: number; hasVideo: boolean; hasAudio: boolean } {
  const view = new DataView(bytes);
  const decoder = new TextDecoder();
  let durationSeconds = 0;
  let hasVideo = false;
  let hasAudio = false;
  let foundMoov = false;
  const walk = (start: number, end: number, depth: number) => {
    let offset = start;
    while (offset + 8 <= end) {
      let size = view.getUint32(offset);
      const type = decoder.decode(new Uint8Array(bytes, offset + 4, 4));
      let header = 8;
      if (size === 1) { if (offset + 16 > end) break; size = Number(view.getBigUint64(offset + 8)); header = 16; }
      if (size === 0) size = end - offset;
      if (size < header || offset + size > end) break;
      if (type === 'moov') foundMoov = true;
      if (type === 'mvhd' && size >= header + 20) {
        const version = view.getUint8(offset + header);
        const timescaleOffset = offset + header + (version === 1 ? 20 : 12);
        if (timescaleOffset + (version === 1 ? 12 : 8) <= offset + size) {
          const timescale = view.getUint32(timescaleOffset);
          const duration = version === 1 ? Number(view.getBigUint64(timescaleOffset + 4)) : view.getUint32(timescaleOffset + 4);
          if (timescale > 0) durationSeconds = duration / timescale;
        }
      }
      if (type === 'hdlr' && size >= header + 12) {
        const handler = decoder.decode(new Uint8Array(bytes, offset + header + 8, 4));
        if (handler === 'vide') hasVideo = true;
        if (handler === 'soun') hasAudio = true;
      }
      if (depth < 5 && ['moov', 'trak', 'mdia'].includes(type)) walk(offset + header, offset + size, depth + 1);
      offset += size;
    }
  };
  if (bytes.byteLength < 32 || decoder.decode(new Uint8Array(bytes, 4, 4)) !== 'ftyp') throw new Error('Fail pembekal bukan MP4 yang sah.');
  walk(0, bytes.byteLength, 0);
  if (!foundMoov || !hasVideo || !Number.isFinite(durationSeconds) || durationSeconds < 1 || durationSeconds > 120) {
    throw new Error('MP4 pembekal tiada trek video atau metadata tempoh yang sah.');
  }
  return { durationSeconds, hasVideo, hasAudio };
}

export async function ingestProviderMp4(provider: 'nexabot' | 'runninghub' | 'mock', sourceUrl: string, workspaceId: string, jobId: string): Promise<{ objectKey: string; sizeBytes: number; durationSeconds: number; hasAudio: boolean }> {
  // Historical and current Nexabot outputs use these observed Supabase projects.
  // Keep those exact hosts and their media path instead of trusting *.supabase.co.
  const nexabotStorageHosts = [
    'hrekuraxzpiqymgcrjyb.supabase.co',
    'iosrygyeustxztewibzq.supabase.co',
    'gvhsnjldhfczmylcagxe.supabase.co',
  ];
  const allowed = provider === 'nexabot' ? ['nexabot.id', ...nexabotStorageHosts] : provider === 'runninghub' ? ['runninghub.ai', 'runninghub.cn', 'rh-images.xiaoyaoyou.com', 'rh-hk-images-1252422369.cos.ap-hongkong.myqcloud.com'] : [];
  const extra = (process.env.PROVIDER_MEDIA_HOSTS || '').split(',').map((host) => host.trim().toLowerCase()).filter(Boolean);
  let current = new URL(sourceUrl);
  let response: Response | null = null;
  for (let redirect = 0; redirect < 3; redirect++) {
    const hostname = current.hostname.toLowerCase();
    if (current.protocol !== 'https:' || current.username || current.password || ![...allowed, ...extra].some((host) =>
      nexabotStorageHosts.includes(host) ? hostname === host : hostname === host || hostname.endsWith(`.${host}`))) {
      throw new Error('Domain sumber video tidak dibenarkan.');
    }
    if (provider === 'nexabot' && nexabotStorageHosts.includes(hostname) &&
        (!current.pathname.startsWith('/storage/v1/object/public/storage/media/') || !current.pathname.toLowerCase().endsWith('.mp4'))) {
      throw new Error('Laluan sumber video Nexabot tidak dibenarkan.');
    }
    response = await fetch(current, {
      redirect: 'manual',
      headers: provider === 'nexabot' && hostname === 'nexabot.id' && process.env.NEXABOT_API_KEY
        ? { Authorization: `Bearer ${process.env.NEXABOT_API_KEY}` }
        : undefined,
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) break;
    const location = response.headers.get('location');
    if (!location) throw new Error('Arah semula video tidak sah.');
    current = new URL(location, current);
  }
  if (!response?.ok) throw new Error(`Video pembekal tidak dapat dimuat turun (HTTP ${response?.status || 0}).`);
  const advertisedBytes = Number(response.headers.get('content-length') || 0);
  if (advertisedBytes > 40 * 1024 * 1024) throw new Error('Video melebihi had storan 40 MB.');
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength < 32 || bytes.byteLength > 40 * 1024 * 1024) throw new Error('Saiz MP4 tidak sah.');
  const inspected = inspectMp4(bytes);
  const objectKey = `workspaces/${workspaceId}/outputs/${jobId}.mp4`;
  await uploadPrivateAsset(objectKey, bytes, 'video/mp4', true);
  // A successful upload response alone does not prove that the private object
  // can be served. Read it back and compare every byte before settling credits.
  const stored = await privateAssetResponse(objectKey);
  if (!stored.ok || !stored.body) throw new Error('Video tersimpan tidak dapat dibaca semula.');
  const reader = stored.body.getReader();
  const original = new Uint8Array(bytes);
  let readOffset = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (readOffset + value.length > original.length) throw new Error('Saiz video tersimpan tidak sepadan.');
      for (let i = 0; i < value.length; i++) {
        if (value[i] !== original[readOffset + i]) throw new Error('Kandungan video tersimpan tidak sepadan.');
      }
      readOffset += value.length;
    }
  } finally {
    reader.releaseLock();
  }
  if (readOffset !== original.length) throw new Error('Video tersimpan tidak lengkap.');
  return { objectKey, sizeBytes: bytes.byteLength, durationSeconds: inspected.durationSeconds, hasAudio: inspected.hasAudio };
}
