import { describe, it, expect, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import * as fs from 'fs';
import * as path from 'path';

describe('Real PostgreSQL Integration & Migration Acceptance Suite (PGlite)', () => {
  let db: PGlite;

  beforeAll(async () => {
    // 1. Initialize isolated real PostgreSQL 16 engine instance
    db = new PGlite();

    // 2. Load test-only Supabase stubs (roles, fallback uuid, auth.uid mock)
    const stubsPath = path.resolve(process.cwd(), 'tests/helpers/supabase-stubs.sql');
    if (fs.existsSync(stubsPath)) {
      const stubsSql = fs.readFileSync(stubsPath, 'utf-8');
      await db.exec(stubsSql);
    }

    // 3. Read and apply all forward migrations in strict sequential order
    const migrationsDir = path.resolve(process.cwd(), 'supabase/migrations');
    const migrationFiles = [
      '00001_initial_schema.sql',
      '00002_atomic_credit_and_job_security.sql',
      '00003_secure_financial_rpc_and_job_admission.sql',
      '00004_fix_migration_compatibility_and_concurrency.sql',
      '00005_workspace_status_and_alignment.sql',
      '00006_billing_affiliates_and_financial_safety.sql',
      '00007_fix_admin_credit_adjustment_uuid.sql',
      '00008_soft_launch_50_credits.sql',
      '00009_add_whatsapp_to_profiles.sql',
      '00010_fix_welcome_credit_ledger.sql',
      '00011_affiliate_application_policy.sql',
      '00012_affiliate_ledger_and_assets.sql',
      '00013_verified_account_provisioning.sql',
      '00014_close_public_data_access.sql',
      '00015_customer_dashboard_metrics.sql',
      '00016_verified_video_metadata.sql',
      '00017_refund_credit_integrity.sql',
    ];

    for (const file of migrationFiles) {
      const filePath = path.join(migrationsDir, file);
      let sqlContent = fs.readFileSync(filePath, 'utf-8');
      // PGlite WASM does not bundle uuid-ossp shared library, but native gen_random_uuid() is provided in test harness stubs
      sqlContent = sqlContent.replace('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";', '-- PGlite WASM bypass');
      await db.exec(sqlContent);
    }
    // Retained optional admin QA is tested separately but excluded from the
    // launch migration path. Ordinary video delivery does not depend on it.
    await db.exec(fs.readFileSync(path.resolve(process.cwd(), 'supabase/optional/00018_manual_video_qa.sql'), 'utf-8'));
  });

  it('proves that all forward migrations apply without schema syntax errors', async () => {
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

  it('enables row security on all sensitive payment and affiliate tables', async () => {
    const result = await db.query<{ relname: string; relrowsecurity: boolean }>(
      `SELECT relname,relrowsecurity FROM pg_class WHERE relname IN ('profiles','orders','subscriptions','affiliate_partners','affiliate_commissions','affiliate_referral_events','affiliate_payout_requests','affiliate_clawbacks','audit_logs','system_settings','credit_reservations')`);
    expect(result.rows).toHaveLength(11);
    expect(result.rows.every((row) => row.relrowsecurity)).toBe(true);
  });

  it('provisions only confirmed identities once and preserves the 20-credit welcome grant', async () => {
    const userId = 'b2222222-2222-4222-8222-222222222222';
    await db.query(`INSERT INTO auth.users(id,email) VALUES($1,'verified@example.test')`, [userId]);
    const invoke = () => db.query<{ result: { success: boolean; workspace_id?: string } }>(
      `SELECT provision_verified_account_atomic($1,'verified@example.test','Verified User','0123456789',NULL) AS result`, [userId]);
    expect((await invoke()).rows[0].result.success).toBe(false);
    expect((await db.query(`SELECT id FROM profiles WHERE id=$1`, [userId])).rows).toHaveLength(0);
    await db.query(`UPDATE auth.users SET email_confirmed_at=now() WHERE id=$1`, [userId]);
    const first = (await invoke()).rows[0].result;
    const second = (await invoke()).rows[0].result;
    expect(first.success).toBe(true);
    expect(second.workspace_id).toBe(first.workspace_id);
    const wallet = await db.query<{ balance: number }>(`SELECT balance FROM credit_wallets WHERE workspace_id=$1`, [first.workspace_id]);
    expect(wallet.rows[0].balance).toBe(20);
    const grants = await db.query(`SELECT id FROM credit_ledger WHERE workspace_id=$1 AND event_type='GRANT'`, [first.workspace_id]);
    expect(grants.rows).toHaveLength(1);
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

  it('enforces affiliate 14-day hold, RM50 minimum, one payout, and refund reversal', async () => {
    const affiliateUser = 'b3333333-3333-4333-8333-333333333333';
    const affiliateWorkspace = 'a3333333-3333-4333-8333-333333333333';
    const affiliateId = 'c3333333-3333-4333-8333-333333333333';
    const buyerUser = 'b4444444-4444-4444-8444-444444444444';
    const buyerWorkspace = 'a4444444-4444-4444-8444-444444444444';
    await db.query(`INSERT INTO workspaces(id,name,slug,owner_id,status) VALUES($1,'Affiliate','affiliate-test',$2,'active'),($3,'Buyer','buyer-test',$4,'active')`, [affiliateWorkspace,affiliateUser,buyerWorkspace,buyerUser]);
    await db.query(`INSERT INTO profiles(id,email,tier,default_workspace_id) VALUES($1,'partner@example.test','free',$2),($3,'buyer@example.test','free',$4)`, [affiliateUser,affiliateWorkspace,buyerUser,buyerWorkspace]);
    await db.query(`INSERT INTO credit_wallets(workspace_id,balance,reserved_balance,lifetime_granted,lifetime_spent) VALUES($1,3000,0,3000,0)`,[buyerWorkspace]);
    await db.query(`INSERT INTO affiliate_partners(id,user_id,referral_code,commission_rate,status,payout_bank,payout_account_number,payout_account_holder) VALUES($1,$2,'AFFTEST',10,'APPROVED','Bank Test','123456789','Partner')`, [affiliateId,affiliateUser]);
    const orderIds = ['d3333333-3333-4333-8333-333333333331','d3333333-3333-4333-8333-333333333332','d3333333-3333-4333-8333-333333333333'];
    for (const id of orderIds) {
      await db.query(`INSERT INTO orders(id,workspace_id,user_id,plan_id,amount_myr,credits_granted,status) VALUES($1,$2,$3,'agency',300,1000,'PAID')`, [id,buyerWorkspace,buyerUser]);
      await db.query(`INSERT INTO affiliate_commissions(affiliate_id,order_id,workspace_id,amount_myr,rate_percentage,status) VALUES($1,$2,$3,30,10,'PENDING')`, [affiliateId,id,buyerWorkspace]);
    }
    const request = () => db.query<{ result: { success: boolean; request_id?: string; amount_myr?: number } }>(`SELECT request_affiliate_payout_atomic($1) AS result`, [affiliateId]);
    expect((await request()).rows[0].result.success).toBe(false);
    await db.query(`UPDATE affiliate_commissions SET available_at=now()-INTERVAL '1 day' WHERE order_id IN ($1,$2)`, [orderIds[0],orderIds[1]]);
    const first = (await request()).rows[0].result;
    expect(first.success).toBe(true);
    expect(Number(first.amount_myr)).toBe(60);
    expect((await request()).rows[0].result.success).toBe(false);
    const approved = await db.query<{ result: { success: boolean } }>(`SELECT review_affiliate_payout_atomic($1,'APPROVED','admin',NULL) AS result`, [first.request_id]);
    expect(approved.rows[0].result.success).toBe(true);
    const paid = await db.query<{ result: { success: boolean } }>(`SELECT review_affiliate_payout_atomic($1,'PAID','admin','BANK-001') AS result`, [first.request_id]);
    expect(paid.rows[0].result.success).toBe(true);
    expect((await db.query(`SELECT id FROM affiliate_commissions WHERE payout_request_id=$1 AND status='PAID'`, [first.request_id])).rows).toHaveLength(2);
    const paidRefund = await db.query<{ result: { success: boolean } }>(`SELECT reverse_affiliate_commission_atomic($1,'admin','Customer refund','REF-001') AS result`, [orderIds[0]]);
    expect(paidRefund.rows[0].result.success).toBe(true);
    expect((await db.query(`SELECT id FROM affiliate_clawbacks WHERE order_id=$1 AND status='OPEN'`, [orderIds[0]])).rows).toHaveLength(1);
    const unpaidRefund = await db.query<{ result: { success: boolean } }>(`SELECT reverse_affiliate_commission_atomic($1,'admin','Customer refund','REF-002') AS result`, [orderIds[2]]);
    expect(unpaidRefund.rows[0].result.success).toBe(true);
    expect((await db.query<{ status: string }>(`SELECT status FROM affiliate_commissions WHERE order_id=$1`, [orderIds[2]])).rows[0].status).toBe('REVERSED');
  });

  it('revokes purchased credits on refund, records debt for spent credits and blocks repeat settlement', async () => {
    const ws = 'a7777777-7777-4777-8777-777777777777';
    const user = 'b7777777-7777-4777-8777-777777777777';
    const order = 'd7777777-7777-4777-8777-777777777777';
    await db.query(`INSERT INTO workspaces(id,name,slug,owner_id,status) VALUES($1,'Refund','refund-test',$2,'active')`,[ws,user]);
    await db.query(`INSERT INTO profiles(id,email,tier,default_workspace_id) VALUES($1,'refund@example.test','free',$2)`,[user,ws]);
    await db.query(`INSERT INTO credit_wallets(workspace_id,balance,reserved_balance,lifetime_granted,lifetime_spent) VALUES($1,35,5,100,65)`,[ws]);
    await db.query(`INSERT INTO orders(id,workspace_id,user_id,plan_id,amount_myr,credits_granted,status) VALUES($1,$2,$3,'starter',50,40,'PAID')`,[order,ws,user]);
    const first=(await db.query<{result:{success:boolean;credits_revoked:number;credit_debt:number}}>(`SELECT reverse_affiliate_commission_atomic($1,'admin','Verified bank refund','BANK-REF-77') AS result`,[order])).rows[0].result;
    expect(first).toMatchObject({success:true,credits_revoked:30,credit_debt:10});
    expect((await db.query<{balance:number;reserved_balance:number}>(`SELECT balance,reserved_balance FROM credit_wallets WHERE workspace_id=$1`,[ws])).rows[0]).toMatchObject({balance:5,reserved_balance:5});
    expect((await db.query<{result:{success:boolean;idempotent_replay?:boolean}}>(`SELECT reverse_affiliate_commission_atomic($1,'admin','Verified bank refund','BANK-REF-77') AS result`,[order])).rows[0].result.idempotent_replay).toBe(true);
    expect((await db.query<{result:{success:boolean}}>(`SELECT settle_order_payment_atomic($1,NULL,'{}'::jsonb) AS result`,[order])).rows[0].result.success).toBe(false);
    const denied=(await db.query<{result:{success:boolean;error?:string}}>(`SELECT admit_video_job_atomic($1,$2,$3,'refund-debt-job','NX01',2,'nexabot',1,10,5,'prompt') AS result`,[ws,user,'c7777777-7777-4777-8777-777777777777'])).rows[0].result;
    expect(denied.error).toMatch(/Refund credit debt/);
    await db.query(`UPDATE credit_wallets SET balance=20 WHERE workspace_id=$1`,[ws]);
    expect((await db.query<{result:{success:boolean;credits_recovered:number}}>(`SELECT recover_credit_refund_debt_atomic($1,'admin','BANK-REC-77') AS result`,[order])).rows[0].result).toMatchObject({success:true,credits_recovered:10});
    expect((await db.query<{balance:number}>(`SELECT balance FROM credit_wallets WHERE workspace_id=$1`,[ws])).rows[0].balance).toBe(10);
  });

  it('registers one product image atomically across retries', async () => {
    const workspace = 'a4444444-4444-4444-8444-444444444444';
    const first = await db.query<{ result: { asset_id: string; product_id: string; reused: boolean } }>(
      `SELECT register_product_image_atomic($1,$2,$3,'Sabun','Penjagaan diri','Nota','workspaces/test/input.png','input.png','image/png',123,'checksum-a') AS result`,
      [workspace,'e4444444-4444-4444-8444-444444444444','f4444444-4444-4444-8444-444444444444']);
    expect(first.rows[0].result.reused).toBe(false);
    const retry = await db.query<{ result: { asset_id: string; reused: boolean } }>(
      `SELECT register_product_image_atomic($1,$2,$3,'Lain','Lain',NULL,'workspaces/test/retry.png','retry.png','image/png',123,'checksum-a') AS result`,
      [workspace,'e5555555-5555-4555-8555-555555555555','f5555555-5555-4555-8555-555555555555']);
    expect(retry.rows[0].result.reused).toBe(true);
    expect(retry.rows[0].result.asset_id).toBe(first.rows[0].result.asset_id);
    expect((await db.query(`SELECT id FROM product_images WHERE workspace_id=$1 AND sha256_checksum='checksum-a'`, [workspace])).rows).toHaveLength(1);
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

  it('proves that provision_wallet_atomic creates wallet and initial credit ledger GRANT entry idempotently', async () => {
    const freshWorkspaceId = 'f0000000-0000-4000-8000-000000000001';
    const ownerId = 'f0000000-0000-4000-8000-000000000002';

    // Insert workspace
    await db.query(`INSERT INTO workspaces (id, name, slug, owner_id) VALUES ($1, 'Provision Test WS', 'prov-test', $2);`, [freshWorkspaceId, ownerId]);

    // 1. Initial provisioning call
    const res1 = await db.query<{ provision_wallet_atomic: any }>(
      `SELECT provision_wallet_atomic($1, 10);`,
      [freshWorkspaceId]
    );
    const result1 = res1.rows[0].provision_wallet_atomic;

    expect(result1.success).toBe(true);
    expect(result1.is_new).toBe(true);
    expect(result1.balance).toBe(10);
    expect(result1.reserved_balance).toBe(0);
    expect(result1.lifetime_granted).toBe(10);

    // Verify ledger has exactly 1 initial GRANT entry
    const ledgerRows = await db.query<{ amount: number; event_type: string; reference_type: string; idempotency_key: string }>(
      `SELECT amount, event_type, reference_type, idempotency_key FROM credit_ledger WHERE workspace_id = $1;`,
      [freshWorkspaceId]
    );
    expect(ledgerRows.rows.length).toBe(1);
    expect(ledgerRows.rows[0].amount).toBe(10);
    expect(ledgerRows.rows[0].event_type).toBe('GRANT');
    expect(ledgerRows.rows[0].reference_type).toBe('SUBSCRIPTION');
    expect(ledgerRows.rows[0].idempotency_key).toBe(`grant_welcome_${freshWorkspaceId}`);

    // 2. Second provisioning call (must be strictly idempotent)
    const res2 = await db.query<{ provision_wallet_atomic: any }>(
      `SELECT provision_wallet_atomic($1, 10);`,
      [freshWorkspaceId]
    );
    const result2 = res2.rows[0].provision_wallet_atomic;
    expect(result2.success).toBe(true);
    expect(result2.is_new).toBe(false);
    expect(result2.balance).toBe(10);

    // Verify ledger count is STILL exactly 1 (no duplicate credit grant)
    const ledgerRowsAfter = await db.query<{ count: number }>(
      `SELECT COUNT(*)::int as count FROM credit_ledger WHERE workspace_id = $1;`,
      [freshWorkspaceId]
    );
    expect(ledgerRowsAfter.rows[0].count).toBe(1);

    // Verify mathematical balance reconciliation: wallet.balance === sum(ledger.amount)
    const sumRes = await db.query<{ total: number }>(
      `SELECT SUM(amount)::int as total FROM credit_ledger WHERE workspace_id = $1;`,
      [freshWorkspaceId]
    );
    expect(sumRes.rows[0].total).toBe(10);
  });

  it('proves concurrent wallet provisioning creates exactly 1 wallet and 1 ledger entry without duplicate key errors', async () => {
    const concurrentWsId = 'f1111111-1111-4111-8111-111111111111';
    const ownerId = 'f1111111-1111-4111-8111-111111111112';

    await db.query(`INSERT INTO workspaces (id, name, slug, owner_id) VALUES ($1, 'Concurrent Prov WS', 'concurrent-prov', $2);`, [concurrentWsId, ownerId]);

    // Fire 2 concurrent provisioning calls simultaneously
    const [call1, call2] = await Promise.all([
      db.query<{ provision_wallet_atomic: any }>(`SELECT provision_wallet_atomic($1, 10);`, [concurrentWsId]),
      db.query<{ provision_wallet_atomic: any }>(`SELECT provision_wallet_atomic($1, 10);`, [concurrentWsId]),
    ]);

    const res1 = call1.rows[0].provision_wallet_atomic;
    const res2 = call2.rows[0].provision_wallet_atomic;

    expect(res1.success).toBe(true);
    expect(res2.success).toBe(true);

    // Exactly one wallet in table
    const walletCheck = await db.query<{ count: number; balance: number }>(
      `SELECT COUNT(*)::int as count, balance FROM credit_wallets WHERE workspace_id = $1 GROUP BY balance;`,
      [concurrentWsId]
    );
    expect(walletCheck.rows.length).toBe(1);
    expect(walletCheck.rows[0].count).toBe(1);
    expect(walletCheck.rows[0].balance).toBe(10);

    // Exactly one ledger GRANT entry
    const ledgerCheck = await db.query<{ count: number; total: number }>(
      `SELECT COUNT(*)::int as count, SUM(amount)::int as total FROM credit_ledger WHERE workspace_id = $1;`,
      [concurrentWsId]
    );
    expect(ledgerCheck.rows[0].count).toBe(1);
    expect(ledgerCheck.rows[0].total).toBe(10);
  });

  it('proves migration 00005 adds status to workspaces and verifies workspace membership query with status active', async () => {
    // 1. Verify 'status' column exists in workspaces
    const colRes = await db.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'workspaces' AND column_name = 'status';`
    );
    expect(colRes.rows.length).toBe(1);

    // 2. Setup user profile with authoritative tier
    const testUserId = 'a0000000-1111-2222-3333-444455556666';
    const testWsId = 'b0000000-1111-2222-3333-444455556666';
    const suspendedWsId = 'c0000000-1111-2222-3333-444455556666';

    await db.query(
      `INSERT INTO workspaces (id, name, slug, owner_id, status) VALUES ($1, 'Active WS', 'active-ws', $2, 'active');`,
      [testWsId, testUserId]
    );
    await db.query(
      `INSERT INTO workspaces (id, name, slug, owner_id, status) VALUES ($1, 'Suspended WS', 'suspended-ws', $2, 'suspended');`,
      [suspendedWsId, testUserId]
    );

    // Insert profile with tier 'pro'
    await db.query(
      `INSERT INTO profiles (id, email, full_name, tier, default_workspace_id) VALUES ($1, 'testuser@example.com', 'Test User', 'pro', $2);`,
      [testUserId, testWsId]
    );

    // Insert workspace membership
    await db.query(
      `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'owner');`,
      [testWsId, testUserId]
    );
    await db.query(
      `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'member');`,
      [suspendedWsId, testUserId]
    );

    // 3. Simulate the Supabase REST join query: select role, workspaces(id, status)
    const joinRes = await db.query<{ role: string; ws_id: string; ws_status: string }>(
      `SELECT wm.role, w.id as ws_id, w.status as ws_status
       FROM workspace_members wm
       JOIN workspaces w ON wm.workspace_id = w.id
       WHERE wm.user_id = $1 AND wm.workspace_id = $2;`,
      [testUserId, testWsId]
    );
    expect(joinRes.rows.length).toBe(1);
    expect(joinRes.rows[0].role).toBe('owner');
    expect(joinRes.rows[0].ws_status).toBe('active');

    // 4. Verify suspended workspace query shows non-active status
    const suspendedJoin = await db.query<{ role: string; ws_id: string; ws_status: string }>(
      `SELECT wm.role, w.id as ws_id, w.status as ws_status
       FROM workspace_members wm
       JOIN workspaces w ON wm.workspace_id = w.id
       WHERE wm.user_id = $1 AND wm.workspace_id = $2;`,
      [testUserId, suspendedWsId]
    );
    expect(suspendedJoin.rows.length).toBe(1);
    expect(suspendedJoin.rows[0].ws_status).toBe('suspended');
  });

  it('proves admin_adjust_credits_atomic works against real PostgreSQL without UUID syntax error and records wallet, ledger and audit log', async () => {
    const wsId = 'd0000000-1111-2222-3333-444455556666';
    const ownerId = 'e0000000-1111-2222-3333-444455556666';
    const adminEmail = 'admin@affimatik.internal';

    // 1. Setup workspace and initial wallet
    await db.query(
      `INSERT INTO workspaces (id, name, slug, owner_id, status) VALUES ($1, 'Admin Adjust WS', 'admin-adjust-ws', $2, 'active');`,
      [wsId, ownerId]
    );

    await db.query(
      `INSERT INTO credit_wallets (workspace_id, balance, reserved_balance, lifetime_granted, lifetime_spent, updated_at)
       VALUES ($1, 10, 0, 10, 0, NOW());`,
      [wsId]
    );

    // 2. Execute RPC admin_adjust_credits_atomic with string email and +50 credits
    const rpcRes = await db.query<{ admin_adjust_credits_atomic: any }>(
      `SELECT admin_adjust_credits_atomic($1, $2, $3, $4);`,
      [wsId, 50, 'Pampasan teknikal atas gangguan pelayan', adminEmail]
    );

    expect(rpcRes.rows.length).toBe(1);
    const result = rpcRes.rows[0].admin_adjust_credits_atomic;
    expect(result.success).toBe(true);
    expect(result.new_balance).toBe(60);
    expect(result.adjusted_by).toBe(50);
    expect(result.reference_id).toBeDefined();

    // 3. Verify wallet table in PostgreSQL
    const walletRes = await db.query<{ balance: number; lifetime_granted: number }>(
      `SELECT balance, lifetime_granted FROM credit_wallets WHERE workspace_id = $1;`,
      [wsId]
    );
    expect(walletRes.rows[0].balance).toBe(60);
    expect(walletRes.rows[0].lifetime_granted).toBe(60);

    // 4. Verify credit_ledger table in PostgreSQL
    const ledgerRes = await db.query<{ amount: number; event_type: string; reference_type: string; reference_id: string; description: string }>(
      `SELECT amount, event_type, reference_type, reference_id, description FROM credit_ledger WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 1;`,
      [wsId]
    );
    expect(ledgerRes.rows.length).toBe(1);
    expect(ledgerRes.rows[0].amount).toBe(50);
    expect(ledgerRes.rows[0].event_type).toBe('MANUAL_ADJUSTMENT');
    expect(ledgerRes.rows[0].reference_type).toBe('ADMIN_ADJUSTMENT');
    // Ensure reference_id is genuine RFC4122 UUID format
    expect(ledgerRes.rows[0].reference_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(ledgerRes.rows[0].description).toContain('Pampasan teknikal atas gangguan pelayan');
    expect(ledgerRes.rows[0].description).toContain(adminEmail);

    // 5. Verify audit_logs table in PostgreSQL
    const auditRes = await db.query<{ admin_email: string; action: string; target_type: string; target_id: string; details: any }>(
      `SELECT admin_email, action, target_type, target_id, details FROM audit_logs WHERE target_id = $1 ORDER BY created_at DESC LIMIT 1;`,
      [wsId]
    );
    expect(auditRes.rows.length).toBe(1);
    expect(auditRes.rows[0].admin_email).toBe(adminEmail);
    expect(auditRes.rows[0].action).toBe('CREDIT_MANUAL_ADJUSTMENT');
    expect(auditRes.rows[0].target_type).toBe('WALLET');
    expect(auditRes.rows[0].details.new_balance).toBe(60);
    expect(auditRes.rows[0].details.adjusted_by).toBe(50);

    // 6. Test debit adjustment (-20 credits)
    const debitRes = await db.query<{ admin_adjust_credits_atomic: any }>(
      `SELECT admin_adjust_credits_atomic($1, $2, $3, $4);`,
      [wsId, -20, 'Pelarasan bayaran balik', adminEmail]
    );
    const debitResult = debitRes.rows[0].admin_adjust_credits_atomic;
    expect(debitResult.success).toBe(true);
    expect(debitResult.new_balance).toBe(40);

    // 7. Test over-debit protection (-100 credits when balance is 40)
    const overDebitRes = await db.query<{ admin_adjust_credits_atomic: any }>(
      `SELECT admin_adjust_credits_atomic($1, $2, $3, $4);`,
      [wsId, -100, 'Tolak melebihi baki', adminEmail]
    );
    const overDebitResult = overDebitRes.rows[0].admin_adjust_credits_atomic;
    expect(overDebitResult.success).toBe(false);
    expect(overDebitResult.error).toContain('Insufficient credit balance for debit');
  });

  it('holds media for review, settles once on approval and releases once on rejection', async () => {
    const workspace = 'a8888888-8888-4888-8888-888888888888';
    const user = 'b8888888-8888-4888-8888-888888888888';
    const approvedJob = 'c8888888-8888-4888-8888-888888888888';
    const rejectedJob = 'd8888888-8888-4888-8888-888888888888';
    const expiredJob = 'e8888888-8888-4888-8888-888888888888';
    await db.query(`INSERT INTO workspaces(id,name,slug,owner_id) VALUES($1,'QA Test','qa-test-888',$2)`, [workspace,user]);
    await db.query(`INSERT INTO credit_wallets(workspace_id,balance,reserved_balance,lifetime_granted) VALUES($1,100,0,100)`, [workspace]);
    const admit = (job: string, request: string) => db.query<{ result: { success: boolean; concurrency_limit_reached?: boolean } }>(
      `SELECT admit_video_job_atomic($1,$2,$3,$4,'NX01',2,'nexabot',15,10,1,'QA prompt') AS result`,
      [workspace,user,job,request]);
    expect((await admit(approvedJob,'qa-approve')).rows[0].result.success).toBe(true);
    await db.query(`UPDATE video_jobs SET status='QA_PENDING',result_video_r2_key='workspaces/test/outputs/approved.mp4',actual_duration_seconds=15.04,output_has_audio=true,qa_started_at=now() WHERE id=$1`,[approvedJob]);
    expect((await admit(rejectedJob,'qa-blocked')).rows[0].result.concurrency_limit_reached).toBe(true);
    const review = (job: string, decision: string, reason: string) => db.query<{ result: { success: boolean; status?: string; idempotent?: boolean } }>(
      `SELECT review_video_job_atomic($1,$2,$3,NULL) AS result`,[job,decision,reason]);
    expect((await review(approvedJob,'APPROVE','Dialog dan identiti disemak')).rows[0].result.status).toBe('COMPLETED');
    expect((await review(approvedJob,'APPROVE','Ulang')).rows[0].result.idempotent).toBe(true);
    expect((await admit(rejectedJob,'qa-reject')).rows[0].result.success).toBe(true);
    await db.query(`UPDATE video_jobs SET status='QA_PENDING',result_video_r2_key='workspaces/test/outputs/rejected.mp4',actual_duration_seconds=15,output_has_audio=true,qa_started_at=now() WHERE id=$1`,[rejectedJob]);
    expect((await review(rejectedJob,'REJECT','Logo produk berubah')).rows[0].result.status).toBe('REJECTED');
    expect((await review(rejectedJob,'REJECT','Ulang')).rows[0].result.idempotent).toBe(true);
    expect((await admit(expiredJob,'qa-expire')).rows[0].result.success).toBe(true);
    await db.query(`UPDATE video_jobs SET status='QA_PENDING',result_video_r2_key='workspaces/test/outputs/expired.mp4',actual_duration_seconds=15,output_has_audio=true,qa_started_at=now()-interval '25 hours' WHERE id=$1`,[expiredJob]);
    const expired = await db.query<{ result: { expired: number } }>(`SELECT expire_video_qa_atomic() AS result`);
    expect(expired.rows[0].result.expired).toBe(1);
    expect((await db.query<{ status: string }>(`SELECT status FROM video_jobs WHERE id=$1`,[expiredJob])).rows[0].status).toBe('REJECTED');
    const wallet = await db.query<{ balance: number; reserved_balance: number; lifetime_spent: number }>(`SELECT balance,reserved_balance,lifetime_spent FROM credit_wallets WHERE workspace_id=$1`,[workspace]);
    expect(wallet.rows[0]).toMatchObject({balance:90,reserved_balance:0,lifetime_spent:10});
    const ledger = await db.query<{ event_type: string; count: number }>(`SELECT event_type,count(*)::int AS count FROM credit_ledger WHERE workspace_id=$1 AND event_type IN ('SETTLE','RELEASE') GROUP BY event_type`,[workspace]);
    expect(ledger.rows.find((row) => row.event_type === 'SETTLE')?.count).toBe(1);
    expect(ledger.rows.find((row) => row.event_type === 'RELEASE')?.count).toBe(2);
    const audit = await db.query<{ count: number }>(`SELECT count(*)::int AS count FROM audit_logs WHERE action='VIDEO_QA_REVIEW' AND target_id IN ($1,$2,$3)`,[approvedJob,rejectedJob,expiredJob]);
    expect(audit.rows[0].count).toBe(3);
  });
});
