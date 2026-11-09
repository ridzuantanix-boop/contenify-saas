export function createCanonicalProductionWorker(app) {
  return {
    async fetch(request, env, ctx) {
      const url = new URL(request.url);
      if (url.hostname.toLowerCase() === 'www.affimatik.online') {
        url.protocol = 'https:';
        url.hostname = 'affimatik.online';
        url.port = '';
        return Response.redirect(url, 308);
      }
      if (String(env?.MAINTENANCE_MODE || '').toLowerCase() === 'true') {
        if (url.pathname === '/api/jobs/reconcile') return app.fetch(request, env, ctx);
        const headers = {
          'Cache-Control': 'no-store, max-age=0',
          'Retry-After': '300',
          'X-Robots-Tag': 'noindex, nofollow',
        };
        if (url.pathname.startsWith('/api/')) {
          return Response.json({
            error: 'AffiMatik tengah maintenance sekejap. Akaun, kredit dan video korang semuanya selamat. Cuba lagi nanti ya.',
            maintenance: true,
          }, { status: 503, headers });
        }
        return new Response(maintenancePage(), {
          status: 503,
          headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' },
        });
      }
      return app.fetch(request, env, ctx);
    },
    scheduled: app.scheduled?.bind(app),
  };
}

function maintenancePage() {
  return `<!doctype html>
<html lang="ms"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta http-equiv="refresh" content="120"><title>AffiMatik tengah dikemas kini</title>
<style>:root{color-scheme:light}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at top,#eeeafe 0,#f8f7ff 44%,#f6f8fc 100%);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#172033}.card{width:min(100%,560px);padding:34px;border:1px solid #ddd8ff;border-radius:28px;background:rgba(255,255,255,.94);box-shadow:0 24px 70px rgba(67,47,180,.13);text-align:center}.badge{display:inline-flex;padding:8px 12px;border-radius:999px;background:#f0edff;color:#5442d6;font-size:12px;font-weight:800}.mark{width:64px;height:64px;margin:22px auto 14px;display:grid;place-items:center;border-radius:20px;background:linear-gradient(135deg,#6d5dfc,#4338ca);color:white;font-size:30px;box-shadow:0 12px 28px rgba(78,65,214,.28)}h1{margin:0;font-size:clamp(27px,7vw,40px);line-height:1.08;letter-spacing:-.035em}p{margin:18px auto 0;max-width:430px;color:#667085;font-size:16px;line-height:1.7}.safe{margin-top:22px;padding:14px 16px;border-radius:16px;background:#ecfdf3;color:#157347;font-size:13px;font-weight:750;line-height:1.5}.actions{margin-top:24px;display:flex;justify-content:center}.actions a{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 18px;border-radius:13px;background:#5145e5;color:#fff;text-decoration:none;font-size:14px;font-weight:800}.small{margin-top:16px;color:#98a2b3;font-size:12px}@media(max-width:480px){.card{padding:28px 20px;border-radius:22px}}</style></head>
<body><main class="card"><div class="badge">AFFIMATIK · SEKEJAP YA</div><div class="mark">🛠️</div><h1>Kami tengah kemaskan AffiMatik</h1><p>Kami tengah bagi pengalaman jana video satu sentuhan baru supaya hasil lebih natural, stabil dan lagi sedap digunakan. Singgah balik kejap lagi ya.</p><div class="safe">Akaun, baki kredit, job dan video korang semuanya selamat.</div><div class="actions"><a href="/">Cuba semula</a></div><div class="small">Halaman ini akan semak semula secara automatik · Team AffiMatik</div></main></body></html>`;
}
