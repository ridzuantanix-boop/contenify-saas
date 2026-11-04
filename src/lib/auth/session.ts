/**
 * AFFIMATIK by Pawarna — Cryptographic Session Management
 * Edge-compatible (HMAC-SHA256 via Web Crypto API)
 * Zero external dependencies, secure HttpOnly cookie support.
 */

export interface UserSession {
  userId: string;
  email: string;
  fullName: string;
  workspaceId: string;
  role: 'owner' | 'admin' | 'member' | 'superadmin';
  tier: 'free' | 'starter' | 'pro' | 'agency';
  issuedAt: number;
  expiresAt: number;
}

const DEFAULT_SESSION_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7 days

// Secure server secret (falls back to deterministic node env or warning in development)
function getSecretKey(): string {
  const secret = process.env.SESSION_SECRET || process.env.ADMIN_ACCESS_KEY || 'affimatik_master_hmac_secret_2026_pawarna_secure';
  return secret;
}

/**
 * Base64URL encode/decode helpers
 */
function base64UrlEncode(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): string {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

async function getCryptoKey(): Promise<CryptoKey> {
  const secret = getSecretKey();
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

/**
 * Signs a session payload into a compact secure token (header.payload.signature)
 */
export async function createSessionToken(session: Omit<UserSession, 'issuedAt' | 'expiresAt'>, expirySeconds = DEFAULT_SESSION_EXPIRY_SECONDS): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const fullSession: UserSession = {
    ...session,
    issuedAt: now,
    expiresAt: now + expirySeconds,
  };

  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64UrlEncode(JSON.stringify(fullSession));
  const data = `${header}.${payload}`;

  const key = await getCryptoKey();
  const signatureBytes = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(data)
  );

  let binary = '';
  const bytes = new Uint8Array(signatureBytes);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const signature = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  return `${data}.${signature}`;
}

/**
 * Verifies a token and returns the UserSession if valid and not expired
 */
export async function verifySessionToken(token: string): Promise<UserSession | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, payload, signature] = parts;
    const data = `${header}.${payload}`;

    // Verify signature
    let b64Sig = signature.replace(/-/g, '+').replace(/_/g, '/');
    while (b64Sig.length % 4) b64Sig += '=';
    const sigBinary = atob(b64Sig);
    const sigBytes = new Uint8Array(sigBinary.length);
    for (let i = 0; i < sigBinary.length; i++) {
      sigBytes[i] = sigBinary.charCodeAt(i);
    }

    const key = await getCryptoKey();
    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      sigBytes,
      new TextEncoder().encode(data)
    );

    if (!isValid) return null;

    const session: UserSession = JSON.parse(base64UrlDecode(payload));
    const now = Math.floor(Date.now() / 1000);

    if (session.expiresAt && session.expiresAt < now) {
      return null; // Expired
    }

    return session;
  } catch {
    return null;
  }
}

/**
 * Parses cookies from cookie header string
 */
export function parseCookies(cookieHeader: string | null): Record<string, string> {
  const list: Record<string, string> = {};
  if (!cookieHeader) return list;

  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    const name = parts.shift()?.trim();
    if (name) {
      list[name] = decodeURIComponent(parts.join('='));
    }
  });

  return list;
}

/**
 * Extracts and verifies the session from an incoming Request or Headers object
 */
export async function getSessionFromRequest(reqOrHeaders: Request | Headers): Promise<UserSession | null> {
  const headers = reqOrHeaders instanceof Request ? reqOrHeaders.headers : reqOrHeaders;

  // 1. Check Authorization Bearer header
  const authHeader = headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    const session = await verifySessionToken(token);
    if (session) return session;
  }

  // 2. Check affimatik_session cookie
  const cookieHeader = headers.get('cookie');
  const cookies = parseCookies(cookieHeader);
  const sessionToken = cookies['affimatik_session'];

  if (sessionToken) {
    const session = await verifySessionToken(sessionToken);
    if (session) return session;
  }

  return null;
}
