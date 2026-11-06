import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { createReadStream, createWriteStream, writeFileSync, appendFileSync, statSync, openSync, readSync, closeSync } from 'node:fs';
import { Transform, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export async function sha256File(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

export async function encryptArchive(source, path, key) {
  if (key.length !== 32) throw new Error('Kunci AES-256 tidak sah.');
  const iv = randomBytes(12);
  writeFileSync(path, Buffer.concat([Buffer.from('AFV1'), iv]));
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const plainHash = createHash('sha256');
  let plainBytes = 0;
  const tap = new Transform({ transform(chunk, _encoding, callback) {
    plainHash.update(chunk);
    plainBytes += chunk.length;
    callback(null, chunk);
  } });
  await pipeline(source, tap, cipher, createWriteStream(path, { flags: 'a' }));
  appendFileSync(path, cipher.getAuthTag());
  return { plainBytes, plainSha256: plainHash.digest('hex'), encryptedBytes: statSync(path).size, encryptedSha256: await sha256File(path) };
}

export function decryptArchiveStream(path, key) {
  if (key.length !== 32) throw new Error('Kunci AES-256 tidak sah.');
  const size = statSync(path).size;
  if (size < 33) throw new Error('Fail backup terlalu kecil.');
  const header = Buffer.alloc(16), tag = Buffer.alloc(16);
  const fd = openSync(path, 'r');
  try { readSync(fd, header, 0, 16, 0); readSync(fd, tag, 0, 16, size - 16); }
  finally { closeSync(fd); }
  if (header.subarray(0, 4).toString() !== 'AFV1') throw new Error('Format backup tidak sah.');
  const decipher = createDecipheriv('aes-256-gcm', key, header.subarray(4));
  decipher.setAuthTag(tag);
  return createReadStream(path, { start: 16, end: size - 17 }).pipe(decipher);
}

export async function verifyArchive(path, key, expected) {
  if (statSync(path).size !== expected.encryptedBytes || await sha256File(path) !== expected.encryptedSha256) {
    throw new Error('Saiz/hash fail backup terenkripsi tidak sepadan.');
  }
  const hash = createHash('sha256');
  let bytes = 0;
  await pipeline(decryptArchiveStream(path, key), new Writable({ write(chunk, _encoding, callback) {
    hash.update(chunk);
    bytes += chunk.length;
    callback();
  } }));
  if (bytes !== expected.plainBytes || hash.digest('hex') !== expected.plainSha256) {
    throw new Error('Saiz/hash data selepas nyahsulit tidak sepadan.');
  }
}
