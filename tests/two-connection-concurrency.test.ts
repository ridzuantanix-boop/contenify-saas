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

    // Apply migrations 1 through 5
    const migrationsDir = path.resolve(process.cwd(), 'supabase/migrations');
    const migrationFiles = [
      '00001_initial_schema.sql',
      '00002_atomic_credit_and_job_security.sql',
      '00003_secure_financial_rpc_and_job_admission.sql',
      '00004_fix_migration_compatibility_and_concurrency.sql',
      '00005_workspace_status_and_alignment.sql',
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
});
