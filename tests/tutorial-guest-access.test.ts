import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { isTutorialGuestSession, TUTORIAL_GUEST_EMAIL, validTutorialAccessToken } from '@/lib/auth/tutorial-guest';

describe('tutorial guest access', () => {
  it('compares a sufficiently strong access token', async () => {
    const token = 'guest_token_0123456789abcdefghijklmnopqrstuvwxyz';
    await expect(validTutorialAccessToken(token, token)).resolves.toBe(true);
    await expect(validTutorialAccessToken(`${token}x`, token)).resolves.toBe(false);
    await expect(validTutorialAccessToken('short', token)).resolves.toBe(false);
  });

  it('recognizes only the isolated tutorial identity', () => {
    expect(isTutorialGuestSession({ email: TUTORIAL_GUEST_EMAIL.toUpperCase() })).toBe(true);
    expect(isTutorialGuestSession({ email: 'customer@example.com' })).toBe(false);
  });

  it('keeps tutorial sessions away from payment mutations', () => {
    const checkout = fs.readFileSync('src/app/api/billing/checkout/route.ts', 'utf8');
    const receipt = fs.readFileSync('src/app/api/billing/qr-receipt/route.ts', 'utf8');
    expect(checkout).toContain('isTutorialGuestSession(session)');
    expect(receipt).toContain('isTutorialGuestSession(session)');
  });
});
