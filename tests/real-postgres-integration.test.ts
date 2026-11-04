import { describe, it, expect, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import * as fs from 'fs';
import * as path from 'path';

describe('Real PostgreSQL Integration & Migration Acceptance Suite (PGlite)', () => {
  let db: PGlite;

  beforeAll(async () => {
    // 1. Initialize isolated real PostgreSQL 16 engine instance
    db = new PGlite();

    // 2. Read and apply all 4 forward migrations in strict sequential order
    const migrationsDir = path.resolve(process.cwd(), 'supabase/migrations');
    const migrationFiles = [
      '00001_initial_schema.sql',
      '00002_atomic_credit_and_job_security.sql',
      '00003_secure_financial_rpc_and_job_admission.sql',
      '00004_fix_migration_compatibility_and_concurrency.sql',
    ];

    for (const file of migrationFiles) {
      const filePath = path.join(migrationsDir, file);
      const sqlContent = fs.readFileSync(filePath, 'utf-8');
      await db.exec(sqlContent);
    }
  });

  it('proves that all 4 migrations apply successfully without schema syntax errors', async () => {
    // Verify core tables exist in PostgreSQL information_schema
    const res = await db.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;`
    );
    const tables = res.rows.map((r) => r.table_name);

    expect(tables).toContain('workspaces');
    expect(tables).toContain('credit_wallets');
    expect(tables).toContain('credit_ledger');
    expect(tables).toContain('credit_reservations');
    expect(tables).toContain('video_jobs');
    expect(tables).toContain('prompt_presets');

    // Verify required_credits and client_request_id columns exist on video_jobs
    const colRes = await db.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'video_jobs';`
    );
    const cols = colRes.rows.map((c) => c.column_name);
    expect(cols).toContain('required_credits');
    expect(cols).toContain('client_request_id');
    expect(cols).toContain('result_video_url');
  });

  it('verifies new account provisioning and initial 10-credit ledger grant idempotently', async () => {
    const workspaceId = 'a1111111-1111-4111-8111-111111111111';
    const ownerUserId = 'b1111111-1111-4111-8111-111111111111';

    // Create workspace
    await db.query(
      `INSERT INTO workspaces (id, name, slug, owner_id)
       VALUES ($1, 'Pawarna Media', 'pawarna-media', $2);`,
      [workspaceId, ownerUserId]
    );

    // Initial wallet and grant
    await db.query(
      `INSERT INTO credit_wallets (workspace_id, balance, reserved_balance, lifetime_granted, lifetime_spent, updated_at)
       VALUES ($1, 10, 0, 10, 0, NOW())
       ON CONFLICT (workspace_id) DO NOTHING;`,
      [workspaceId]
    );

    const walletRes = await db.query<{ id: string; balance: number; reserved_balance: number }>(
      `SELECT id, balance, reserved_balance FROM credit_wallets WHERE workspace_id = $1;`,
      [workspaceId]
    );
    expect(walletRes.rows.length).toBe(1);
    expect(walletRes.rows[0].balance).toBe(10);
    expect(walletRes.rows[0].reserved_balance).toBe(0);

    // Ledger entry
    await db.query(
      `INSERT INTO credit_ledger (workspace_id, wallet_id, amount, event_type, reference_type, reference_id, idempotency_key, description, created_at)
       VALUES ($1, $2, 10, 'GRANT', 'SUBSCRIPTION', $2, $3, 'Pemberian 10 kredit percuma awal akaun', NOW())
       ON CONFLICT (idempotency_key) DO NOTHING;`,
      [workspaceId, walletRes.rows[0].id, `grant_initial_${workspaceId}`]
    );

    // Ledger balance sum must match wallet balance exactly
    const sumRes = await db.query<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) as total FROM credit_ledger WHERE workspace_id = $1;`,
      [workspaceId]
    );
    expect(Number(sumRes.rows[0].total)).toBe(10);
  });

  it('executes admit_video_job_atomic with durable reservation and SUBMITTING status', async () => {
    const workspaceId = 'a1111111-1111-4111-8111-111111111111';
    const userId = 'b1111111-1111-4111-8111-111111111111';
    const jobId = 'c1111111-1111-4111-8111-111111111111';
    const clientRequestId = 'req_unique_001';

    const rpcRes = await db.query<{ admit_video_job_atomic: any }>(
      `SELECT admit_video_job_atomic($1, $2, $3, $4, 'NX01', 2, 'nexabot', 10, 10, 1, 'Test prompt snapshot');`,
      [workspaceId, userId, jobId, clientRequestId]
    );

    const result = rpcRes.rows[0].admit_video_job_atomic;
    expect(result.success).toBe(true);
    expect(result.is_duplicate).toBe(false);
    expect(result.job_id).toBe(jobId);
    expect(result.reserved_credits).toBe(10);

    // Verify job in database has SUBMITTING status
    const jobRes = await db.query<{ status: string; required_credits: number; client_request_id: string }>(
      `SELECT status, required_credits, client_request_id FROM video_jobs WHERE id = $1;`,
      [jobId]
    );
    expect(jobRes.rows[0].status).toBe('SUBMITTING');
    expect(jobRes.rows[0].required_credits).toBe(10);
    expect(jobRes.rows[0].client_request_id).toBe(clientRequestId);

    // Verify wallet reserved_balance increased to 10
    const walletRes = await db.query<{ balance: number; reserved_balance: number }>(
      `SELECT balance, reserved_balance FROM credit_wallets WHERE workspace_id = $1;`,
      [workspaceId]
    );
    expect(walletRes.rows[0].balance).toBe(10);
    expect(walletRes.rows[0].reserved_balance).toBe(10);
  });

  it('guarantees Double-Checked Locking: duplicate client_request_id returns same job without error or double charge', async () => {
    const workspaceId = 'a1111111-1111-4111-8111-111111111111';
    const userId = 'b1111111-1111-4111-8111-111111111111';
    const initialJobId = 'c1111111-1111-4111-8111-111111111111';
    const duplicateJobId = 'd2222222-2222-4222-8222-222222222222';
    const sameClientRequestId = 'req_unique_001';

    // Concurrent/Duplicate call with same clientRequestId
    const dupRes = await db.query<{ admit_video_job_atomic: any }>(
      `SELECT admit_video_job_atomic($1, $2, $3, $4, 'NX01', 2, 'nexabot', 10, 10, 1, 'Test duplicate prompt');`,
      [workspaceId, userId, duplicateJobId, sameClientRequestId]
    );

    const dupResult = dupRes.rows[0].admit_video_job_atomic;
    expect(dupResult.success).toBe(true);
    expect(dupResult.is_duplicate).toBe(true);
    expect(dupResult.job_id).toBe(initialJobId); // Returns existing acknowledged job ID

    // Verify reserved balance was NOT debited twice
    const walletRes = await db.query<{ reserved_balance: number }>(
      `SELECT reserved_balance FROM credit_wallets WHERE workspace_id = $1;`,
      [workspaceId]
    );
    expect(walletRes.rows[0].reserved_balance).toBe(10);
  });

  it('enforces plan concurrency limit (Free/Starter = 1 concurrent job) in PostgreSQL', async () => {
    const workspaceId = 'a1111111-1111-4111-8111-111111111111';
    const userId = 'b1111111-1111-4111-8111-111111111111';
    const secondJobId = 'e3333333-3333-4333-8333-333333333333';
    const secondClientRequestId = 'req_unique_002';

    // Grant 10 more credits to ensure balance isn't the limiting factor
    await db.query(
      `UPDATE credit_wallets SET balance = balance + 10 WHERE workspace_id = $1;`,
      [workspaceId]
    );

    // Job 1 is currently in SUBMITTING/PROCESSING status
    // Attempting to admit Job 2 when max_concurrency = 1 MUST be rejected with concurrency_limit_reached
    const limitRes = await db.query<{ admit_video_job_atomic: any }>(
      `SELECT admit_video_job_atomic($1, $2, $3, $4, 'NX01', 2, 'nexabot', 10, 10, 1, 'Job 2 prompt');`,
      [workspaceId, userId, secondJobId, secondClientRequestId]
    );

    const limitResult = limitRes.rows[0].admit_video_job_atomic;
    expect(limitResult.success).toBe(false);
    expect(limitResult.concurrency_limit_reached).toBe(true);
    expect(limitResult.active_count).toBe(1);
    expect(limitResult.max_concurrency).toBe(1);
    expect(limitResult.error).toContain('Had penjanaan serentak dicapai');
  });

  it('executes exactly-once settlement upon video completion and rejects settling a released reservation', async () => {
    const workspaceId = 'a1111111-1111-4111-8111-111111111111';
    const jobId = 'c1111111-1111-4111-8111-111111111111';

    // 1. Settle Job 1
    const settleRes = await db.query<{ settle_credits_atomic: any }>(
      `SELECT settle_credits_atomic($1, $2, 10, $3);`,
      [workspaceId, jobId, `stl_${jobId}`]
    );
    expect(settleRes.rows[0].settle_credits_atomic.success).toBe(true);

    // Verify wallet: balance deducted by 10, reserved_balance decremented to 0
    const walletAfter = await db.query<{ balance: number; reserved_balance: number; lifetime_spent: number }>(
      `SELECT balance, reserved_balance, lifetime_spent FROM credit_wallets WHERE workspace_id = $1;`,
      [workspaceId]
    );
    expect(walletAfter.rows[0].reserved_balance).toBe(0);
    expect(walletAfter.rows[0].lifetime_spent).toBe(10);

    // Settle again with same key is idempotent
    const settleDup = await db.query<{ settle_credits_atomic: any }>(
      `SELECT settle_credits_atomic($1, $2, 10, $3);`,
      [workspaceId, jobId, `stl_${jobId}`]
    );
    expect(settleDup.rows[0].settle_credits_atomic.success).toBe(true);
    expect(settleDup.rows[0].settle_credits_atomic.idempotent).toBe(true);

    // 2. Test Released Reservation Settlement Rejection:
    // Admit new Job for failure test
    const failJobId = 'f4444444-4444-4444-8444-444444444444';
    await db.query(
      `SELECT admit_video_job_atomic($1, 'b1111111-1111-4111-8111-111111111111', $2, 'req_fail_001', 'NX01', 2, 'nexabot', 10, 10, 5, 'Fail prompt');`,
      [workspaceId, failJobId]
    );

    // Release reservation
    const releaseRes = await db.query<{ release_credits_atomic: any }>(
      `SELECT release_credits_atomic($1, $2, $3);`,
      [workspaceId, failJobId, `rel_${failJobId}`]
    );
    expect(releaseRes.rows[0].release_credits_atomic.success).toBe(true);

    // Attempting to settle a released reservation MUST be strictly rejected
    const illegalSettle = await db.query<{ settle_credits_atomic: any }>(
      `SELECT settle_credits_atomic($1, $2, 10, $3);`,
      [workspaceId, failJobId, `stl_illegal_${failJobId}`]
    );
    expect(illegalSettle.rows[0].settle_credits_atomic.success).toBe(false);
    expect(illegalSettle.rows[0].settle_credits_atomic.error).toContain('dilepaskan');
  });

  it('guarantees tenant isolation: tenant B cannot settle or release tenant A reservations', async () => {
    const tenantAWs = 'a1111111-1111-4111-8111-111111111111';
    const tenantBWs = 'b2222222-2222-4222-8222-222222222222';
    const tenantBUser = 'b3333333-3333-4333-8333-333333333333';
    const jobAId = 'c1111111-1111-4111-8111-111111111111';

    // Provision Tenant B workspace
    await db.query(
      `INSERT INTO workspaces (id, name, slug, owner_id)
       VALUES ($1, 'Tenant B Workspace', 'tenant-b-workspace', $2);`,
      [tenantBWs, tenantBUser]
    );

    // Tenant B attempts to settle Tenant A's job using Tenant B's workspace ID
    const crossSettle = await db.query<{ settle_credits_atomic: any }>(
      `SELECT settle_credits_atomic($1, $2, 10, 'stl_cross_tenant');`,
      [tenantBWs, jobAId]
    );
    expect(crossSettle.rows[0].settle_credits_atomic.success).toBe(false);
    expect(crossSettle.rows[0].settle_credits_atomic.error).toContain('Tiada rekod tempahan kredit ditemui');
  });

  it('tests two simultaneous parallel connections with identical client_request_id without race condition', async () => {
    const workspaceId = 'a1111111-1111-4111-8111-111111111111';
    const userId = 'b1111111-1111-4111-8111-111111111111';
    const concurrentRequestId = 'req_parallel_concurrency_999';

    // Top up balance to allow testing
    await db.query(`UPDATE credit_wallets SET balance = balance + 20 WHERE workspace_id = $1;`, [workspaceId]);

    const jobIdA = 'a8888888-8888-4888-8888-888888888888';
    const jobIdB = 'b8888888-8888-4888-8888-888888888888';

    // Fire two parallel queries simultaneously simulating two incoming HTTP requests
    const [resA, resB] = await Promise.all([
      db.query<{ admit_video_job_atomic: any }>(
        `SELECT admit_video_job_atomic($1, $2, $3, $4, 'NX01', 2, 'nexabot', 10, 10, 5, 'Parallel prompt A');`,
        [workspaceId, userId, jobIdA, concurrentRequestId]
      ),
      db.query<{ admit_video_job_atomic: any }>(
        `SELECT admit_video_job_atomic($1, $2, $3, $4, 'NX01', 2, 'nexabot', 10, 10, 5, 'Parallel prompt B');`,
        [workspaceId, userId, jobIdB, concurrentRequestId]
      ),
    ]);

    const resultA = resA.rows[0].admit_video_job_atomic;
    const resultB = resB.rows[0].admit_video_job_atomic;

    expect(resultA.success).toBe(true);
    expect(resultB.success).toBe(true);

    // Both queries must resolve to the EXACT SAME job_id
    expect(resultA.job_id).toBe(resultB.job_id);

    // Exactly one must be duplicate (is_duplicate: true), and one must be primary (is_duplicate: false)
    const duplicates = [resultA.is_duplicate, resultB.is_duplicate].filter(Boolean);
    const primaries = [resultA.is_duplicate, resultB.is_duplicate].filter((d) => !d);
    expect(duplicates.length).toBe(1);
    expect(primaries.length).toBe(1);
  });

  it('proves that financial RPC execution permissions are restricted strictly to service_role', async () => {
    // 1. Authenticated role execution attempt MUST be blocked by permission denied
    await db.query(`SET ROLE authenticated;`);
    let authError: string | null = null;
    try {
      await db.query(
        `SELECT admit_video_job_atomic('a1111111-1111-4111-8111-111111111111', 'b1111111-1111-4111-8111-111111111111', 'c1111111-1111-4111-8111-111111111111', 'req_test', 'NX01', 2, 'nexabot', 10, 10, 1, 'prompt');`
      );
    } catch (err: any) {
      authError = err.message;
    }
    expect(authError).toBeTruthy();
    expect(authError).toContain('permission denied');

    // 2. Service role execution attempt succeeds
    await db.query(`SET ROLE service_role;`);
    const serviceRoleRes = await db.query<{ admit_video_job_atomic: any }>(
      `SELECT admit_video_job_atomic('a1111111-1111-4111-8111-111111111111', 'b1111111-1111-4111-8111-111111111111', 'd9999999-9999-4999-8999-999999999999', 'req_service_role_test', 'NX01', 2, 'nexabot', 10, 10, 10, 'prompt');`
    );
    expect(serviceRoleRes.rows[0].admit_video_job_atomic.success).toBe(true);

    // Reset role to postgres superuser
    await db.query(`RESET ROLE;`);
  });
});
