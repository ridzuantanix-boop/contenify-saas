import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken } from '@/lib/auth/session';
import { verifyAdminAccess } from '@/lib/auth/admin-guard';


function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// Rate limiting / brute-force throttle map (IP -> { count, lockedUntil })
const failedAttemptsMap = new Map<string, { count: number; lockedUntil: number }>();

function checkRateLimit(ip: string): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const record = failedAttemptsMap.get(ip);
  if (!record) return { allowed: true };

  if (record.lockedUntil > now) {
    const retryAfter = Math.ceil((record.lockedUntil - now) / 1000);
    return { allowed: false, retryAfterSeconds: retryAfter };
  }

  if (record.lockedUntil <= now && record.count >= 5) {
    failedAttemptsMap.delete(ip);
  }

  return { allowed: true };
}

function recordFailedAttempt(ip: string): void {
  const now = Date.now();
  const record = failedAttemptsMap.get(ip) || { count: 0, lockedUntil: 0 };
  record.count += 1;
  if (record.count >= 5) {
    record.lockedUntil = now + 15 * 60 * 1000; // 15 minutes lockout
  }
  failedAttemptsMap.set(ip, record);
}

function recordSuccessfulAttempt(ip: string): void {
  failedAttemptsMap.delete(ip);
}

export async function POST(req: NextRequest) {
  try {
    const clientIp = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || '127.0.0.1';
    
    // Brute-force check
    const rateCheck = checkRateLimit(clientIp);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: `Terlalu banyak cubaan gagal. Sila cuba lagi dalam masa ${rateCheck.retryAfterSeconds} saat.` },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { accessKey } = body;

    const configuredKey = process.env.ADMIN_ACCESS_KEY;

    if (!configuredKey || configuredKey.trim().length === 0) {
      if (process.env.NODE_ENV === 'production' && !Boolean(process.env.VITEST)) {
        return NextResponse.json(
          { error: 'Kunci akses pentadbir (ADMIN_ACCESS_KEY) belum dikonfigurasi pada persekitaran ini.' },
          { status: 503 }
        );
      }
    }

    // In non-production testing with vitest where process.env.ADMIN_ACCESS_KEY might be dynamically assigned
    const validKey = configuredKey || 'dev_admin_key_testing_only';

    if (!accessKey || !constantTimeEqual(accessKey.trim(), validKey.trim())) {
      recordFailedAttempt(clientIp);
      return NextResponse.json(
        { error: 'Kunci akses pentadbir tidak sah.' },
        { status: 401 }
      );
    }

    recordSuccessfulAttempt(clientIp);

    // Generate cryptographic admin session token
    const adminSession = {
      userId: 'usr_admin_master',
      email: 'admin@pawarna.my',
      fullName: 'AffiMatik SuperAdmin',
      workspaceId: 'ws_system_admin',
      role: 'superadmin' as const,
      tier: 'agency' as const,
    };

    const token = await createSessionToken(adminSession, 12 * 60 * 60); // 12 hours admin session

    const res = NextResponse.json({
      success: true,
      role: 'superadmin',
      message: 'Pengesahan pentadbir berjaya.',
    });

    res.cookies.set('affimatik_admin_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 12 * 60 * 60,
    });

    return res;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function GET(req: NextRequest) {
  const check = await verifyAdminAccess(req);
  return NextResponse.json({
    isAuthorized: check.isAuthorized && check.role === 'superadmin',
    role: check.role || null,
  });
}

export async function DELETE() {
  const res = NextResponse.json({ success: true, message: 'Admin dikunci semula.' });
  res.cookies.set('affimatik_admin_session', '', {
    httpOnly: true,
    path: '/',
    maxAge: 0,
  });
  return res;
}
