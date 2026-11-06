import { NextRequest, NextResponse } from 'next/server';
import { DurableStore } from '@/lib/db/store';
import { affiliateDb } from '@/lib/db/affiliate-ledger';


export async function GET(req: NextRequest) {
  const code = new URL(req.url).searchParams.get('code')?.trim().toUpperCase();
  const campaign = new URL(req.url).searchParams.get('campaign')?.trim().slice(0, 64) || null;
  if (!code || !/^[A-Z0-9_-]{4,50}$/.test(code)) return NextResponse.json({ valid: false }, { status: 400 });
  try {
    const partner = await DurableStore.getAffiliatePartner(code);
    if (!partner || partner.status !== 'APPROVED') return NextResponse.json({ valid: false }, { status: 404 });
    if (req.cookies.get('affimatik_ref')?.value !== code) {
      const { base, headers } = affiliateDb();
      const source = `${req.headers.get('cf-connecting-ip') || ''}|${req.headers.get('user-agent') || ''}|${new Date().toISOString().slice(0, 10)}`;
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source)))).map((byte) => byte.toString(16).padStart(2, '0')).join('');
      const event = await fetch(`${base}/rest/v1/affiliate_referral_events`, { method: 'POST', headers, body: JSON.stringify({ affiliate_id: partner.id, event_type: 'CLICK', visitor_hash: hash, campaign }) });
      if (!event.ok) throw new Error('Referral event failed');
    }
    const response = NextResponse.json({ valid: true });
    response.cookies.set('affimatik_ref', code, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 30 * 24 * 60 * 60 });
    return response;
  } catch { return NextResponse.json({ valid: false }, { status: 503 }); }
}
