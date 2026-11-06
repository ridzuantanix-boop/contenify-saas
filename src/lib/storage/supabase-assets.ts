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

export async function ingestProviderMp4(provider: 'nexabot' | 'runninghub' | 'mock', sourceUrl: string, workspaceId: string, jobId: string): Promise<{ objectKey: string; sizeBytes: number }> {
  // Historical Nexabot outputs were stored in the former AffiMatik public
  // Supabase project. Keep that exact host for verified recovery only.
  const allowed = provider === 'nexabot' ? ['nexabot.id', 'hrekuraxzpiqymgcrjyb.supabase.co'] : provider === 'runninghub' ? ['runninghub.ai'] : [];
  const extra = (process.env.PROVIDER_MEDIA_HOSTS || '').split(',').map((host) => host.trim().toLowerCase()).filter(Boolean);
  let current = new URL(sourceUrl);
  let response: Response | null = null;
  for (let redirect = 0; redirect < 3; redirect++) {
    const hostname = current.hostname.toLowerCase();
    if (current.protocol !== 'https:' || current.username || current.password || ![...allowed, ...extra].some((host) => hostname === host || hostname.endsWith(`.${host}`))) {
      throw new Error('Domain sumber video tidak dibenarkan.');
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
  const magic = new TextDecoder().decode(new Uint8Array(bytes.slice(4, 8)));
  if (magic !== 'ftyp') throw new Error('Fail pembekal bukan MP4 yang sah.');
  const objectKey = `workspaces/${workspaceId}/outputs/${jobId}.mp4`;
  await uploadPrivateAsset(objectKey, bytes, 'video/mp4', true);
  return { objectKey, sizeBytes: bytes.byteLength };
}
