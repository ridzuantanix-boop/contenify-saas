import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ALL_STYLE_MARKETING_METADATA,
  STYLE_MARKETING_IDS,
} from '@/lib/styles/marketing-metadata';
import { VIDEO_STYLES_REGISTRY } from '@/lib/styles/registry';

function readWebpDimensions(buffer: Buffer): { width: number; height: number } {
  expect(buffer.toString('ascii', 0, 4)).toBe('RIFF');
  expect(buffer.toString('ascii', 8, 12)).toBe('WEBP');
  const chunk = buffer.toString('ascii', 12, 16);
  if (chunk === 'VP8X') {
    return {
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3),
    };
  }
  if (chunk === 'VP8 ') {
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
    };
  }
  if (chunk === 'VP8L') {
    const bits = buffer.readUInt32LE(21);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    };
  }
  throw new Error(`Unsupported WebP chunk ${chunk}`);
}

describe('AffiMatik V7.1 style marketing metadata', () => {
  it('defines exactly one complete record for every official style', () => {
    expect(STYLE_MARKETING_IDS).toHaveLength(20);
    expect(new Set(STYLE_MARKETING_IDS).size).toBe(20);
    expect(ALL_STYLE_MARKETING_METADATA.map((style) => style.id)).toEqual(STYLE_MARKETING_IDS);
    expect(VIDEO_STYLES_REGISTRY.map((style) => style.id)).toEqual(STYLE_MARKETING_IDS);
  });

  it('is the customer-facing source used by the functional registry', () => {
    for (const metadata of ALL_STYLE_MARKETING_METADATA) {
      const style = VIDEO_STYLES_REGISTRY.find((candidate) => candidate.id === metadata.id);
      expect(style?.name).toBe(metadata.title);
      expect(style?.description).toBe(metadata.description);
      expect(style?.benefit).toBe(metadata.tagline);
      expect(style?.tags).toEqual(metadata.tags);
      expect(style?.previewVideoUrl).toBe(metadata.previewPath);
      expect(metadata.tags.length).toBeGreaterThanOrEqual(2);
      expect(metadata.tags.length).toBeLessThanOrEqual(3);
      expect(metadata.niches.length).toBeGreaterThan(0);
      expect(metadata.creativeDirectionRef).toBe(`style:${metadata.id}`);
    }
  });

  it('ships 20 optimized 720x1280 WebP posters and matching V6 samples', () => {
    for (const metadata of ALL_STYLE_MARKETING_METADATA) {
      const poster = resolve(process.cwd(), 'public', metadata.thumbnailPath.slice(1));
      const sample = resolve(process.cwd(), 'public', 'style-previews', metadata.id, 'sample-v6.mp4');
      expect(statSync(poster).size).toBeGreaterThan(20_000);
      expect(statSync(sample).size).toBeGreaterThan(100_000);
      expect(readWebpDimensions(readFileSync(poster))).toEqual({ width: 720, height: 1280 });
    }
  });

  it('keeps preview video lazy and provides explicit accessible preview controls', () => {
    const component = readFileSync(resolve(process.cwd(), 'src/components/styles/style-poster-media.tsx'), 'utf8');
    expect(component).toContain('preload="none"');
    expect(component).toContain('prefers-reduced-motion: reduce');
    expect(component).toContain('aria-label={`Preview video');
    expect(component).toContain("setHoverPreview(false)");
    expect(component).not.toContain('preload="auto"');
  });
});
