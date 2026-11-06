import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';

const SAMPLE_IDS = new Set(['NX01', 'NX02', 'NX03', 'NX05', 'NX07', 'NX09', 'NX10']);

async function sampleResponse(req: NextRequest, context: { params: Promise<{ id: string }> }, head = false) {
  const { id } = await context.params;
  if (!SAMPLE_IDS.has(id)) return NextResponse.json({ error: 'Sampel tidak ditemui.' }, { status: 404 });
  const path = `/style-previews/${id}/sample-v2.mp4`;
  let source: Response;
  try {
    const { env } = await getCloudflareContext({ async: true });
    source = env.ASSETS
      ? await env.ASSETS.fetch(new URL(path, req.url).toString())
      : await fetch(new URL(path, req.url));
  } catch {
    // Local Next.js preview has no Cloudflare binding.
    source = await fetch(new URL(path, req.url));
  }
  if (!source.ok) return NextResponse.json({ error: 'Sampel tidak tersedia.' }, { status: 503 });
  const bytes = await source.arrayBuffer();
  const size = bytes.byteLength;
  const headers = new Headers({
    'Content-Type': 'video/mp4',
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=86400',
    'X-Content-Type-Options': 'nosniff',
  });
  const requested = req.headers.get('range');
  if (requested) {
    const parts = /^bytes=(\d*)-(\d*)$/.exec(requested);
    let start = parts?.[1] ? Number(parts[1]) : NaN;
    let end = parts?.[2] ? Number(parts[2]) : size - 1;
    if (parts && !parts[1] && parts[2]) {
      start = Math.max(0, size - Number(parts[2]));
      end = size - 1;
    }
    if (!parts || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) ||
        start < 0 || start >= size || end < start) {
      headers.set('Content-Range', `bytes */${size}`);
      return new Response(null, { status: 416, headers });
    }
    end = Math.min(end, size - 1);
    headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
    headers.set('Content-Length', String(end - start + 1));
    return new Response(head ? null : bytes.slice(start, end + 1), { status: 206, headers });
  }
  headers.set('Content-Length', String(size));
  return new Response(head ? null : bytes, { status: 200, headers });
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return sampleResponse(req, context);
}

export async function HEAD(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return sampleResponse(req, context, true);
}
