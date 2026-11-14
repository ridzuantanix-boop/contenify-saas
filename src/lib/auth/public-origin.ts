import { NextRequest } from 'next/server';

const PRODUCTION_ORIGIN = 'https://affimatik.online';

export function publicAppOrigin(req: NextRequest): string {
  const configured = process.env.APP_BASE_URL?.trim();
  const candidate = configured || (process.env.NODE_ENV === 'production' ? PRODUCTION_ORIGIN : req.nextUrl.origin);
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error('APP_BASE_URL tidak sah.');
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') {
    throw new Error('APP_BASE_URL mesti mengandungi origin sahaja.');
  }
  const deploymentEnvironment = process.env.DEPLOYMENT_ENV?.trim() || (process.env.NODE_ENV === 'production' ? 'production' : 'development');
  if (deploymentEnvironment === 'production' && parsed.origin !== PRODUCTION_ORIGIN) {
    throw new Error('APP_BASE_URL production mesti menggunakan domain kanonik AffiMatik.');
  }
  if ((deploymentEnvironment === 'production' || deploymentEnvironment === 'staging') && parsed.protocol !== 'https:') {
    throw new Error('APP_BASE_URL production mesti menggunakan HTTPS.');
  }
  return parsed.origin;
}

export function authCallbackUrl(req: NextRequest, purchaseIntent?: string): string {
  const callback = new URL('/auth/callback', publicAppOrigin(req));
  if (purchaseIntent === 'launch_pack') callback.searchParams.set('intent', 'launch_pack');
  return callback.toString();
}
