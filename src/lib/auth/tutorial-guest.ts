import type { UserSession } from './session';

export const TUTORIAL_GUEST_EMAIL = 'gemini-tutorial-v9@affimatik.online';

export function isTutorialGuestSession(session: Pick<UserSession, 'email'> | null | undefined): boolean {
  return session?.email.trim().toLowerCase() === TUTORIAL_GUEST_EMAIL;
}

export async function validTutorialAccessToken(candidate: string, configured: string): Promise<boolean> {
  if (candidate.length < 32 || configured.length < 32) return false;
  const encoder = new TextEncoder();
  const [candidateHash, configuredHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(candidate)),
    crypto.subtle.digest('SHA-256', encoder.encode(configured)),
  ]);
  const left = new Uint8Array(candidateHash);
  const right = new Uint8Array(configuredHash);
  let difference = left.length ^ right.length;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}
