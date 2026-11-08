import { NextRequest, NextResponse } from 'next/server';
const SAMPLE_IDS = new Set(['NX01', 'NX02', 'NX03', 'NX05', 'NX07', 'NX09', 'NX10']);

async function sampleResponse(req: NextRequest, context: { params: Promise<{ id: string }> }, head = false) {
  const { id } = await context.params;
  if (!SAMPLE_IDS.has(id)) return NextResponse.json({ error: 'Sampel tidak ditemui.' }, { status: 404 });
  const path = `/style-previews/${id}/sample-v2.mp4`;
  // Static assets are served by Cloudflare's asset pipeline, outside the
  // OpenNext Worker CPU budget. Redirecting is deliberate: buffering seven
  // multi-megabyte previews in the Worker caused production 1102 errors.
  const response = NextResponse.redirect(new URL(path, req.url), 307);
  response.headers.set('Cache-Control', 'public, max-age=86400');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  if (head) response.headers.set('Content-Length', '0');
  return response;
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return sampleResponse(req, context);
}

export async function HEAD(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return sampleResponse(req, context, true);
}
