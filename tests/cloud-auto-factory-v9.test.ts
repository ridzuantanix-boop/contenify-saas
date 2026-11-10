import { describe,expect,it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { klNow,seededStylePlan } from '@/lib/auto-factory/core';

const root=process.cwd();
const read=(file:string)=>fs.readFileSync(path.join(root,file),'utf8');

describe('AffiMatik V9 Cloud Auto Factory',()=>{
 it('builds a deterministic seeded rotation without duplicate styles until the set is exhausted',()=>{
  const first=seededStylePlan(['product-a','product-b'],['NX01','NX02','NX03'],3,'stable-seed','AUTO_MIX');
  const second=seededStylePlan(['product-a','product-b'],['NX01','NX02','NX03'],3,'stable-seed','AUTO_MIX');
  expect(second).toEqual(first);
  for(const productId of ['product-a','product-b']){
   const styles=first.filter(item=>item.productId===productId).map(item=>item.styleId);
   expect(new Set(styles).size).toBe(3);
  }
  expect(new Set(seededStylePlan(['one','two'],['NX01','NX02'],1,'rotate','AUTO_MIX').map(item=>item.styleId)).size).toBe(2);
 });

 it('keeps Quick Bulk fixed to one style',()=>{
  const plan=seededStylePlan(['a','b'],['NX07','NX08'],2,'seed','QUICK_BULK');
  expect(plan).toHaveLength(4);
  expect(new Set(plan.map(item=>item.styleId))).toEqual(new Set(['NX07']));
 });

 it('uses Asia/Kuala_Lumpur for daily automation',()=>{
  expect(klNow(new Date('2026-01-01T16:05:00.000Z'))).toEqual({date:'2026-01-02',time:'00:05'});
 });

 it('uses an additive migration and preserves product files when folders are deleted',()=>{
  const sql=read('supabase/migrations/00026_cloud_auto_factory.sql');
  expect(sql).not.toMatch(/\bDROP\s+(TABLE|COLUMN)\b/i);
  expect(sql).not.toMatch(/\bTRUNCATE\b/i);
  expect(sql).toMatch(/folder_id UUID REFERENCES public\.product_folders\(id\) ON DELETE SET NULL/i);
  expect(sql).toMatch(/daily_auto_one_active_folder/);
  expect(sql).toMatch(/FOR UPDATE OF i SKIP LOCKED/);
 });

 it('freezes creator-profile configuration and full generation metadata in immutable snapshots',()=>{
  const migration=read('supabase/migrations/00026_cloud_auto_factory.sql');
  const core=read('src/lib/auto-factory/core.ts');
  expect(migration).toContain("'creatorProfile'");
  expect(migration).toContain("'legacyPreset'");
  for(const field of ['workspaceId','productId','imageId','creatorProfileVersion','styleId','audioMode','scriptMode','cta','providerPrompt','creditCharge','batchId']){
   expect(core).toContain(field);
  }
  expect(core).toContain('CUSTOM_SCRIPT_NOT_ALLOWED_FOR_MIXED_BULK');
 });

 it('continues in the cloud from cron and never relies on a browser loop',()=>{
  const reconcile=read('src/app/api/jobs/reconcile/route.ts');
  expect(reconcile).toContain('materializeDueDailyRuns');
  expect(reconcile).toContain('dispatchAutoFactoryCapacity');
  expect(reconcile).toContain('dispatchNexabotQueueCapacity');
  expect(read('src/app/(dashboard)/auto-factory/page.tsx')).toContain('Anda boleh tutup browser sekarang');
 });

 it('provides mobile multi-upload and sticky generation controls',()=>{
  const ui=read('src/app/(dashboard)/auto-factory/page.tsx');
  expect(ui).toContain('multiple accept="image/jpeg,image/png,image/webp"');
  expect(ui).toContain('fixed inset-x-0 bottom-0');
  expect(ui).toContain('Start Auto Run');
 });

 it('enforces server-side workspace boundaries and bounded batch sizes',()=>{
  const batch=read('src/app/api/auto-factory/batches/route.ts');
  const folders=read('src/app/api/product-folders/route.ts');
  expect(batch).toContain('workspace_id=eq.${s.workspaceId}');
  expect(batch).toContain('productIds.length>30');
  expect(folders).toContain('workspace_id=eq.${s.workspaceId}');
  expect(read('supabase/migrations/00026_cloud_auto_factory.sql')).toContain("v_count>60");
 });

 it('accepts empty PostgREST bodies for return=minimal writes',()=>{
  const core=read('src/lib/auto-factory/core.ts');
  expect(core).toContain('text?JSON.parse(text):undefined');
 });
});
