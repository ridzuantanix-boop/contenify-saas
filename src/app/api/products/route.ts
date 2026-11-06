import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/session';
import { deletePrivateAsset, signPrivateAsset, uploadPrivateAsset } from '@/lib/storage/supabase-assets';


function dbHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key || !process.env.SUPABASE_URL) throw new Error('Pangkalan data tidak dikonfigurasi.');
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Sila log masuk.' }, { status: 401 });
  try {
    const url = `${process.env.SUPABASE_URL}/rest/v1/product_images?workspace_id=eq.${encodeURIComponent(session.workspaceId)}&select=id,product_id,r2_key,original_filename,mime_type,size_bytes,created_at,products(name,category,description)&order=created_at.desc&limit=100`;
    const res = await fetch(url, { headers: dbHeaders() });
    if (!res.ok) throw new Error(`DB HTTP ${res.status}`);
    const rows = await res.json() as Array<Record<string, unknown>>;
    const assets = await Promise.all(rows.map(async (row) => ({
      id: row.id,
      productId: row.product_id,
      name: (row.products as { name?: string } | null)?.name || 'Produk tanpa nama',
      category: (row.products as { category?: string } | null)?.category || '',
      notes: (row.products as { description?: string } | null)?.description || '',
      filename: row.original_filename,
      createdAt: row.created_at,
      imageUrl: await signPrivateAsset(String(row.r2_key), 900),
    })));
    return NextResponse.json({ assets });
  } catch {
    return NextResponse.json({ error: 'Pustaka produk tidak tersedia.' }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Sila log masuk.' }, { status: 401 });
  try {
    const form = await req.formData();
    const file = form.get('image');
    if (!(file instanceof File) || file.size === 0 || file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: 'Imej mesti bersaiz 1 bait hingga 15 MB.' }, { status: 400 });
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      return NextResponse.json({ error: 'Hanya JPEG, PNG dan WebP dibenarkan.' }, { status: 400 });
    }
    const bytes = await file.arrayBuffer();
    const head = new Uint8Array(bytes.slice(0, 12));
    const isJpeg = file.type === 'image/jpeg' && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
    const isPng = file.type === 'image/png' && [137,80,78,71,13,10,26,10].every((value, index) => head[index] === value);
    const isWebp = file.type === 'image/webp' && new TextDecoder().decode(head.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(head.slice(8, 12)) === 'WEBP';
    if (!isJpeg && !isPng && !isWebp) return NextResponse.json({ error: 'Kandungan fail tidak sepadan dengan format imej.' }, { status: 400 });

    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const checksum = Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, '0')).join('');
    const headers = dbHeaders();
    const duplicateUrl = `${process.env.SUPABASE_URL}/rest/v1/product_images?workspace_id=eq.${encodeURIComponent(session.workspaceId)}&sha256_checksum=eq.${checksum}&select=id,product_id,r2_key&limit=1`;
    const duplicateRes = await fetch(duplicateUrl, { headers });
    if (!duplicateRes.ok) throw new Error('Semakan imej berulang gagal.');
    const duplicates = await duplicateRes.json() as Array<{ id: string; product_id: string; r2_key: string }>;
    if (duplicates.length) {
      return NextResponse.json({ assetId: duplicates[0].id, productId: duplicates[0].product_id, imageUrl: await signPrivateAsset(duplicates[0].r2_key), reused: true });
    }

    const productId = crypto.randomUUID();
    const assetId = crypto.randomUUID();
    const name = String(form.get('name') || '').trim().slice(0, 255) || 'Produk tanpa nama';
    const category = String(form.get('category') || '').trim().slice(0, 100) || null;
    const notes = String(form.get('notes') || '').trim().slice(0, 2000) || null;
    const path = `workspaces/${session.workspaceId}/inputs/${assetId}.${file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'}`;
    await uploadPrivateAsset(path, bytes, file.type);

    const registered = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/register_product_image_atomic`, {
      method: 'POST', headers,
      body: JSON.stringify({ p_workspace_id: session.workspaceId, p_product_id: productId, p_image_id: assetId,
        p_name: name, p_category: category, p_notes: notes, p_object_key: path,
        p_filename: file.name.slice(0, 255), p_mime_type: file.type, p_size: file.size, p_checksum: checksum }),
    });
    if (!registered.ok) { await deletePrivateAsset(path); throw new Error(`Rekod imej tidak dapat disimpan (HTTP ${registered.status}).`); }
    const asset = await registered.json() as { asset_id: string; product_id: string; object_key: string; reused: boolean };
    if (asset.reused) await deletePrivateAsset(path);
    return NextResponse.json({ assetId: asset.asset_id, productId: asset.product_id, imageUrl: await signPrivateAsset(asset.object_key), reused: asset.reused }, { status: asset.reused ? 200 : 201 });
  } catch {
    return NextResponse.json({ error: 'Imej tidak dapat disimpan. Sila cuba semula.' }, { status: 503 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Sila log masuk.' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (typeof body.productId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.productId) || typeof body.name !== 'string' || !body.name.trim() || body.name.length > 255 ||
      typeof body.category !== 'string' || body.category.length > 100 || typeof body.notes !== 'string' || body.notes.length > 2000) {
    return NextResponse.json({ error: 'Maklumat produk tidak sah.' }, { status: 400 });
  }
  try {
    const result = await fetch(`${process.env.SUPABASE_URL}/rest/v1/products?id=eq.${encodeURIComponent(body.productId)}&workspace_id=eq.${encodeURIComponent(session.workspaceId)}`, {
      method: 'PATCH', headers: { ...dbHeaders(), Prefer: 'return=representation' },
      body: JSON.stringify({ name: body.name.trim(), category: body.category.trim() || null, description: body.notes.trim() || null, updated_at: new Date().toISOString() }),
    });
    if (!result.ok) throw new Error('DB update failed');
    const rows = await result.json() as unknown[];
    if (!rows.length) return NextResponse.json({ error: 'Produk tidak ditemui.' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch { return NextResponse.json({ error: 'Produk tidak dapat dikemas kini.' }, { status: 503 }); }
}
