import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, createSessionToken } from '@/lib/auth/session';
import { DurableStore } from '@/lib/db/store';

export const runtime = 'edge';

function missingProductionLoginConfiguration(): string[] {
  if (process.env.NODE_ENV !== 'production' || Boolean(process.env.VITEST)) {
    return [];
  }

  return ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SESSION_SECRET']
    .filter((name) => !process.env[name] || process.env[name]?.trim() === '');
}

/**
 * GET: Retrieve currently authenticated user session.
 * STRICT: Returns authenticated: false for anonymous visitors.
 * Never issues unauthenticated Pro sessions automatically.
 */
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);

  if (!session) {
    return NextResponse.json({
      authenticated: false,
      user: null,
      wallet: null,
    });
  }

  try {
    const wallet = await DurableStore.getWallet(session.workspaceId);
    return NextResponse.json({
      authenticated: true,
      user: session,
      wallet: {
        balance: wallet.balance,
        reservedBalance: wallet.reservedBalance,
      },
    });
  } catch (err: unknown) {
    return NextResponse.json({
      authenticated: true,
      user: session,
      wallet: null,
      error: 'Pangkalan data tidak dapat diakses buat masa ini.',
    });
  }
}

/**
 * POST: Authenticate user credentials.
 * STRICT: Client-supplied role, tier, or workspace are NEVER accepted from request body.
 * Values are resolved strictly from trusted server database records or verified Supabase identity.
 */
