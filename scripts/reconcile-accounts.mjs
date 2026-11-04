#!/usr/bin/env node
/**
 * AFFIMATIK by Pawarna — CLI Account Reconciliation Runner
 * Run: node scripts/reconcile-accounts.mjs
 */

import { reconcileOrphanAccounts } from '../src/lib/db/reconcile.ts';

async function run() {
  console.log('[Reconcile Script] Scanning and reconciling accounts...');
  const res = await reconcileOrphanAccounts();
  console.log(JSON.stringify(res, null, 2));
}

run().catch(console.error);
