import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken } from '@/lib/auth/session';
import { DurableStore } from '@/lib/db/store';

export const runtime = 'edge';

/**
 * POST /api/auth/register
 * Complete Customer Self-Service Registration & Automated Provisioning
 * 
 * Automatically creates and associates:
 * 1. Verified authentication identity (Supabase Auth / Local store)
 * 2. User profile (tier = 'free')
 * 3. Workspace (status = 'active')
 * 4. Workspace membership (role = 'owner')
 * 5. Credit wallet with initial 10 free trial credits and GRANT ledger entry
 * 6. Affiliate referral attribution (if referral code supplied)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, fullName, referralCode } = body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Sila masukkan alamat emel yang sah.' },
        { status: 400 }
      );
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json(
        { error: 'Kata laluan mesti mengandungi sekurang-kurangnya 6 aksara.' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const displayName = (fullName && typeof fullName === 'string') ? fullName.trim() : cleanEmail.split('@')[0];
    const cleanReferral = (referralCode && typeof referralCode === 'string') ? referralCode.trim().toUpperCase() : null;

    let userId: string;
    let workspaceId: string;
    let requiresEmailConfirmation = false;

    // 1. Supabase Auth Registration (when configured)
    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      try {
        const signupRes = await fetch(`${process.env.SUPABASE_URL}/auth/v1/signup`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: process.env.SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            email: cleanEmail,
            password,
            data: {
              full_name: displayName,
              referral_code: cleanReferral,
            },
          }),
        });

        const signupData = await signupRes.json();

        if (!signupRes.ok) {
          const errMsg = signupData.msg || signupData.error_description || signupData.message || 'Pendaftaran gagal.';
          return NextResponse.json({ error: errMsg }, { status: signupRes.status });
        }

        if (!signupData.user?.id) {
          return NextResponse.json({ error: 'Ralat mencipta akaun pendaftaran.' }, { status: 500 });
        }

        userId = signupData.user.id;
        requiresEmailConfirmation = !signupData.session; // If no session returned, email confirmation is active in Supabase

        // 2. Server-side provisioning via Service Role with verified columns and foreign keys
        if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
          const sHeaders = {
            'Content-Type': 'application/json',
            apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
            Prefer: 'return=representation',
          };

          const uniqueSlug = `ws-${userId.slice(0, 8)}-${Date.now()}`;

          // A. Create workspace with mandatory slug and owner_id
          const wsRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/workspaces`, {
            method: 'POST',
            headers: sHeaders,
            body: JSON.stringify({
              name: `${displayName}'s Workspace`,
              slug: uniqueSlug,
              owner_id: userId,
              status: 'active',
            }),
          });

          if (!wsRes.ok) {
            const errText = await wsRes.text().catch(() => '');
            console.error('[Register API] Failed to create workspace:', errText);
            throw new Error(`Pangkalan data gagal mencipta ruang kerja: ${errText}`);
          }

          const wsRows = await wsRes.json();
          if (!wsRows || wsRows.length === 0 || !wsRows[0].id) {
            throw new Error('Ruang kerja gagal dijana oleh pangkalan data.');
          }
          workspaceId = wsRows[0].id;

          // B. Upsert Profile with mandatory email, id, tier, default_workspace_id
          const profRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/profiles`, {
            method: 'POST',
            headers: sHeaders,
            body: JSON.stringify({
              id: userId,
              email: cleanEmail,
              full_name: displayName,
              tier: 'free',
              default_workspace_id: workspaceId,
            }),
          });

          if (!profRes.ok) {
            const errText = await profRes.text().catch(() => '');
            console.error('[Register API] Failed to create profile:', errText);
            throw new Error(`Pangkalan data gagal mencipta profil pengguna: ${errText}`);
          }

          // C. Upsert Workspace Member
          const memRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/workspace_members`, {
            method: 'POST',
            headers: sHeaders,
            body: JSON.stringify({
              workspace_id: workspaceId,
              user_id: userId,
              role: 'owner',
            }),
          });

          if (!memRes.ok) {
            const errText = await memRes.text().catch(() => '');
            console.error('[Register API] Failed to create workspace member:', errText);
            throw new Error(`Pangkalan data gagal menetapkan keahlian ruang kerja: ${errText}`);
          }

          // D. Atomically provision credit wallet (50 free trial credits + GRANT ledger entry)
          // Uses exact signature p_workspace_id and p_initial_balance
          const provRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/provision_wallet_atomic`, {
            method: 'POST',
            headers: sHeaders,
            body: JSON.stringify({
              p_workspace_id: workspaceId,
              p_initial_balance: 50,
            }),
          });

          if (!provRes.ok) {
            const errText = await provRes.text().catch(() => '');
            console.error('[Register API] Failed to provision initial wallet:', errText);
            throw new Error(`Pangkalan data gagal memperuntukkan dompet kredit permulaan: ${errText}`);
          }

          // E. Record referral code if provided
          if (cleanReferral) {
            await fetch(`${process.env.SUPABASE_URL}/rest/v1/system_settings`, {
              method: 'POST',
              headers: sHeaders,
              body: JSON.stringify({
                key: `ref_user_${userId}`,
                value: { referralCode: cleanReferral, registeredAt: new Date().toISOString() },
              }),
            });
          }
        } else {
          workspaceId = crypto.randomUUID();
        }
      } catch (err: unknown) {
        console.error('[Register API] Supabase error:', err);
        return NextResponse.json(
          { error: 'Pangkalan data tidak dapat diakses buat masa ini. Sila cuba sebentar lagi.' },
          { status: 503 }
        );
      }
    } else {
      // Standalone / DurableStore registration fallback when Supabase is not configured in the active environment
      userId = crypto.randomUUID();
      workspaceId = crypto.randomUUID();
      await DurableStore.getWallet(workspaceId); // automatically provisions 50 credits
    }

    // Provision wallet in local store for testing / session
    const wallet = await DurableStore.getWallet(workspaceId);

    // Create session token
    const sessionPayload = {
      userId,
      email: cleanEmail,
      workspaceId,
      tier: 'free' as const,
      role: 'owner' as const,
      fullName: displayName,
    };

    const token = await createSessionToken(sessionPayload);

    const res = NextResponse.json({
      success: true,
      message: requiresEmailConfirmation
        ? 'Pendaftaran berjaya! Sila semak emel anda untuk mengesahkan akaun.'
        : 'Pendaftaran berjaya! Anda kini boleh mula menjana video.',
      requiresEmailConfirmation,
      user: sessionPayload,
      wallet,
    });

    if (!requiresEmailConfirmation) {
      res.cookies.set('affimatik_session', token, {
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
