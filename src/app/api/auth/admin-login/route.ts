import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken } from '@/lib/auth/session';
import { verifyAdminAccess } from '@/lib/auth/admin-guard';

export const runtime = 'edge';

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { accessKey } = body;

    const configuredKey = process.env.ADMIN_ACCESS_KEY || 'AffiMatik@Master2026!';

    if (!accessKey || !constantTimeEqual(accessKey.trim(), configuredKey.trim())) {
      return NextResponse.json(
        { error: 'Kunci akses pentadbir tidak sah.' },
        { status: 401 }
      );
    }

    // Generate cryptographic admin session token
    const adminSession = {
      userId: 'usr_admin_master',
      email: 'admin@pawarna.my',
      fullName: 'AffiMatik SuperAdmin',
      workspaceId: 'ws_system_admin',
      role: 'superadmin' as const,
      tier: 'agency' as const,
    };

    const token = await createSessionToken(adminSession, 12 * 60 * 60); // 12 hours admin session

    const res = NextResponse.json({
      success: true,
      role: 'superadmin',
      message: 'Pengesahan pentadbir berjaya.',
    });

    res.cookies.set('affimatik_admin_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 12 * 60 * 60,
    });

    return res;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function GET(req: NextRequest) {
  const check = await verifyAdminAccess(req);
  return NextResponse.json({
    isAuthorized: check.isAuthorized,
    role: check.role || null,
  });
}

export async function DELETE() {
  const res = NextResponse.json({ success: true, message: 'Admin dikunci semula.' });
  res.cookies.set('affimatik_admin_session', '', {
    httpOnly: true,
    path: '/',
    maxAge: 0,
  });
  return res;
}
