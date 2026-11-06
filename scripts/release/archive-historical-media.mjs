import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { encryptArchive, verifyArchive } from './archive-crypto.mjs';

const source = process.argv[2];
const key = Buffer.from(process.env.AFFIMATIK_BACKUP_AES_KEY || '', 'base64');
if (!source || key.length !== 32) throw new Error('CSV eksport Supabase atau kunci AES tiada.');
const lines = readFileSync(source, 'utf8').replace(/^\uFEFF/, '').trim().split(/\r?\n/);
const clean = value => value.replace(/^"|"$/g, '').replace(/""/g, '"');
if (lines.length !== 9 || clean(lines[0].split(',')[0]) !== 'id' || clean(lines[0].split(',')[1]) !== 'result_video_url') {
  throw new Error('Eksport sejarah mesti mengandungi tepat 8 job dengan lajur id,result_video_url.');
}
const rows = lines.slice(1).map(line => {
  const [id, url] = line.split(',').map(clean);
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('ID job sejarah tidak sah.');
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'hrekuraxzpiqymgcrjyb.supabase.co' ||
      !/^\/storage\/v1\/object\/public\/storage\/media\/2026\/11\/[0-9a-f-]{36}\.mp4$/i.test(parsed.pathname) ||
      parsed.search || parsed.hash) throw new Error('URL MP4 sejarah tidak dibenarkan.');
  return { id, url };
});
if (new Set(rows.map(row => row.id)).size !== rows.length) throw new Error('ID job sejarah berulang.');
const dir = resolve('output', 'release', 'historical-media', new Date().toISOString().replace(/[:.]/g, '-'));
mkdirSync(dir, { recursive: true });
const entries = [];
for (const row of rows) {
  const response = await fetch(row.url, { redirect: 'error' });
  if (!response.ok) {
    entries.push({ jobId: row.id, sourceUrl: row.url, status: 'unavailable', httpStatus: response.status });
    console.log(`Job ${entries.length}/${rows.length}: sumber MP4 tidak tersedia (HTTP ${response.status}).`);
    continue;
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 32 || bytes.length > 100 * 1024 * 1024 || bytes.toString('ascii', 4, 8) !== 'ftyp') {
    throw new Error(`MP4 job ${row.id} tidak sah atau terlalu besar.`);
  }
  const file = `job-${row.id}.mp4.enc`;
  const entry = { jobId: row.id, sourceUrl: row.url, status: 'archived', file, ...await encryptArchive(Readable.from([bytes]), join(dir, file), key) };
  await verifyArchive(join(dir, file), key, entry);
  entries.push(entry);
  console.log(`Job ${entries.length}/${rows.length}: ${entry.plainBytes} bytes disimpan dan disahkan.`);
}
const manifest = { projectRef: 'oudxnvazrdmnxdndpgmy', sourceProject: 'hrekuraxzpiqymgcrjyb', archivedAt: new Date().toISOString(), entries };
const manifestFile = `manifest-${randomUUID()}.json.enc`;
const manifestEntry = { file: manifestFile, ...await encryptArchive(Readable.from([Buffer.from(JSON.stringify(manifest))]), join(dir, manifestFile), key) };
await verifyArchive(join(dir, manifestFile), key, manifestEntry);
writeFileSync(join(dir, 'receipt.json'), JSON.stringify({ jobs: entries.length, archived: entries.filter(entry => entry.status === 'archived').length,
  unavailable: entries.filter(entry => entry.status === 'unavailable').length, encryptedManifest: manifestEntry,
  archivedAt: manifest.archivedAt, verified: true }, null, 2));
console.log(`Inventori sejarah terenkripsi: ${dir}. Media berjaya=${entries.filter(entry => entry.status === 'archived').length}, tidak tersedia=${entries.filter(entry => entry.status === 'unavailable').length}.`);
