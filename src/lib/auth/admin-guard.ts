/**
 * AFFIMATIK by Pawarna — Administrative Role-Based Access Control (RBAC) Guard
 * Strictly verifies admin privileges on the server side.
 * Never trusts client-supplied role headers (e.g. x-admin-role).
 * Does not contain hardcoded default admin credentials.
 */

import { parseCookies, verifySessionToken, UserSession } from './session';

export interface AdminAuthResult {
  isAuthorized: boolean;
  role?: 'superadmin' | 'admin';
  userId?: string;
  error?: string;
  statusCode: 200 | 401 | 403;
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Validates admin access from incoming request headers or cookies.
 * ONLY accepts:
 * 1. Cryptographically signed admin session cookie (affimatik_admin_session)
 * 2. Valid user session whose role is 'superadmin' or 'admin'
 * 3. Exact matching x-admin-key header validated against server process.env.ADMIN_ACCESS_KEY
 * NEVER accepts unverified role headers from browser.
 */
export async function verifyAdminAccess(headersOrReq: Headers | Request): Promise<AdminAuthResult> {
  const headers = headersOrReq instanceof Request ? headersOrReq.headers : headersOrReq;
  const configuredAdminKey = process.env.ADMIN_ACCESS_KEY;

  // 1. Check Bearer or x-admin-key against server-configured ADMIN_ACCESS_KEY
  const rawKey = headers.get('x-admin-key') || headers.get('authorization')?.replace('Bearer ', '');
  if (rawKey && configuredAdminKey && configuredAdminKey.trim().length > 0) {
    if (constantTimeEqual(rawKey.trim(), configuredAdminKey.trim())) {
      return {
        isAuthorized: true,
        role: 'superadmin',
        statusCode: 200,
      };
    }
  }

  // 2. Check signed session cookies
  const cookieHeader = headers.get('cookie');
  const cookies = parseCookies(cookieHeader);

  // Check admin dedicated signed token
  const adminCookieToken = cookies['affimatik_admin_session'];
  if (adminCookieToken) {
    const session = await verifySessionToken(adminCookieToken);
    if (session && (session.role === 'superadmin' || session.role === 'admin')) {
      return {
        isAuthorized: true,
        role: session.role,
        userId: session.userId,
        statusCode: 200,
      };
    }
  }

  // Check general user session with admin privileges
  const userCookieToken = cookies['affimatik_session'];
  if (userCookieToken) {
    const session = await verifySessionToken(userCookieToken);
    if (session && (session.role === 'superadmin' || session.role === 'admin')) {
      return {
        isAuthorized: true,
        role: session.role,
        userId: session.userId,
        statusCode: 200,
      };
    }
  }

  return {
    isAuthorized: false,
    statusCode: 403,
    error: 'Akses Pentadbir Ditolak: Anda tidak mempunyai sesi pentadbir yang sah.',
  };
}
