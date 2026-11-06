import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/session';
import { DurableStore } from '@/lib/db/store';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Sila log masuk.' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  if (body.acceptTerms !== true) {
    return NextResponse.json({ error: 'Sila terima terma program affiliate secara jelas.' }, { status: 400 });
  }

  try {
    const existing = await DurableStore.getAffiliatePartner(session.userId);
    if (existing) {
      return NextResponse.json({ status: existing.status }, { status: 200 });
    }
    const code = `AF${crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`;
    await DurableStore.createAffiliatePartner(session.userId, code);
    return NextResponse.json({ status: 'PENDING' }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Permohonan tidak dapat disimpan. Sila cuba semula.' }, { status: 503 });
  }
}
