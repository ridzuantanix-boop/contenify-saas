import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/session';
import { DurableStore } from '@/lib/db/store';
import { affiliateRpc } from '@/lib/db/affiliate-ledger';
import { validateAffiliateUsername } from '@/lib/affiliate/partner-policy';


export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Sila log masuk.' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  if (body.acceptTerms !== true) {
    return NextResponse.json({ error: 'Sila terima terma program affiliate secara jelas.' }, { status: 400 });
  }

  const username = validateAffiliateUsername(body.username);
  if (!username.valid) return NextResponse.json({ error: username.error }, { status: 400 });

  try {
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const result = await affiliateRpc('apply_affiliate_partner_v1', {
        p_user_id: session.userId,
        p_username: username.normalized,
        p_accept_terms: true,
      });
      if (result.success !== true) {
        const messages: Record<string, string> = {
          QUALIFYING_SUBSCRIPTION_REQUIRED: 'Langganan berbayar yang telah disahkan diperlukan sebelum anda boleh memohon.',
          USERNAME_TAKEN: 'Username affiliate ini telah ditempah oleh pengguna lain.',
          RESERVED_USERNAME: 'Username ini dikhaskan atau boleh mengelirukan pengguna.',
          INVALID_USERNAME: 'Format username affiliate tidak sah.',
          TERMS_REQUIRED: 'Sila terima terma program affiliate.',
        };
        return NextResponse.json({ error: messages[String(result.error)] || 'Permohonan tidak dapat diproses.' }, { status: 409 });
      }
      return NextResponse.json({ status: result.status, username: result.username }, { status: result.existing ? 200 : 201 });
    }
    const existing = await DurableStore.getAffiliatePartner(session.userId);
    if (existing) return NextResponse.json({ status: existing.status }, { status: 200 });
    const code = `AF${crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`;
    await DurableStore.createAffiliatePartner(session.userId, code);
    return NextResponse.json({ status: 'PENDING', username: username.normalized }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Permohonan tidak dapat disimpan. Sila cuba semula.' }, { status: 503 });
  }
}
