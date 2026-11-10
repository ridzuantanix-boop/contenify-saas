import { describe,expect,it } from 'vitest';
import fs from 'node:fs';
import { isRetryableProviderFailure } from '../src/lib/jobs/provider-retry';

describe('Nexabot persistent retry policy',()=>{
  it('retries ambiguous/server-side rejection but stops explicit permanent errors',()=>{
    for(const value of ['failed','prompt rejected','server error','HTTP 503','fetch failed','ECONNRESET']) expect(isRetryableProviderFailure(value),value).toBe(true);
    for(const value of ['Invalid API key','insufficient credit','policy violation','invalid image format','HTTP 400','Stored product image reference is unavailable for retry.']) expect(isRetryableProviderFailure(value),value).toBe(false);
  });
  it('ships bounded atomic scheduling and a non-destructive rollback',()=>{
    const sql=fs.readFileSync('supabase/migrations/00021_nexabot_provider_retry.sql','utf8');
    expect(sql).toContain('FOR UPDATE');
    expect(sql).toContain("interval '2 minutes'");
    expect(sql).toContain("interval '5 minutes'");
    expect(sql).toContain("interval '10 minutes'");
    expect(sql).toContain('retry_count >= v_job.max_retries');
    const rollback=fs.readFileSync('supabase/rollback/00021_nexabot_provider_retry.sql','utf8');
    expect(rollback).not.toMatch(/DROP TABLE|DELETE FROM video_jobs/i);
    const productionRepair=fs.readFileSync('supabase/migrations/00025_restore_provider_retry_scheduler.sql','utf8');
    expect(productionRepair).toContain('CREATE OR REPLACE FUNCTION public.schedule_video_job_retry_atomic');
    expect(productionRepair).toContain('FOR UPDATE');
    expect(productionRepair).not.toMatch(/DROP TABLE|DROP COLUMN|DELETE FROM video_jobs/i);
  });
  it('tells customers this is a provider disruption and protects the single credit reservation',()=>{
    const factory=fs.readFileSync('src/app/(dashboard)/factory/page.tsx','utf8');
    expect(factory).toContain('Ini gangguan pelayan Nexabot—bukan semestinya masalah prompt atau gambar anda.');
    expect(factory).toContain('Kredit masih ditempah dan tidak akan dicaj dua kali.');
    expect(factory).toContain('Pelayan Gagal · Kredit Selamat');
    expect(factory).not.toContain("? 'Tidak Lulus'");
    const route=fs.readFileSync('src/app/api/jobs/route.ts','utf8');
    expect(route).toContain('retryScheduled: true');
    expect(route).toContain('{ status: 202 }');
  });
});
