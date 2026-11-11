import { describe,expect,it } from 'vitest';
import fs from 'node:fs';
import { LAUNCH_PACK } from '../src/lib/billing/plans';

describe('AffiMatik RM19 Launch Pack',()=>{
 it('publishes the approved one-time catalogue values',()=>{
  expect(LAUNCH_PACK).toMatchObject({id:'launch_pack',priceMyr:19,credits:150,validityDays:180,oneTime:true,requiresPaidSubscription:false});
  expect(Math.floor(LAUNCH_PACK.credits/10)).toBe(15);
 });
 it('is shown to free users and remains server-authoritative',()=>{
  const page=fs.readFileSync('src/app/(dashboard)/billing/page.tsx','utf8');
  const checkout=fs.readFileSync('src/lib/billing/checkout.ts','utf8');
  expect(page).toContain('Dapatkan Launch Pack');
  expect(page).not.toMatch(/LAUNCH_PACK[\s\S]{0,500}!paidActive/);
  expect(checkout).toContain("req.planId === LAUNCH_PACK.id");
 });
 it('enforces once-only fulfillment, 180-day expiry and no subscription in PostgreSQL',()=>{
  const sql=fs.readFileSync('supabase/migrations/00027_launch_pack_rm19.sql','utf8');
  expect(sql).toContain("v_amount:=19;v_credits:=150;v_purchase:='LAUNCH_PACK';v_days:=180");
  expect(sql).toContain('orders_launch_pack_once_per_customer');
  expect(sql).toContain("v_order.plan_id='launch_pack' THEN 'TOP_UP'");
  expect(sql).toContain("IF v_source='SUBSCRIPTION' THEN");
 });
});