export async function POST(req: NextRequest) {
  try {
    const missingConfiguration = missingProductionLoginConfiguration();
    if (missingConfiguration.length > 0) {
      return NextResponse.json(
        {
          error: 'Perkhidmatan log masuk sedang diselenggara. Sila cuba semula sebentar lagi.',
          serviceUnavailable: true,
        },
        { status: 503 }
      );
    }

    const body = await req.json();
    const { email, password, supabaseAccessToken } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Sila masukkan alamat emel yang sah.' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    let verifiedUserId = '';
    let verifiedTier: 'free' | 'starter' | 'pro' | 'agency' = 'free';
    let verifiedRole: 'owner' | 'admin' | 'member' | 'superadmin' = 'member';
    let verifiedWorkspaceId = '';

    // 0. Authoritative Master Admin Login Check
    const isMasterAdminEmail = cleanEmail === 'admin@affimatik.online' || cleanEmail === 'admin@pawarna.my';
    const configuredAdminKey = process.env.ADMIN_ACCESS_KEY;
    const isMasterAdminPassword = Boolean(
      configuredAdminKey &&
      configuredAdminKey.trim().length > 0 &&
      password &&
      password === configuredAdminKey.trim()
    );

    if (isMasterAdminEmail && isMasterAdminPassword) {
      verifiedUserId = 'usr_admin_master';
      verifiedWorkspaceId = 'ws_system_admin';
      verifiedRole = 'superadmin';
      verifiedTier = 'agency';
    }

    // 1. Supabase Auth Verification (if Supabase credentials are configured and not master admin)
    if (!verifiedUserId && process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY && (password || supabaseAccessToken)) {
      try {
        let authUser = null;

        if (supabaseAccessToken) {
          // Verify provided Supabase JWT token
          const userRes = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
            headers: {
              apikey: process.env.SUPABASE_ANON_KEY,
              Authorization: `Bearer ${supabaseAccessToken}`,
            },
          });
          if (userRes.ok) {
            authUser = await userRes.json();
          }
        } else if (password) {
          // Authenticate with Supabase password grant
          const loginRes = await fetch(`${process.env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: process.env.SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({ email: cleanEmail, password }),
          });
          if (loginRes.ok) {
            const tokenData = await loginRes.json();
            authUser = tokenData.user;
          }
        }

        if (!authUser) {
          return NextResponse.json(
            { error: 'Kelayakan log masuk tidak sah. Sila semak emel dan kata laluan.' },
            { status: 401 }
          );
        }

        verifiedUserId = authUser.id;

        // Fetch user profile from Supabase Database
        if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
          const profileRes = await fetch(
            `${process.env.SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(verifiedUserId)}&select=*`,
            {
              headers: {
                apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
                Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
              },
            }
          );
          if (profileRes.ok) {
            const profiles = await profileRes.json();
            if (profiles && profiles.length > 0) {
              const p = profiles[0];
              verifiedTier = p.tier || 'free';
              verifiedWorkspaceId = p.default_workspace_id || '';
            }
          }

          // Verify active workspace membership and workspace status
          let activeMembershipFound = false;

          // 1. Check default_workspace_id first if specified
          if (verifiedWorkspaceId) {
            const memberRes = await fetch(
              `${process.env.SUPABASE_URL}/rest/v1/workspace_members?workspace_id=eq.${encodeURIComponent(verifiedWorkspaceId)}&user_id=eq.${encodeURIComponent(verifiedUserId)}&select=role,workspaces(id,status)`,
              {
                headers: {
                  apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
                  Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
                },
              }
            );
            if (memberRes.ok) {
              const members = await memberRes.json();
              if (members && members.length > 0) {
                const mem = members[0];
                const ws = mem.workspaces;
                if (ws && ws.status === 'active') {
                  verifiedRole = mem.role || 'member';
                  activeMembershipFound = true;
                }
              }
            }
          }

          // 2. If default workspace membership is missing or invalid, search for any valid active workspace membership
          if (!activeMembershipFound) {
            const anyMemberRes = await fetch(
              `${process.env.SUPABASE_URL}/rest/v1/workspace_members?user_id=eq.${encodeURIComponent(verifiedUserId)}&select=workspace_id,role,workspaces(id,status)&limit=1`,
              {
                headers: {
                  apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
                  Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
                },
              }
            );
            if (anyMemberRes.ok) {
              const anyMembers = await anyMemberRes.json();
              if (anyMembers && anyMembers.length > 0) {
                const mem = anyMembers[0];
                const ws = mem.workspaces;
                if (ws && ws.status === 'active') {
                  verifiedWorkspaceId = mem.workspace_id;
                  verifiedRole = mem.role || 'member';
                  activeMembershipFound = true;
                }
              }
            }
          }

          // 3. In production, strictly reject issuing a session if no active valid membership exists
          if (!activeMembershipFound && process.env.NODE_ENV === 'production') {
            return NextResponse.json(
              { error: 'Akses Ditolak: Tiada rekod keahlian ruang kerja (workspace) yang aktif untuk akaun ini.' },
              { status: 403 }
            );
          }
        }
      } catch (err: unknown) {
        console.error('[Session API] Supabase auth error:', err);
        return NextResponse.json(
          { error: 'Pangkalan data pengesahan tidak dapat diakses buat masa ini.' },
          { status: 503 }
        );
      }
    }

    // 2. Account Fallback (when Supabase Auth is not configured in the active environment)
    if (!verifiedUserId) {
      if (process.env.SUPABASE_URL && process.env.NODE_ENV === 'production') {
        return NextResponse.json(
          { error: 'Akaun tidak disahkan. Sila gunakan log masuk rasmi Supabase Auth.' },
          { status: 401 }
        );
      }

      // In standalone/development/test, require non-empty password
      if (!password || password.length < 6) {
        return NextResponse.json(
          { error: 'Kata laluan mestilah sekurang-kurangnya 6 aksara.' },
          { status: 400 }
        );
      }

      verifiedUserId = `usr_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
      verifiedWorkspaceId = `ws_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
      verifiedTier = 'starter'; // Default verified tier starts at starter/free
      verifiedRole = 'owner';
    }

    if (!verifiedWorkspaceId) {
      if (process.env.SUPABASE_URL && process.env.NODE_ENV === 'production') {
        return NextResponse.json(
          { error: 'Pengguna tidak mempunyai rekod keahlian ruang kerja (workspace) yang sah dalam pangkalan data.' },
          { status: 403 }
        );
      }
      verifiedWorkspaceId = `ws_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
    }

    // 3. Issue Cryptographically Signed Session Token
    const sessionPayload = {
      userId: verifiedUserId,
      email: cleanEmail,
      fullName: cleanEmail.split('@')[0],
      workspaceId: verifiedWorkspaceId,
      role: verifiedRole,
      tier: verifiedTier,
    };

    const token = await createSessionToken(sessionPayload);
    const wallet = await DurableStore.getWallet(sessionPayload.workspaceId);

    const res = NextResponse.json({
      success: true,
      user: sessionPayload,
      wallet,
    });

    res.cookies.set('affimatik_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    if (verifiedRole === 'superadmin' || verifiedRole === 'admin') {
      res.cookies.set('affimatik_admin_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60,
      });
    }

    return res;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * DELETE: Invalidate active session cookie
 */
export async function DELETE() {
  const res = NextResponse.json({ success: true, message: 'Log keluar berjaya.' });
  res.cookies.set('affimatik_session', '', {
    httpOnly: true,
    path: '/',
    maxAge: 0,
  });
  res.cookies.set('affimatik_admin_session', '', {
    httpOnly: true,
    path: '/',
    maxAge: 0,
  });
  return res;
}
