export interface Env {
  APP_BASE_URL: string;
  CRON_SECRET: string;
}

export interface ScheduledEvent {
  cron: string;
  type: string;
  scheduledTime: number;
}

export interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

/**
 * Cloudflare Worker Scheduled Cron Handler for AffiMatik Background Reconciliation
 * Runs every 5 minutes to invoke /api/jobs/reconcile with verified x-cron-secret.
 */
export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const baseUrl = env.APP_BASE_URL || 'https://affimatik.online';
    const reconcileUrl = `${baseUrl.replace(/\/$/, '')}/api/jobs/reconcile`;
    const timestamp = new Date(event.scheduledTime).toISOString();

    console.log(`[AffiMatik Reconciler Worker] Triggered scheduled cron (${event.cron}) at ${timestamp}`);

    const response = await fetch(reconcileUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': env.CRON_SECRET,
      },
      body: JSON.stringify({
        source: 'cloudflare-worker-cron',
        scheduledTime: event.scheduledTime,
        cron: event.cron,
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error(`[AffiMatik Reconciler Worker] Reconciliation request failed HTTP ${response.status}: ${errText}`);
      throw new Error(`Scheduled reconciliation failed HTTP ${response.status}`);
    }

    const result = await response.json();
    console.log(`[AffiMatik Reconciler Worker] Reconciliation finished successfully:`, JSON.stringify(result));
  },

  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const authHeader = request.headers.get('Authorization');
    const secret = authHeader?.replace(/^Bearer\s+/i, '') || request.headers.get('x-cron-secret');

    if (!env.CRON_SECRET || secret !== env.CRON_SECRET) {
      return new Response(JSON.stringify({ error: 'Akses Ditolak: Kunci rahsia cron tidak sah.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const baseUrl = env.APP_BASE_URL || 'https://affimatik.online';
    const reconcileUrl = `${baseUrl.replace(/\/$/, '')}/api/jobs/reconcile`;

    const res = await fetch(reconcileUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': env.CRON_SECRET,
      },
    });

    const data = await res.json();
    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    });
  },
};
