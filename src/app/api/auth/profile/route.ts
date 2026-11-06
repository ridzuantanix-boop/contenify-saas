import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/session';


/**
 * GET /api/auth/profile
 * Returns authenticated user profile and subscription details.
 */
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Akses Ditolak: Anda belum log masuk.' }, { status: 401 });
  }

  let fullName = session.fullName;
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const result = await fetch(`${process.env.SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(session.userId)}&select=full_name&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!result.ok) return NextResponse.json({ error: 'Profil tidak tersedia.' }, { status: 503 });
    const rows = await result.json() as Array<{ full_name: string | null }>;
    if (!rows.length) return NextResponse.json({ error: 'Profil tidak ditemui.' }, { status: 404 });
    fullName = rows[0].full_name || fullName;
  }
  return NextResponse.json({
    user: {
      id: session.userId,
      email: session.email,
      fullName,
      tier: session.tier,
      role: session.role,
      workspaceId: session.workspaceId,
    },
  });
}

/**
 * POST /api/auth/profile
 * Allows user to update their display name or submit account deletion request.
 */
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Akses Ditolak: Anda belum log masuk.' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { action, fullName, deleteConfirmation } = body;

    if (action === 'request_deletion') {
      if (deleteConfirmation !== 'DELETE') {
        return NextResponse.json(
          { error: 'Sila taip "DELETE" untuk mengesahkan permohonan pemadaman akaun.' },
          { status: 400 }
        );
      }

      // Record deletion request in audit_logs
      if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
        const recorded = await fetch(`${process.env.SUPABASE_URL}/rest/v1/audit_logs`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            admin_email: session.email,
            action: 'CUSTOMER_ACCOUNT_DELETION_REQUESTED',
            resource_type: 'USER',
            resource_id: session.userId,
            target_type: 'USER',
            target_id: session.userId,
            details: { workspaceId: session.workspaceId, requestedAt: new Date().toISOString() },
          }),
        });
        if (!recorded.ok) throw new Error('Permohonan pemadaman tidak dapat direkodkan.');
      } else if (process.env.NODE_ENV === 'production' && !process.env.VITEST) {
        throw new Error('Pangkalan data tidak tersedia.');
      }

      return NextResponse.json({
        success: true,
        message: 'Permohonan pemadaman akaun telah direkodkan untuk semakan pentadbir.',
      });
    }

    if (typeof fullName === 'string' && fullName.trim().length >= 2 && fullName.length <= 255) {
      if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
        const updated = await fetch(`${process.env.SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(session.userId)}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
            Prefer: 'return=representation',
          },
          body: JSON.stringify({ full_name: fullName.trim() }),
        });
        if (!updated.ok || (await updated.json() as unknown[]).length !== 1) throw new Error('Profil tidak dapat dikemas kini.');
      } else if (process.env.NODE_ENV === 'production' && !process.env.VITEST) {
        throw new Error('Pangkalan data tidak tersedia.');
      }

      return NextResponse.json({
        success: true,
        message: 'Profil anda berjaya dikemas kini.',
      });
    }

    return NextResponse.json({ error: 'Tindakan tidak sah.' }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
