import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import pg from 'pg';
import { decryptArchiveStream, verifyArchive, sha256File } from './archive-crypto.mjs';

const dir = resolve(process.argv[2] || '');
const key = Buffer.from(process.env.AFFIMATIK_BACKUP_AES_KEY || '', 'base64');
if (!process.argv[2] || key.length !== 32) throw new Error('Direktori backup atau kunci AES tiada.');
const receipt = JSON.parse(readFileSync(join(dir, 'receipt.json'), 'utf8'));
if (receipt.projectRef !== 'oudxnvazrdmnxdndpgmy' || receipt.verified !== true) throw new Error('Receipt backup tidak sah.');
if (await sha256File(join(dir, receipt.manifest.file)) !== receipt.manifest.sha256 ||
    await sha256File(join(dir, receipt.database.file)) !== receipt.database.sha256) {
  throw new Error('Hash receipt dan backup tidak sepadan.');
}

function encryptedStream(name) {
  return decryptArchiveStream(join(dir, name), key);
}

async function readDecrypted(name) {
  const chunks = [];
  await pipeline(encryptedStream(name), new Writable({ write(chunk, _encoding, callback) { chunks.push(chunk); callback(); } }));
  return Buffer.concat(chunks);
}

async function verifyPlain(entry) {
  await verifyArchive(join(dir, entry.file), key, entry);
}

function run(bin, args, input) {
  return new Promise((done, fail) => {
    const child = spawn(bin, args, { stdio: [input ? 'pipe' : 'ignore', 'pipe', 'pipe'] });
    let output = '', error = '';
    child.stdout.on('data', chunk => { output = (output + chunk.toString()).slice(-4000); });
    child.stderr.on('data', chunk => { error = (error + chunk.toString()).slice(-4000); });
    if (input) pipeline(input, child.stdin).catch(fail);
    child.on('error', fail);
    child.on('close', code => code === 0 ? done(output) : fail(new Error(`${bin} exit ${code}: ${error}`)));
  });
}

const manifest = JSON.parse((await readDecrypted(receipt.manifest.file)).toString('utf8'));
if (manifest.projectRef !== receipt.projectRef || manifest.objects.length !== receipt.objects) throw new Error('Manifest/receipt tidak sepadan.');
for (const entry of [manifest.database, ...manifest.objects]) await verifyPlain(entry);
console.log(`Penyahsulitan dan hash disahkan: database + ${manifest.objects.length} objek Storage.`);

const restoreBin = process.env.PG_RESTORE_BIN;
const psqlBin = process.env.PSQL_BIN;
if (!restoreBin || !psqlBin) throw new Error('pg_restore/psql tempatan tiada.');
const local = { host: '127.0.0.1', port: 55434, user: 'postgres', password: process.env.AFFIMATIK_RESTORE_DB_PASSWORD, database: 'postgres' };
if (!local.password) throw new Error('Kata laluan kluster restore tempatan tiada.');
const admin = new pg.Client(local);
await admin.connect();
const database = `affimatik_rehearsal_${new Date().toISOString().replace(/[-:TZ.]/g, '')}`;
try {
  for (const role of ['anon', 'authenticated', 'service_role', 'supabase_auth_admin', 'supabase_storage_admin', 'authenticator', 'dashboard_user']) {
    if (!(await admin.query('SELECT 1 FROM pg_roles WHERE rolname=$1', [role])).rowCount) await admin.query(`CREATE ROLE ${role}`);
  }
  await admin.query(`CREATE DATABASE ${database} ENCODING 'UTF8'`);
} finally { await admin.end(); }

