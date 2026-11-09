import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const base = process.env.AFFIMATIK_SAMPLE_BASE || 'https://affimatik.online';
const release = '8.1-premium-20261109';
const styles = [
  'NX01', 'NX02', 'NX03', 'NX05', 'NX07', 'NX09', 'NX10',
  'RH01', 'RH02', 'RH03', 'RH04', 'RH17', 'RH19',
  'NX11', 'NX12', 'NX13', 'NX14', 'NX15', 'NX16', 'NX17',
];

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const results = [];
for (const id of styles) {
  const local = readFileSync(resolve('public', 'style-previews', id, 'sample-v6.mp4'));
  const response = await fetch(`${base}/style-previews/${id}/sample-v6.mp4?v=${release}`, { cache: 'no-store' });
  const remote = Buffer.from(await response.arrayBuffer());
  results.push({
    id,
    status: response.status,
    bytes: remote.length,
    localBytes: local.length,
    hash: sha256(remote),
    localHash: sha256(local),
    matches: response.ok && remote.length === local.length && sha256(remote) === sha256(local),
  });
}

const evidence = {
  checkedAt: new Date().toISOString(),
  base,
  release,
  passed: results.filter((item) => item.matches).length,
  failed: results.filter((item) => !item.matches).length,
  results,
};
console.log(JSON.stringify(evidence, null, 2));
if (evidence.failed > 0) process.exitCode = 1;
