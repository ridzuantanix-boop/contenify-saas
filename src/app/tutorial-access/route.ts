import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken } from '@/lib/auth/session';
import { TUTORIAL_GUEST_EMAIL, validTutorialAccessToken } from '@/lib/auth/tutorial-guest';

export const dynamic = 'force-dynamic';

function unavailable(req: NextRequest) {
  const response = NextResponse.redirect(new URL('/tutorial-showcase', req.url), 302);
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return response;
}

export async function GET(req: NextRequest) {
  const candidate = req.nextUrl.searchParams.get('access') || '';
  const configured = process.env.TUTORIAL_GUEST_ACCESS_TOKEN || '';
  const userId = process.env.TUTORIAL_GUEST_USER_ID || '';
  const workspaceId = process.env.TUTORIAL_GUEST_WORKSPACE_ID || '';
  const expiresAt = Date.parse(process.env.TUTORIAL_GUEST_EXPIRES_AT || '');

  if (!userId || !workspaceId || !Number.isFinite(expiresAt) || Date.now() >= expiresAt) return unavailable(req);
  if (!(await validTutorialAccessToken(candidate, configured))) return unavailable(req);

  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) return unavailable(req);

  const membership = await fetch(
    `${base}/rest/v1/workspace_members?workspace_id=eq.${encodeURIComponent(workspaceId)}&user_id=eq.${encodeURIComponent(userId)}&select=role,workspaces(status)&limit=1`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: 'no-store' },
  );
  if (!membership.ok) return unavailable(req);
  const rows = await membership.json() as Array<{ role: string; workspaces?: { status?: string } }>;
  if (rows[0]?.workspaces?.status !== 'active') return unavailable(req);

  const remainingSeconds = Math.max(60, Math.min(24 * 60 * 60, Math.floor((expiresAt - Date.now()) / 1000)));
  const token = await createSessionToken({
    userId,
    workspaceId,
    email: TUTORIAL_GUEST_EMAIL,
    fullName: 'Gemini Tutorial Guest',
    role: 'owner',
    tier: 'free',
  }, remainingSeconds);

  const response = NextResponse.redirect(new URL('/auto-factory?tutorial=1', req.url), 302);
  response.cookies.set('affimatik_session', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: remainingSeconds,
  });
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return response;
}
