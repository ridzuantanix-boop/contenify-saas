import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { Readable } from 'node:stream';
import pg from 'pg';
import { encryptArchive, verifyArchive } from './archive-crypto.mjs';

const ref = 'oudxnvazrdmnxdndpgmy';
const host = 'aws-0-ap-northeast-1.pooler.supabase.com';
const url = `https://${ref}.supabase.co`;
const password = process.env.AFFIMATIK_BACKUP_DB_PASSWORD;
const serviceKey = process.env.AFFIMATIK_BACKUP_SERVICE_KEY;
const key = Buffer.from(process.env.AFFIMATIK_BACKUP_AES_KEY || '', 'base64');
const rootCertPath = process.env.AFFIMATIK_SUPABASE_CA;
if (!password || !serviceKey || key.length !== 32) throw new Error('Rahsia backup tempatan tidak lengkap.');
if (!rootCertPath) throw new Error('Sijil CA Supabase tidak dikonfigurasi.');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const dir = resolve('output', 'release', 'backups', stamp);
mkdirSync(dir, { recursive: true });

async function encrypt(source, name) {
  return { file: name, ...await encryptArchive(source, join(dir, name), key) };
}

async function verify(entry) {
  await verifyArchive(join(dir, entry.file), key, entry);
}

function headers() { return { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }; }
async function api(path, init = {}) {
  const response = await fetch(`${url}${path}`, { ...init, headers: { ...headers(), ...init.headers } });
  if (!response.ok) throw new Error(`Supabase Storage HTTP ${response.status} (${path.split('/').slice(0, 4).join('/')})`);
  return response;
}
function encodePath(path) { return path.split('/').map(encodeURIComponent).join('/'); }

