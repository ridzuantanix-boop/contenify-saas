import { describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';
import {
  OFFICIAL_AVATARS,
  OFFICIAL_BACKGROUNDS,
  findOfficialAvatar,
  findOfficialBackground,
  officialAssetDataUri,
} from '../src/lib/personalization/official-assets';
import { sanitizePersonalizationSettings } from '../src/lib/personalization/config';

describe('AffiMatik V7.1 official starter collection', () => {
  it('ships 12 distinct avatars and 18 distinct backgrounds with stable metadata', () => {
    expect(OFFICIAL_AVATARS).toHaveLength(12);
    expect(OFFICIAL_BACKGROUNDS).toHaveLength(18);
    const ids = [...OFFICIAL_AVATARS, ...OFFICIAL_BACKGROUNDS].map((item) => item.id);
    expect(new Set(ids).size).toBe(30);
    expect(OFFICIAL_AVATARS.filter((item) => item.gender === 'female')).toHaveLength(6);
    expect(OFFICIAL_AVATARS.filter((item) => item.gender === 'male')).toHaveLength(6);
    for (const age of ['young', 'mature', 'senior']) {
      expect(OFFICIAL_AVATARS.filter((item) => item.ageGroup === age)).toHaveLength(4);
    }
    expect(OFFICIAL_AVATARS.every((item) => item.official && item.readOnly && item.source === 'official')).toBe(true);
    expect(OFFICIAL_BACKGROUNDS.every((item) => item.official && item.readOnly && item.source === 'official')).toBe(true);
  });

  it('ships optimized reference and thumbnail WebP files with predictable dimensions', async () => {
    for (const item of OFFICIAL_AVATARS) {
      for (const [url, width, height, maxBytes] of [[item.referenceUrl, 720, 960, 200_000], [item.thumbnailUrl, 240, 320, 60_000]] as const) {
        const file = resolve('public', url.slice(1).replace(/^official-assets[\\/]/, 'official-assets/'));
        expect(existsSync(file), item.id).toBe(true);
        expect(statSync(file).size, item.id).toBeLessThan(maxBytes);
        expect(await sharp(file).metadata()).toMatchObject({ format: 'webp', width, height });
      }
    }
    for (const item of OFFICIAL_BACKGROUNDS) {
      for (const [url, width, height, maxBytes] of [[item.referenceUrl, 720, 1280, 250_000], [item.thumbnailUrl, 225, 400, 60_000]] as const) {
        const file = resolve('public', url.slice(1).replace(/^official-assets[\\/]/, 'official-assets/'));
        expect(existsSync(file), item.id).toBe(true);
        expect(statSync(file).size, item.id).toBeLessThan(maxBytes);
        expect(await sharp(file).metadata()).toMatchObject({ format: 'webp', width, height });
      }
    }
  }, 15_000);

  it('preserves stable official IDs in presets while rejecting cross-type or unknown IDs', () => {
    const avatarId = OFFICIAL_AVATARS[0].id;
    const backgroundId = OFFICIAL_BACKGROUNDS[0].id;
    expect(sanitizePersonalizationSettings({ avatarId, backgroundId })).toMatchObject({ avatarId, backgroundId });
    expect(sanitizePersonalizationSettings({ avatarId: backgroundId, backgroundId: avatarId })).toMatchObject({ avatarId: null, backgroundId: null });
    expect(findOfficialAvatar(avatarId)?.name).toBe('Aina Mesra');
    expect(findOfficialBackground(backgroundId)?.name).toBe('Ruang Tamu Beige');
  });

  it('resolves the exact official reference bytes to a provider-safe data URI', async () => {
    const item = OFFICIAL_AVATARS[0];
    const bytes = readFileSync(resolve('public', item.referenceUrl.slice(1)));
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(bytes, { status: 200, headers: { 'content-type': 'image/webp' } }));
    const req = new Request('https://staging.example/api/jobs', { headers: { cookie: 'affimatik_stage=signed' } });
    const result = await officialAssetDataUri(req, item.referenceUrl);
    expect(result.startsWith('data:image/webp;base64,')).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(new URL(item.referenceUrl, req.url), expect.objectContaining({ headers: expect.objectContaining({ cookie: 'affimatik_stage=signed' }) }));
    fetchMock.mockRestore();
  });

  it('connects official collections to APIs, Factory selectors, presets and provider ordering', () => {
    const avatarsRoute = readFileSync(resolve('src/app/api/avatars/route.ts'), 'utf8');
    const backgroundsRoute = readFileSync(resolve('src/app/api/backgrounds/route.ts'), 'utf8');
    const jobsRoute = readFileSync(resolve('src/app/api/jobs/route.ts'), 'utf8');
    const factory = readFileSync(resolve('src/app/(dashboard)/factory/page.tsx'), 'utf8');
    expect(avatarsRoute).toContain('officialAvatars: OFFICIAL_AVATARS');
    expect(backgroundsRoute).toContain('officialBackgrounds: OFFICIAL_BACKGROUNDS');
    expect(jobsRoute).toContain('officialAssetDataUri(req, official.referenceUrl)');
    expect(jobsRoute).toContain('[avatarReference?.source, backgroundReference?.source]');
    expect(jobsRoute.indexOf('findOfficialAvatar')).toBeLessThan(jobsRoute.indexOf('admitJobAtomic'));
    expect(factory).toContain('Koleksi AffiMatik');
    expect(factory).toContain('Milik Saya');
    expect(factory).toContain('data-testid="official-avatar-collection"');
    expect(factory).toContain('data-testid="official-background-collection"');
  });
});
