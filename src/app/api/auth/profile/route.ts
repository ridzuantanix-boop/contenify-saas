import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/session';

export const runtime = 'edge';

/**
 * GET /api/auth/profile
 * Returns authenticated user profile and subscription details.
 */
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Akses Ditolak: Anda belum log masuk.' }, { status: 401 });
  }

  return NextResponse.json({
    user: {
      id: session.userId,
      email: session.email,
      fullName: session.fullName,
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
        await fetch(`${process.env.SUPABASE_URL}/rest/v1/audit_logs`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            admin_email: session.email,
            action: 'CUSTOMER_ACCOUNT_DELETION_REQUESTED',
            target_type: 'USER',
            target_id: session.userId,
            details: { workspaceId: session.workspaceId, requestedAt: new Date().toISOString() },
          }),
        });
      }

      return NextResponse.json({
        success: true,
        message: 'Permohonan pemadaman akaun telah diterima dan akan diproses dalam tempoh 14 hari bekerja mengikut dasar PDPA.',
      });
    }

    if (fullName && typeof fullName === 'string') {
      if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
        await fetch(`${process.env.SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(session.userId)}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({ full_name: fullName.trim() }),
        });
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
