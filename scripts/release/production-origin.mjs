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
      return app.fetch(request, env, ctx);
    },
    scheduled: app.scheduled?.bind(app),
  };
}
