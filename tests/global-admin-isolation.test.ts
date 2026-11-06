import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { createSessionToken } from '../src/lib/auth/session';
import { GET as operations } from '../src/app/api/admin/operations/route';
import { GET as finances } from '../src/app/api/admin/finances/route';
import { GET as diagnostics } from '../src/app/api/admin/diagnostics/route';

describe('Global admin isolation', () => {
  it('denies workspace admins access to platform-wide orders, finances and diagnostics', async () => {
    const token = await createSessionToken({ userId: 'local-admin', email: 'admin@example.test', fullName: 'Workspace Admin', workspaceId: 'ws-1', role: 'admin', tier: 'starter' });
    const request = (path: string) => new NextRequest(`http://localhost${path}`, { headers: { cookie: `affimatik_session=${token}` } });
    expect((await operations(request('/api/admin/operations?view=orders'))).status).toBe(403);
    expect((await finances(request('/api/admin/finances'))).status).toBe(403);
    expect((await diagnostics(request('/api/admin/diagnostics'))).status).toBe(403);
  });
});
