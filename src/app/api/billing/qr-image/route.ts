import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/session';
import { getQrConfig } from '@/lib/billing/qr-checkout';
import { privateAssetResponse } from '@/lib/storage/supabase-assets';

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Sila log masuk.' }, { status: 401 });
  const config = await getQrConfig();
  if (!config.enabled || !config.recipientConfirmed || !config.qrObjectKey) return NextResponse.json({ error: 'QR pembayaran tidak tersedia.' }, { status: 404 });
  const stored = await privateAssetResponse(config.qrObjectKey);
  if (!stored.ok || !stored.body) return NextResponse.json({ error: 'QR pembayaran tidak dapat dibaca.' }, { status: 503 });
  const headers = new Headers({ 'Content-Type': stored.headers.get('content-type') || 'image/png', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
  if (new URL(req.url).searchParams.get('download') === '1') headers.set('Content-Disposition', 'attachment; filename="AffiMatik-DuitNow-QR.png"');
  return new Response(stored.body, { status: 200, headers });
}
