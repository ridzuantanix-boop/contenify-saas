import { describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { encryptArchive, verifyArchive } from '../scripts/release/archive-crypto.mjs';

describe('encrypted production backup artifacts', () => {
  it('round-trips bytes and rejects a wrong key or changed ciphertext', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'affimatik-backup-crypto-'));
    const file = join(dir, 'fixture.enc');
    try {
      const key = randomBytes(32);
      const plaintext = randomBytes(1024 * 1024 + 37);
      const receipt = await encryptArchive(Readable.from([plaintext]), file, key);
      expect(receipt.plainBytes).toBe(plaintext.length);
      expect(readFileSync(file).includes(plaintext.subarray(0, 32))).toBe(false);
      await expect(verifyArchive(file, key, receipt)).resolves.toBeUndefined();
      await expect(verifyArchive(file, randomBytes(32), receipt)).rejects.toThrow();
      const tampered = readFileSync(file);
      tampered[100] ^= 1;
      writeFileSync(file, tampered);
      await expect(verifyArchive(file, key, receipt)).rejects.toThrow(/hash/i);
    } finally {
      unlinkSync(file);
      rmdirSync(dir);
    }
  });
});
