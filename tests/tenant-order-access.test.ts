import { beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as verifyOrder } from '../src/app/api/billing/verify-order/route';
import { createSessionToken } from '../src/lib/auth/session';
import { DurableStore } from '../src/lib/db/store';

describe('Order tenant isolation', () => {
  beforeEach(() => DurableStore.resetForTesting());

  it('rejects another workspace owner or admin while allowing the order workspace', async () => {
    const order = await DurableStore.createOrder({
      workspaceId: 'ws-buyer', userId: 'user-buyer', planId: 'plan_starter',
      amountMyr: 49, creditsGranted: 100,
    });
    for (const role of ['owner', 'admin'] as const) {
      const token = await createSessionToken({ userId: 'other-user', email: 'other@example.test', fullName: 'Other', workspaceId: 'ws-other', role, tier: 'free' });
      const response = await verifyOrder(new NextRequest(`http://localhost/api/billing/verify-order?orderId=${order.id}`, { headers: { cookie: `affimatik_session=${token}` } }));
      expect(response.status).toBe(403);
    }
    const buyer = await createSessionToken({ userId: 'user-buyer', email: 'buyer@example.test', fullName: 'Buyer', workspaceId: 'ws-buyer', role: 'owner', tier: 'free' });
    const response = await verifyOrder(new NextRequest(`http://localhost/api/billing/verify-order?orderId=${order.id}`, { headers: { cookie: `affimatik_session=${buyer}` } }));
    expect(response.status).toBe(200);
  });
});
