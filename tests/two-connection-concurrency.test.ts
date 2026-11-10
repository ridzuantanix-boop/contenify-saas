import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import EmbeddedPostgres from 'embedded-postgres';
import { Client } from 'pg';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { createServer } from 'net';

describe('Real PostgreSQL Two-Connection Concurrency & Double-Checked Locking Suite', () => {
  let pgServer: EmbeddedPostgres;
  let dbDir: string;
  let client1: Client;
  let client2: Client;
  let pgPort: number;

  beforeAll(async () => {
    pgPort = await new Promise<number>((resolve, reject) => {
      const server = createServer();
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        const port = typeof address === 'object' && address ? address.port : 0;
        server.close(() => resolve(port));
      });
    });
    // 1. Setup disposable real PostgreSQL instance
    dbDir = path.join(os.tmpdir(), `pg_concurrency_${Date.now()}`);
    pgServer = new EmbeddedPostgres({
      databaseDir: dbDir,
      port: pgPort,
      authMethod: 'password',
      password: 'password',
      persistent: false,
    });

    await pgServer.initialise();
    await pgServer.start();

    // 2. Setup schema using administrative connection
    const adminClient = new Client({
      host: '127.0.0.1',
      port: pgPort,
      user: 'postgres',
      database: 'postgres',
      password: 'password',
    });
    await adminClient.connect();

    // Load test stubs
    const stubsPath = path.resolve(process.cwd(), 'tests/helpers/supabase-stubs.sql');
    if (fs.existsSync(stubsPath)) {
      const stubsSql = fs.readFileSync(stubsPath, 'utf-8');
      await adminClient.query(stubsSql);
    }

    // Apply the production migration chain through V7.2.
    const migrationsDir = path.resolve(process.cwd(), 'supabase/migrations');
    const migrationFiles = [
      '00001_initial_schema.sql',
      '00002_atomic_credit_and_job_security.sql',
      '00003_secure_financial_rpc_and_job_admission.sql',
      '00004_fix_migration_compatibility_and_concurrency.sql',
      '00005_workspace_status_and_alignment.sql',
      '00006_billing_affiliates_and_financial_safety.sql','00007_fix_admin_credit_adjustment_uuid.sql',
      '00008_soft_launch_50_credits.sql','00009_add_whatsapp_to_profiles.sql','00010_fix_welcome_credit_ledger.sql',
      '00011_affiliate_application_policy.sql','00012_affiliate_ledger_and_assets.sql','00013_verified_account_provisioning.sql',
      '00014_close_public_data_access.sql','00015_customer_dashboard_metrics.sql','00016_verified_video_metadata.sql',
      '00017_refund_credit_integrity.sql','00018_affiliate_service_role_permissions.sql','00019_personalization_studio.sql',
      '00020_qr_express_checkout.sql','00021_nexabot_provider_retry.sql','00022_smart_nexabot_queue_and_costs.sql',
      '00023_v72_pricing_and_credit_buckets.sql',
      '00024_instant_qr_full_access.sql',
    ];

    for (const file of migrationFiles) {
      const filePath = path.join(migrationsDir, file);
      let sqlContent = fs.readFileSync(filePath, 'utf-8');
      await adminClient.query(sqlContent);
    }

    await adminClient.end();

    // 3. Connect two completely INDEPENDENT TCP client sessions
    client1 = new Client({
      host: '127.0.0.1',
      port: pgPort,
      user: 'postgres',
      database: 'postgres',
      password: 'password',
    });
    client2 = new Client({
      host: '127.0.0.1',
      port: pgPort,
      user: 'postgres',
      database: 'postgres',
      password: 'password',
    });

    await client1.connect();
    await client2.connect();

    // Verify independent process IDs (backend PIDs)
    const pid1 = await client1.query('SELECT pg_backend_pid() as pid;');
    const pid2 = await client2.query('SELECT pg_backend_pid() as pid;');
    expect(pid1.rows[0].pid).not.toBe(pid2.rows[0].pid);

    // Switch both connections to service_role to exercise production admission RPC
    await client1.query('SET ROLE service_role;');
    await client2.query('SET ROLE service_role;');
  }, 120000);

  afterAll(async () => {
    if (client1) await client1.end().catch(() => {});
    if (client2) await client2.end().catch(() => {});
    if (pgServer) await pgServer.stop().catch(() => {});
    try {
      if (dbDir && fs.existsSync(dbDir)) {
        fs.rmSync(dbDir, { recursive: true, force: true });
      }
    } catch {
      // Ignore transient Windows file handle release delay
    }
  });

  it('proves that two independent PostgreSQL connections submitting identical requests serialize safely without duplicate admission or race conditions', async () => {
    const testWsId = 'e1111111-2222-3333-4444-555555555555';
    const testUserId = 'e2222222-2222-3333-4444-555555555555';
    const clientRequestId = `req_tcp_concurrent_${Date.now()}`;

    // 1. Provision workspace and wallet
    await client1.query(
      `INSERT INTO workspaces (id, name, slug, owner_id) VALUES ($1, 'TCP Concurrency WS', $2, $3);`,
      [testWsId, `tcp-concurrency-${Date.now()}`, testUserId]
    );

    const provRes = await client1.query(
      `SELECT provision_wallet_atomic($1, 10);`,
      [testWsId]
    );
    expect(provRes.rows[0].provision_wallet_atomic.success).toBe(true);

    const jobIdA = 'aaaa1111-1111-4111-8111-111111111111';
    const jobIdB = 'bbbb2222-2222-4222-8222-222222222222';

    // 2. Fire two simultaneous admissions across two distinct TCP connections
    const [res1, res2] = await Promise.all([
      client1.query<{ admit_video_job_atomic: any }>(
        `SELECT admit_video_job_atomic($1, $2, $3, $4, 'NX01', 2, 'nexabot', 10, 10, 5, 'Prompt via TCP Client 1');`,
        [testWsId, testUserId, jobIdA, clientRequestId]
      ),
      client2.query<{ admit_video_job_atomic: any }>(
        `SELECT admit_video_job_atomic($1, $2, $3, $4, 'NX01', 2, 'nexabot', 10, 10, 5, 'Prompt via TCP Client 2');`,
        [testWsId, testUserId, jobIdB, clientRequestId]
      ),
    ]);

    const result1 = res1.rows[0].admit_video_job_atomic;
    const result2 = res2.rows[0].admit_video_job_atomic;

    // Both queries must succeed (zero unhandled exceptions or 23505 duplicate key violations)
    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);

    // Both connections MUST agree on the exact same authoritative job_id
    expect(result1.job_id).toBe(result2.job_id);

    // Exactly one must be admitted fresh (is_duplicate: false), and one must be duplicate (is_duplicate: true)
    const isDup1 = result1.is_duplicate;
    const isDup2 = result2.is_duplicate;
    expect([isDup1, isDup2].filter(Boolean).length).toBe(1);
    expect([isDup1, isDup2].filter((d) => !d).length).toBe(1);

    // 3. Verify exactly ONE video_jobs row was created in PostgreSQL
    const jobsRes = await client1.query(
      `SELECT id, status, client_request_id FROM video_jobs WHERE workspace_id = $1;`,
      [testWsId]
    );
    expect(jobsRes.rows.length).toBe(1);
    expect(jobsRes.rows[0].client_request_id).toBe(clientRequestId);

    // 4. Verify exactly ONE credit reservation was created
    const resvRes = await client1.query(
      `SELECT COUNT(*)::int as count, SUM(amount)::int as total FROM credit_reservations WHERE workspace_id = $1;`,
      [testWsId]
    );
    expect(resvRes.rows[0].count).toBe(1);
    expect(resvRes.rows[0].total).toBe(10);

    // 5. Verify wallet reserved_balance was incremented by exactly 10 (not 20!)
    const walletRes = await client1.query(
      `SELECT balance, reserved_balance FROM credit_wallets WHERE workspace_id = $1;`,
      [testWsId]
    );
    expect(walletRes.rows[0].balance).toBe(10);
    expect(walletRes.rows[0].reserved_balance).toBe(10);

    // 6. Verify audit ledger has exactly 1 GRANT (+10) and 1 RESERVE (-10)
    const ledgerRes = await client1.query(
      `SELECT event_type, amount FROM credit_ledger WHERE workspace_id = $1 ORDER BY created_at ASC;`,
      [testWsId]
    );
    expect(ledgerRes.rows.length).toBe(2);
    expect(ledgerRes.rows[0].event_type).toBe('GRANT');
    expect(ledgerRes.rows[0].amount).toBe(10);
    expect(ledgerRes.rows[1].event_type).toBe('RESERVE');
    expect(ledgerRes.rows[1].amount).toBe(-10);
  });

  it('serializes cron/API slot claims globally so four racing claims produce exactly three leases',async()=>{
    const workspaces=[] as Array<{ws:string;user:string;job:string}>;
    for(let i=1;i<=4;i++){
      const row={ws:`a7500000-0000-4000-8000-00000000000${i}`,user:`b7500000-0000-4000-8000-00000000000${i}`,job:`c7500000-0000-4000-8000-00000000000${i}`};workspaces.push(row);
      await client1.query(`INSERT INTO workspaces(id,name,slug,owner_id,status) VALUES($1,$2,$3,$4,'active')`,[row.ws,`Race ${i}`,`race-v72-${i}`,row.user]);
      await client1.query(`SELECT provision_wallet_atomic($1,20)`,[row.ws]);
      const admitted=await client1.query<{result:any}>(`SELECT admit_nexabot_job_to_queue_atomic($1,$2,$3,$4,'NX01',2,'nexabot',15,10,5,'prompt','{}'::jsonb) AS result`,[row.ws,row.user,row.job,`race-${i}`]);
      expect(admitted.rows[0].result.status).toBe('QUEUED');
    }
    const claim=async(client:Client)=>(await client.query<{result:any}>(`SELECT claim_next_nexabot_job_atomic(3,180) AS result`)).rows[0].result;
    const first=await Promise.all([claim(client1),claim(client2)]);
    const second=await Promise.all([claim(client1),claim(client2)]);
    const all=[...first,...second];
    expect(all.filter(x=>x.claimed)).toHaveLength(3);
    expect(new Set(all.filter(x=>x.claimed).map(x=>x.job_id)).size).toBe(3);
    expect(all.some(x=>x.capacity_full===true)).toBe(true);
    const active=await client1.query<{count:number}>(`SELECT count(*)::int AS count FROM video_jobs WHERE provider='nexabot' AND status='SUBMITTING' AND dispatch_lease_until>now()`);
    expect(active.rows[0].count).toBe(3);
  });

  it('serializes simultaneous receipt submissions so a provisional order grants credits exactly once',async()=>{
    const ws='a7600000-0000-4000-8000-000000000001',user='b7600000-0000-4000-8000-000000000001',order='d7600000-0000-4000-8000-000000000001';
    await client1.query(`INSERT INTO workspaces(id,name,slug,owner_id,status) VALUES($1,'QR Race','qr-race-v1',$2,'active')`,[ws,user]);
    await client1.query(`INSERT INTO profiles(id,email,tier,default_workspace_id) VALUES($1,'qr-race@example.test','free',$2)`,[user,ws]);
    await client1.query(`SELECT provision_wallet_atomic($1,20)`,[ws]);
    const created=(await client1.query<{result:any}>(`SELECT create_qr_order_atomic($1,$2,$3,'plan_starter',NULL) AS result`,[ws,user,order])).rows[0].result;
    expect(created.success).toBe(true);
    const submit=(client:Client)=>(client.query<{result:any}>(`SELECT provision_qr_order_atomic($1,$2,$3,'image/png',12000) AS result`,[order,'d'.repeat(64),`workspaces/${ws}/payment-evidence/${order}.png`]));
    const [a,b]=await Promise.all([submit(client1),submit(client2)]);
    const results=[a.rows[0].result,b.rows[0].result];
    expect(results.every(result=>result.success===true)).toBe(true);
    expect(results.filter(result=>result.credits_granted===500)).toHaveLength(1);
    expect(results.filter(result=>result.idempotent_replay===true)).toHaveLength(1);
    const wallet=await client1.query<{balance:number;lifetime_granted:number}>(`SELECT balance,lifetime_granted FROM credit_wallets WHERE workspace_id=$1`,[ws]);
    expect(wallet.rows[0]).toMatchObject({balance:520,lifetime_granted:520});
    const grants=await client1.query<{count:number}>(`SELECT count(*)::int AS count FROM credit_ledger WHERE reference_id=$1 AND event_type='GRANT'`,[order]);
    expect(grants.rows[0].count).toBe(1);
  });
});
