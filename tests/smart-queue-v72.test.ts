import {describe,expect,it} from 'vitest';
import fs from 'node:fs';
import {classifyDispatchFailure,MAX_ACTIVE_NEXABOT_JOBS} from '../src/lib/jobs/smart-queue';
import {AUTHORITATIVE_PLANS,TOP_UP_PACKAGES} from '../src/lib/billing/plans';

describe('AffiMatik V7.2 smart queue and pricing locks',()=>{
 it('classifies only definitive HTTP throttling/server replies as safe requeue and network ambiguity as no-resubmit',()=>{
  expect(classifyDispatchFailure(new Error('Nexabot submit failed (HTTP 429): busy'))).toBe('TRANSIENT');
  expect(classifyDispatchFailure(new Error('Nexabot submit failed (HTTP 503): down'))).toBe('TRANSIENT');
  expect(classifyDispatchFailure(new Error('ECONNRESET'))).toBe('AMBIGUOUS');
  expect(classifyDispatchFailure(new Error('fetch timeout'))).toBe('AMBIGUOUS');
  expect(classifyDispatchFailure(new Error('Invalid API key'))).toBe('TERMINAL');
  expect(MAX_ACTIVE_NEXABOT_JOBS).toBe(3);
 });
 it('uses the approved monthly plans and 180-day top-ups',()=>{
  expect(AUTHORITATIVE_PLANS.map(p=>[p.priceMyr,p.monthlyCredits,p.voiceVideoAllowance])).toEqual([[49,500,50],[129,2000,200],[399,8000,800]]);
  expect(TOP_UP_PACKAGES.map(p=>[p.priceMyr,p.credits,p.validityDays])).toEqual([[15,100,180],[34,300,180],[55,500,180]]);
 });
 it('ships durable leases, fairness, circuit breaker, verified-payment buckets and no receipt auto-credit',()=>{
  const queue=fs.readFileSync('supabase/migrations/00022_smart_nexabot_queue_and_costs.sql','utf8');
  expect(queue).toContain('pg_advisory_xact_lock');expect(queue).toContain('FOR UPDATE SKIP LOCKED');expect(queue).toContain('"maxActive":3');
  expect(queue).toContain('submission_uncertain');expect(queue).toContain('workspace_last_dispatch');
  expect(queue).toContain('submission_started_at IS NULL');expect(queue).toContain('recover_expired_nexabot_dispatch_leases_atomic');
  for(const column of ['next_retry_at','last_retry_at','last_provider_error','raw_status']){
   expect(queue).toContain(`ADD COLUMN IF NOT EXISTS ${column}`);
  }
  const billing=fs.readFileSync('supabase/migrations/00023_v72_pricing_and_credit_buckets.sql','utf8');
  expect(billing).toContain("now()+interval '180 days'");expect(billing).toContain('automatic_credit_grant');
  expect(billing).not.toMatch(/provisional_credits.*GRANT/i);
 });
});
