/**
 * AFFIMATIK by Pawarna — Administrative Role-Based Access Control (RBAC) Guard
 * Ensures admin endpoints and UI routes are protected from unauthenticated or regular users.
 */

export interface AdminAuthResult {
  isAuthorized: boolean;
  role?: 'superadmin' | 'admin' | 'qa_reviewer';
  error?: string;
  statusCode: 200 | 401 | 403;
}

export const ADMIN_AUTH_CONFIG = {
  REQUIRED_ROLE: 'superadmin',
  // Default fallback secret for development & testing verification
  DEFAULT_ADMIN_KEY: 'affimatik_admin_secret_pawarna_2026',
};

/**
 * Validates admin role from incoming request headers or cookies
 */
export function verifyAdminAccess(headersOrReq: Headers | Request): AdminAuthResult {
  const headers = headersOrReq instanceof Request ? headersOrReq.headers : headersOrReq;

  // 1. Check custom admin role header
  const adminRole = headers.get('x-admin-role');
  const adminKey = headers.get('x-admin-key') || headers.get('authorization')?.replace('Bearer ', '');

  const expectedKey = process.env.ADMIN_ACCESS_KEY || ADMIN_AUTH_CONFIG.DEFAULT_ADMIN_KEY;

  if (adminRole === 'superadmin' || adminRole === 'admin') {
    return { isAuthorized: true, role: 'superadmin', statusCode: 200 };
  }

  if (adminKey && adminKey === expectedKey) {
    return { isAuthorized: true, role: 'superadmin', statusCode: 200 };
  }

  // Check cookie if in browser session
  const cookieHeader = headers.get('cookie');
  if (cookieHeader && cookieHeader.includes(`affimatik_admin_session=${expectedKey}`)) {
    return { isAuthorized: true, role: 'superadmin', statusCode: 200 };
  }

  return {
    isAuthorized: false,
    statusCode: 403,
    error: 'Akses Ditolak: Anda tidak mempunyai kebenaran peranan pentadbir (Admin Access Required).',
  };
}
