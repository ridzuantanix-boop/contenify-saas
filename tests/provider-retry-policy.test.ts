import { describe,expect,it,vi } from 'vitest';
import fs from 'node:fs';
import { deferProvisionalProviderFailure, isProviderOutageFailure, isRetryableProviderFailure, PROVIDER_OUTAGE_MAX_RETRIES, PROVIDER_TERMINAL_GRACE_MS, PROVIDER_TERMINAL_GRACE_STATUS } from '../src/lib/jobs/provider-retry';
import { DurableStore, VideoJobRecord } from '../src/lib/db/store';

describe('Nexabot persistent retry policy',()=>{
  it('retries ambiguous/server-side rejection but stops explicit permanent errors',()=>{
    for(const value of ['failed','prompt rejected','server error','HTTP 503','fetch failed','ECONNRESET']) expect(isRetryableProviderFailure(value),value).toBe(true);
    for(const value of ['Invalid API key','insufficient credit','policy violation','invalid image format','HTTP 400','Stored product image reference is unavailable for retry.']) expect(isRetryableProviderFailure(value),value).toBe(false);
  });
  it('separates durable provider outages from ordinary bounded generation failures',()=>{
    for(const value of ['HTTP 503','HTTP 429','ECONNRESET','service unavailable','provider capacity busy']) expect(isProviderOutageFailure(value),value).toBe(true);
    for(const value of ['moderation','invalid image format','prompt rejected']) expect(isProviderOutageFailure(value),value).toBe(false);
    expect(PROVIDER_OUTAGE_MAX_RETRIES).toBe(168);
  });
  it('classifies Nexabot bare terminal responses as provider recovery rather than customer failure',()=>{
    const source=fs.readFileSync('src/lib/jobs/provider-retry.ts','utf8');
    expect(source).toContain('provider unavailable or delayed');
    expect(isProviderOutageFailure('provider unavailable or delayed: Generation failed on Nexabot')).toBe(true);
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
  it('ships seven-day rate-limited outage recovery without making permanent errors unbounded',()=>{
    const recovery=fs.readFileSync('supabase/migrations/00035_durable_nexabot_outage_recovery.sql','utf8');
    expect(recovery).toContain("interval '7 days'");
    expect(recovery).toContain('THEN 168 ELSE LEAST');
    expect(recovery).toContain("ELSE interval '60 minutes'");
    expect(recovery).toContain('p_expected_provider_task_id IS DISTINCT FROM v_job.provider_task_id');
    expect(recovery).toContain('provider_recovery_deadline');
    expect(recovery).not.toMatch(/DELETE FROM video_jobs|DROP TABLE|DROP COLUMN/i);
  });
  it('limits a no-task-id submission uncertainty to five minutes',()=>{
    const migration=fs.readFileSync('supabase/migrations/00037_short_uncertain_submission_window.sql','utf8');
    expect(migration).toContain("interval '5 minutes'");
    expect(migration).toContain('submission_uncertain=true');
    expect(migration).not.toMatch(/DELETE FROM|DROP TABLE|DROP COLUMN/i);
    const store=fs.readFileSync('src/lib/db/store.ts','utf8');
    expect(store).toContain('Date.now()+300000');
  });
  it('tells customers this is a provider disruption and protects the single credit reservation',()=>{
    const factory=fs.readFileSync('src/app/(dashboard)/factory/page.tsx','utf8');
    expect(factory).toContain('Ini gangguan pelayan Nexabot—bukan semestinya masalah prompt atau gambar anda.');
    expect(factory).toContain('Kredit masih ditempah sekali sahaja dan tidak akan dicaj dua kali.');
    expect(factory).toContain('Pelayan Gagal · Kredit Selamat');
    expect(factory).not.toContain("? 'Tidak Lulus'");
    const route=fs.readFileSync('src/app/api/jobs/route.ts','utf8');
    expect(route).toContain('retryScheduled: true');
    expect(route).toContain('{ status: 202 }');
    const queue=fs.readFileSync('src/app/(dashboard)/queue/page.tsx','utf8');
    expect(queue).toContain('video sedang dicuba semula secara automatik');
    expect(queue).toContain('Tak perlu jana semula atau biarkan browser terbuka.');
    expect(queue).toContain('Kredit kekal selamat');
  });
  it('rechecks recent failed provider task IDs and can deliver late output without another debit',()=>{
    const reconcile=fs.readFileSync('src/app/api/jobs/reconcile/route.ts','utf8');
    const persistence=fs.readFileSync('src/lib/orchestration/persist-video.ts','utf8');
    expect(reconcile).toContain('listFailedNexabotJobsForLateRecovery');
    expect(reconcile).toContain('persistLateCompletedVideo');
    expect(persistence).toContain('settleReservation: boolean');
    expect(persistence).toContain('LATE_PROVIDER_COMPLETION');
  });
  it('keeps failed attempts out of customer history without deleting audit or recovery records',()=>{
    const store=fs.readFileSync('src/lib/db/store.ts','utf8');
    expect(store).toContain('status=neq.FAILED');
    expect(store).toContain("j.status !== 'FAILED'");
    expect(store).toContain('listFailedNexabotJobsForLateRecovery');
  });
});

describe('Nexabot provisional terminal status',()=>{
  const job: VideoJobRecord = {
    id:'00000000-0000-4000-8000-000000000099', workspaceId:'00000000-0000-4000-8000-000000000001', userId:'user',
    styleId:'NX01', styleName:'NX01', provider:'nexabot', providerTaskId:'provider-task', durationSeconds:15,
    status:'PROCESSING', requiredCredits:10, createdAt:'2026-11-18T00:00:00.000Z', updatedAt:'2026-11-18T00:01:00.000Z',
  };

  it('keeps tracking the original paid task throughout the bounded recovery window',async()=>{
    const spy=vi.spyOn(DurableStore,'updateJobStatus').mockResolvedValue({...job,rawStatus:PROVIDER_TERMINAL_GRACE_STATUS});
    const result=await deferProvisionalProviderFailure(job,'Generation failed on Nexabot',Date.parse('2026-11-18T00:02:00.000Z'));
    expect(result.deferred).toBe(true);
    expect(spy).toHaveBeenCalledWith(job.id,{status:'PROCESSING',rawStatus:PROVIDER_TERMINAL_GRACE_STATUS});
    spy.mockRestore();
  });

  it('allows terminal recovery handling only after the seven-day window expires',async()=>{
    const deferredJob={...job,rawStatus:PROVIDER_TERMINAL_GRACE_STATUS,updatedAt:'2026-11-18T00:01:00.000Z'};
    const result=await deferProvisionalProviderFailure(deferredJob,'failed',Date.parse('2026-11-18T00:01:00.000Z')+PROVIDER_TERMINAL_GRACE_MS+1);
    expect(result.deferred).toBe(false);
  });
});
