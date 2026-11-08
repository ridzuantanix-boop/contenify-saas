const COOKIE = 'affimatik_stage';
const ACCESS_PATH = '/__stage_access';
const MAX_AGE = 8 * 60 * 60;

function equal(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  let difference = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i++) difference |= (left[i] || 0) ^ (right[i] || 0);
  return difference === 0;
}

async function signature(secret, expiry) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(String(expiry))));
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

async function authorized(request, secret) {
  if (equal(request.headers.get('x-affimatik-staging-key'), secret)) return true;
  const value = request.headers.get('cookie')?.split(';').map(x => x.trim()).find(x => x.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  if (!value) return false;
  const [expiryText, signed] = value.split('.');
  const expiry = Number(expiryText);
  if (!Number.isSafeInteger(expiry) || expiry <= Date.now() || expiry > Date.now() + MAX_AGE * 1000 || !signed) return false;
  return equal(signed, await signature(secret, expiry));
}

function response(body, status = 200, headers = {}) {
  return new Response(body, { status, headers: { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow', ...headers } });
}

export function createStagingWorker(app) { return {
  async fetch(request, env, ctx) {
    const secret = env.STAGING_GATE_SECRET;
    if (typeof secret !== 'string' || secret.length < 32) return response('Staging unavailable', 503);
    const url = new URL(request.url);
    if (url.pathname === ACCESS_PATH && request.method === 'GET') {
      return response('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>AffiMatik Staging</title><form method="post"><label>Staging access key <input name="key" type="password" required autocomplete="off"></label><button>Enter</button></form>', 200, { 'Content-Type': 'text/html; charset=utf-8' });
    }
    if (url.pathname === ACCESS_PATH && request.method === 'POST') {
      const body = await request.text();
      if (body.length > 512 || !equal(new URLSearchParams(body).get('key'), secret)) return response('Access denied', 403);
      const expiry = Date.now() + MAX_AGE * 1000;
      const cookie = `${COOKIE}=${expiry}.${await signature(secret, expiry)}; Path=/; Max-Age=${MAX_AGE}; Secure; HttpOnly; SameSite=Lax`;
      return response(null, 303, { Location: '/', 'Set-Cookie': cookie });
    }
    if (!(await authorized(request, secret))) return response('Not found', 404);
    // run_worker_first protects static assets too. After the gate, reproduce
    // Cloudflare's usual asset-first behavior before passing dynamic routes to OpenNext.
    let result;
    if (request.method === 'GET' || request.method === 'HEAD') {
      const asset = await env.ASSETS?.fetch(request);
      if (asset && asset.status !== 404) result = asset;
    }
    result ||= await app.fetch(request, env, ctx);
    const headers = new Headers(result.headers);
    headers.set('X-Robots-Tag', 'noindex, nofollow');
    headers.set('Cache-Control', 'private, no-store');
    return new Response(result.body, { status: result.status, statusText: result.statusText, headers });
  },
  scheduled: (...args) => app.scheduled?.(...args),
}; }
