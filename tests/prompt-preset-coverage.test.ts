import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getAllVideoStyles } from '@/lib/styles/registry';

describe('published style database coverage', () => {
  it('seeds a prompt_presets parent row for every published style', () => {
    const migrationsDirectory = path.join(process.cwd(), 'supabase', 'migrations');
    const migrationSql = fs.readdirSync(migrationsDirectory)
      .filter((filename) => filename.endsWith('.sql'))
      .sort()
      .map((filename) => fs.readFileSync(path.join(migrationsDirectory, filename), 'utf8'))
      .join('\n');

    const seededIds = new Set(
      [...migrationSql.matchAll(/\('([A-Z]{2}\d{2})'\s*,/g)].map((match) => match[1]),
    );
    const publishedIds = getAllVideoStyles().map((style) => style.id);

    expect(publishedIds).toHaveLength(20);
    expect(publishedIds.filter((id) => !seededIds.has(id))).toEqual([]);
  });

  it('uses an additive conflict policy for the V6 backfill', () => {
    const migration = fs.readFileSync(
      path.join(process.cwd(), 'supabase', 'migrations', '00020_seed_creative_v6_prompt_presets.sql'),
      'utf8',
    );

    expect(migration).toContain('ON CONFLICT (id) DO NOTHING');
    expect(migration).not.toMatch(/\bDELETE\b|\bUPDATE\b/i);
  });
});