async function listObjects(bucket, prefix = '') {
  const results = [];
  for (let offset = 0; ; offset += 1000) {
    const response = await api(`/storage/v1/object/list/${encodeURIComponent(bucket)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix, limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } }),
    });
    const page = await response.json();
    if (!Array.isArray(page)) throw new Error('Senarai objek Storage tidak sah.');
    for (const item of page) {
      if (typeof item.name !== 'string' || !item.name || item.name === '.' || item.name === '..' || item.name.includes('/')) throw new Error('Nama objek Storage tidak sah.');
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id) results.push(path);
      else results.push(...await listObjects(bucket, path));
    }
    if (page.length < 1000) break;
  }
  return results;
}

async function dumpDatabase() {
  const pgEnv = {
    ...process.env, PGPASSWORD: password, PGHOST: host, PGPORT: '5432',
    PGUSER: `postgres.${ref}`, PGDATABASE: 'postgres', PGSSLMODE: 'verify-full', PGSSLROOTCERT: rootCertPath,
  };
  const dumpArgs = ['pg_dump', '-Fc', '--no-owner', '--no-acl', '--schema=auth', '--schema=public', '--schema=storage'];
  const pgDumpBin = process.env.PG_DUMP_BIN;
  const child = pgDumpBin
    ? spawn(pgDumpBin, dumpArgs.slice(1), { env: pgEnv, stdio: ['ignore', 'pipe', 'pipe'] })
    : spawn('docker', ['run', '--rm', '-e', 'PGPASSWORD', '-e', 'PGHOST', '-e', 'PGPORT', '-e', 'PGUSER', '-e', 'PGDATABASE', '-e', 'PGSSLMODE', 'postgres:18', ...dumpArgs], { env: pgEnv, stdio: ['ignore', 'pipe', 'pipe'] });
  let diagnostic = '';
  child.stderr.on('data', chunk => { diagnostic = (diagnostic + chunk.toString()).slice(-2500); });
  const closed = new Promise((resolveClose, rejectClose) => {
    child.on('error', rejectClose);
    child.on('close', code => code === 0 ? resolveClose() : rejectClose(new Error(`pg_dump gagal (exit ${code}): ${diagnostic}`)));
  });
  const encrypted = await encrypt(child.stdout, 'database.custom.enc');
  await closed;
  return encrypted;
}

const client = new pg.Client({ host, port: 5432, user: `postgres.${ref}`, password, database: 'postgres', ssl: { ca: readFileSync(rootCertPath), rejectUnauthorized: true }, connectionTimeoutMillis: 15000 });
try {
  await client.connect();
  const baseline = (await client.query(`SELECT
    (SELECT count(*) FROM auth.users) AS auth_users,
    (SELECT count(*) FROM public.profiles) AS profiles,
    (SELECT count(*) FROM public.credit_wallets) AS wallets,
    (SELECT count(*) FROM public.credit_ledger) AS ledger_entries,
    (SELECT count(*) FROM public.orders) AS orders,
    (SELECT count(*) FROM public.products) AS products,
    (SELECT count(*) FROM public.product_images) AS product_images,
    (SELECT coalesce(sum(balance),0) FROM public.credit_wallets) AS wallet_balance,
    (SELECT coalesce(sum(reserved_balance),0) FROM public.credit_wallets) AS reserved_balance,
    (SELECT count(*) FROM public.video_jobs) AS jobs,
    (SELECT count(*) FROM storage.objects) AS storage_objects,
    (SELECT md5(coalesce(string_agg(id::text || '|' || coalesce(email,''), '~' ORDER BY id),'')) FROM auth.users) AS auth_identity_hash,
    (SELECT md5(coalesce(string_agg(id::text || '|' || coalesce(default_workspace_id::text,'') || '|' || coalesce(tier::text,''), '~' ORDER BY id),'')) FROM public.profiles) AS profile_identity_hash,
    (SELECT md5(coalesce(string_agg(id::text || '|' || workspace_id::text || '|' || balance::text || '|' || reserved_balance::text || '|' || lifetime_granted::text || '|' || lifetime_spent::text, '~' ORDER BY id),'')) FROM public.credit_wallets) AS wallet_row_hash,
    (SELECT md5(coalesce(string_agg(id::text || '|' || workspace_id::text || '|' || amount::text || '|' || event_type::text || '|' || idempotency_key, '~' ORDER BY id),'')) FROM public.credit_ledger) AS ledger_row_hash,
    (SELECT md5(coalesce(string_agg(id::text || '|' || workspace_id::text || '|' || plan_id || '|' || amount_myr::text || '|' || credits_granted::text || '|' || status, '~' ORDER BY id),'')) FROM public.orders) AS order_row_hash,
    (SELECT md5(coalesce(string_agg(id::text || '|' || workspace_id::text || '|' || name, '~' ORDER BY id),'')) FROM public.products) AS product_row_hash,
    (SELECT md5(coalesce(string_agg(id::text || '|' || workspace_id::text || '|' || coalesce(product_id::text,'') || '|' || r2_key || '|' || size_bytes::text, '~' ORDER BY id),'')) FROM public.product_images) AS product_image_row_hash,
    (SELECT md5(coalesce(string_agg(id::text || '|' || workspace_id::text || '|' || status::text || '|' || coalesce(result_video_url,'') || '|' || coalesce(result_video_r2_key,'') || '|' || required_credits::text, '~' ORDER BY id),'')) FROM public.video_jobs) AS job_row_hash`)).rows[0];
  const db = await dumpDatabase();
  const buckets = (await client.query('SELECT id FROM storage.buckets ORDER BY id')).rows;
  const objects = [];
  for (const bucket of buckets) {
    const bucketId = bucket.id;
    if (typeof bucketId !== 'string' || !bucketId) throw new Error('Bucket Storage tidak sah.');
    const paths = await listObjects(bucketId);
    for (const path of paths) {
      const response = await api(`/storage/v1/object/authenticated/${encodeURIComponent(bucketId)}/${encodePath(path)}`);
      const id = createHash('sha256').update(`${bucketId}/${path}`).digest('hex');
      objects.push({ bucket: bucketId, path, ...(await encrypt(Readable.fromWeb(response.body), `object-${id}.enc`)) });
    }
    console.log(`Bucket ${bucketId}: ${paths.length} objek dieksport.`);
  }
  if (objects.length !== Number(baseline.storage_objects)) throw new Error(`Bilangan objek Storage tidak sepadan: metadata=${baseline.storage_objects}, muat turun=${objects.length}.`);
  const manifest = { projectRef: ref, createdAt: new Date().toISOString(), baseline, database: db, objects };
  const manifestEntry = await encrypt(Readable.from([Buffer.from(JSON.stringify(manifest))]), 'manifest.json.enc');
  for (const entry of [db, ...objects, manifestEntry]) await verify(entry);
  const receipt = { projectRef: ref, createdAt: manifest.createdAt, database: { file: db.file, sha256: db.encryptedSha256 }, manifest: { file: manifestEntry.file, sha256: manifestEntry.encryptedSha256 }, buckets: buckets.length, objects: objects.length, verified: true };
  writeFileSync(join(dir, 'receipt.json'), JSON.stringify(receipt, null, 2));
  console.log(`Backup terenkripsi dan hash disahkan: ${dir}`);
  console.log(`Auth=${baseline.auth_users}, profiles=${baseline.profiles}, wallets=${baseline.wallets}, ledger=${baseline.ledger_entries}, orders=${baseline.orders}, jobs=${baseline.jobs}, products=${baseline.products}, media=${baseline.product_images}, Storage=${objects.length}.`);
} finally {
  await client.end().catch(() => {});
}
