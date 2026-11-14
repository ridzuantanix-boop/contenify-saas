import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { FREE_TRIAL, LAUNCH_PACK } from '../src/lib/billing/plans';

const root = process.cwd();
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('commercial sales page and disabled Free Trial', () => {
  it('disables the new-account trial without changing the Launch Pack', () => {
    expect(FREE_TRIAL.enabled).toBe(false);
    expect(FREE_TRIAL.credits).toBe(0);
    expect(FREE_TRIAL.videos).toBe(0);
    expect(LAUNCH_PACK.priceMyr).toBe(19);
    expect(LAUNCH_PACK.credits).toBe(150);
  });

  it('provisions new wallets with zero credits in every production recovery path', () => {
    const store = read('src/lib/db/store.ts');
    const reconcile = read('src/lib/db/reconcile.ts');
    expect(store).not.toContain('p_initial_balance: 20');
    expect(reconcile).not.toContain('p_initial_balance: 20');
    expect(store).toContain('p_initial_balance: 0');
    expect(reconcile).toContain('p_initial_balance: 0');
  });

  it('presents the RM19 offer and genuine style sample endpoints', () => {
    const landing = read('src/app/page.tsx');
    expect(landing).toContain('Dapatkan 15 Video — RM19');
    expect(landing).toContain('/api/style-samples/NX17');
    expect(landing).toContain("{ id: 'NX01'");
    expect(landing).toContain("{ id: 'RH03'");
    expect(landing).not.toContain('20 Kredit Percuma');
  });

  it('explains the beginner purchase flow without overstating payment verification', () => {
    const landing = read('src/app/page.tsx');
    expect(landing).toContain('Soalan yang selalu ditanya');
    expect(landing).toContain('tidak mengaktifkan langganan automatik');
    expect(landing).toContain('sah selama 180 hari');
    expect(landing).toContain('status ini bukan pengesahan bank');
    expect(landing).toContain('support@affimatik.online');
    expect(landing).toContain('tempahan kredit dilepaskan semula');
  });
});
