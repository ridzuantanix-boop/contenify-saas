/**
 * AFFIMATIK by Pawarna — Idempotent Account Reconciliation & Recovery Engine
 * Scans Supabase Auth users, detects orphan records (missing profiles, workspaces,
 * members, or wallets), and idempotently provisions complete tenant environments.
 * Strictly guarantees that existing balances and grants are preserved and NEVER duplicated.
 */

export interface ReconciliationReport {
  success: boolean;
  timestamp: string;
  totalAuthUsersScanned: number;
  completeAccounts: number;
  orphansRecovered: number;
  walletsProvisioned: number;
  duplicateGrantsPrevented: number;
  details: Array<{
    userId: string;
    email: string;
    action: string;
    status: 'recovered' | 'skipped' | 'failed';
    error?: string;
  }>;
}

export async function reconcileOrphanAccounts(): Promise<ReconciliationReport> {
  const timestamp = new Date().toISOString();
  const details: ReconciliationReport['details'] = [];

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      success: false,
      timestamp,
      totalAuthUsersScanned: 0,
      completeAccounts: 0,
      orphansRecovered: 0,
      walletsProvisioned: 0,
      duplicateGrantsPrevented: 0,
      details: [
        {
          userId: 'system',
          email: 'none',
          action: 'check_supabase',
          status: 'failed',
          error: 'Supabase URL or Service Role Key is unconfigured.',
        },
      ],
    };
  }

  const sHeaders = {
    'Content-Type': 'application/json',
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
  };

  try {
    // 1. Fetch all users from Supabase Auth admin API
    const authRes = await fetch(`${process.env.SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=1000`, {
      headers: sHeaders,
    });

    if (!authRes.ok) {
      const errText = await authRes.text().catch(() => '');
      throw new Error(`Gagal memuatkan senarai pengguna auth (HTTP ${authRes.status}): ${errText}`);
    }

    const authData = await authRes.json();
    const users = Array.isArray(authData?.users) ? authData.users : [];
    let completeCount = 0;
    let recoveredCount = 0;
    let walletsCount = 0;
    let dupPreventedCount = 0;

    for (const u of users) {
      const userId = u.id;
      const userEmail = (u.email || '').toLowerCase().trim();
      const fullName = u.user_metadata?.full_name || userEmail.split('@')[0] || 'Pengguna';
      const whatsapp = u.user_metadata?.whatsapp || '';

      // Check profile
      const profRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=*`, {
        headers: sHeaders,
      });
      const profRows = profRes.ok ? await profRes.json() : [];
      let profile = profRows[0];
      let workspaceId = profile?.default_workspace_id;

      // If workspace missing or profile missing, recover
      if (!profile || !workspaceId) {
        // Check if workspace exists
        const wsRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/workspaces?owner_id=eq.${encodeURIComponent(userId)}&select=*`, {
          headers: sHeaders,
        });
        const wsRows = wsRes.ok ? await wsRes.json() : [];
        let workspace = wsRows[0];

        if (!workspace) {
          const uniqueSlug = `ws-${userId.slice(0, 8)}-${Date.now()}`;
          const newWsRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/workspaces`, {
            method: 'POST',
            headers: { ...sHeaders, Prefer: 'return=representation' },
            body: JSON.stringify({
              name: `${fullName}'s Workspace`,
              slug: uniqueSlug,
              owner_id: userId,
              status: 'active',
            }),
          });
          if (newWsRes.ok) {
            const createdWs = await newWsRes.json();
            workspace = createdWs[0];
          }
        }

        workspaceId = workspace?.id;

        // Upsert profile
        if (workspaceId) {
          await fetch(`${process.env.SUPABASE_URL}/rest/v1/profiles`, {
            method: 'POST',
            headers: { ...sHeaders, Prefer: 'resolution=merge-duplicates' },
            body: JSON.stringify({
              id: userId,
              email: userEmail,
              full_name: fullName,
              whatsapp,
              tier: 'free',
              default_workspace_id: workspaceId,
            }),
          });

          // Ensure membership
          await fetch(`${process.env.SUPABASE_URL}/rest/v1/workspace_members`, {
            method: 'POST',
            headers: { ...sHeaders, Prefer: 'resolution=ignore-duplicates' },
            body: JSON.stringify({
              workspace_id: workspaceId,
              user_id: userId,
              role: 'owner',
            }),
          });

          recoveredCount++;
          details.push({ userId, email: userEmail, action: 'reconciled_profile_and_workspace', status: 'recovered' });
        }
      } else {
        completeCount++;
      }

      // Check wallet and provision 50 credits if not yet provisioned
      if (workspaceId) {
        const provRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/provision_wallet_atomic`, {
          method: 'POST',
          headers: sHeaders,
          body: JSON.stringify({
            p_workspace_id: workspaceId,
            p_initial_balance: 50,
          }),
        });

        if (provRes.ok) {
          const provData = await provRes.json();
          if (provData.is_new) {
            walletsCount++;
          } else {
            dupPreventedCount++;
          }
        }
      }
    }

    return {
      success: true,
      timestamp,
      totalAuthUsersScanned: users.length,
      completeAccounts: completeCount,
      orphansRecovered: recoveredCount,
      walletsProvisioned: walletsCount,
      duplicateGrantsPrevented: dupPreventedCount,
      details,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      timestamp,
      totalAuthUsersScanned: 0,
      completeAccounts: 0,
      orphansRecovered: 0,
      walletsProvisioned: 0,
      duplicateGrantsPrevented: 0,
      details: [{ userId: 'system', email: 'none', action: 'reconcile_error', status: 'failed', error: msg }],
    };
  }
}