const conn = ['-h', '127.0.0.1', '-p', '55434', '-U', 'postgres', '-d', database];
try {
// A new PostgreSQL database contains public by default; the production dump
// creates that schema itself. Remove only the empty rehearsal copy first.
await run(psqlBin, [...conn, '-v', 'ON_ERROR_STOP=1', '-c', 'DROP SCHEMA public CASCADE']);
await run(psqlBin, [...conn, '-v', 'ON_ERROR_STOP=1', '-c', 'CREATE SCHEMA extensions']);
await run(psqlBin, [...conn, '-v', 'ON_ERROR_STOP=1', '-c', 'CREATE EXTENSION "uuid-ossp" WITH SCHEMA extensions']);
await run(psqlBin, [...conn, '-v', 'ON_ERROR_STOP=1', '-c', 'CREATE EXTENSION pgcrypto WITH SCHEMA extensions']);
await run(restoreBin, [...conn, '--no-owner', '--no-acl', '--exit-on-error'], encryptedStream(manifest.database.file));
const check = new pg.Client({ ...local, database });
await check.connect();
async function snapshot() {
  return (await check.query(`SELECT
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
}
try {
  const restored = await snapshot();
  for (const key of Object.keys(manifest.baseline)) {
    if (String(restored[key]) !== String(manifest.baseline[key])) throw new Error(`Restore mengubah ${key}: ${restored[key]} vs ${manifest.baseline[key]}`);
  }
  const applied = [];
  const migrationSelection = process.env.AFFIMATIK_REHEARSAL_MIGRATIONS?.trim().toLowerCase();
  const requestedMigrations = !migrationSelection || migrationSelection === 'none'
    ? []
    : process.env.AFFIMATIK_REHEARSAL_MIGRATIONS
    ? process.env.AFFIMATIK_REHEARSAL_MIGRATIONS.split(',').map(value => Number(value.trim())).filter(Number.isInteger)
    : [];
  if (migrationSelection && migrationSelection !== 'none' && !requestedMigrations.length) throw new Error('Senarai migration rehearsal kosong.');
  for (const number of requestedMigrations) {
    const prefix = `000${number}_`;
    const { readdirSync } = await import('node:fs');
    const file = readdirSync('supabase/migrations').find(name => name.startsWith(prefix) && name.endsWith('.sql'));
    if (!file) throw new Error(`Migration ${number} tidak ditemui.`);
    await run(psqlBin, [...conn, '-v', 'ON_ERROR_STOP=1', '-f', join('supabase/migrations', file)]);
    applied.push(file);
  }
  const after = await snapshot();
  for (const key of Object.keys(manifest.baseline)) {
    if (String(after[key]) !== String(manifest.baseline[key])) throw new Error(`Migration mengubah ${key}: ${after[key]} vs ${manifest.baseline[key]}`);
  }
  const v7Schema = (await check.query(`SELECT
    to_regclass('public.background_assets')::text AS backgrounds,
    to_regclass('public.creator_presets')::text AS presets,
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='video_jobs' AND column_name='background_id') AS job_background,
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='video_jobs' AND column_name='creator_preset_id') AS job_preset`)).rows[0];
  if (v7Schema.backgrounds !== 'background_assets' || v7Schema.presets !== 'creator_presets' || !v7Schema.job_background || !v7Schema.job_preset) {
    throw new Error(`Skema V7 tidak lengkap selepas rehearsal: ${JSON.stringify(v7Schema)}`);
  }
  const v9Schema = (await check.query(`SELECT
    to_regclass('public.creator_profiles')::text AS creator_profiles,
    to_regclass('public.product_folders')::text AS product_folders,
    to_regclass('public.auto_factory_batches')::text AS auto_factory_batches,
    to_regclass('public.daily_auto_schedules')::text AS daily_auto_schedules`)).rows[0];
  if (!v9Schema.creator_profiles || !v9Schema.product_folders || !v9Schema.auto_factory_batches || !v9Schema.daily_auto_schedules) {
    throw new Error(`Skema V9 tidak lengkap selepas rehearsal: ${JSON.stringify(v9Schema)}`);
  }
  const receiptOut = { database, sourceBackup: dir, mode: applied.length ? 'restore-and-explicit-migrations' : 'restore-only', applied, baseline: manifest.baseline, after, verifiedAt: new Date().toISOString() };
  writeFileSync(join(dir, 'restore-rehearsal.json'), JSON.stringify(receiptOut, null, 2));
  console.log(`Restore dan migrations ${applied.join(', ')} lulus pada database terasing ${database}.`);
} finally { await check.end(); }
} finally {
  const cleanup = new pg.Client(local);
  await cleanup.connect();
  try { await cleanup.query(`DROP DATABASE ${database} WITH (FORCE)`); }
  finally { await cleanup.end(); }
}
