import { describe,expect,it } from 'vitest';
import fs from 'node:fs';
import { buildPaymentEmail } from '../src/lib/billing/payment-control';
import { summarizeCommercialOperations } from '../src/lib/admin/commercial-operations';

describe('Commercial Launch Operations V1',()=>{
 it('uses accurate, non-misleading Malay payment emails for every lifecycle event',()=>{
  const declaration=buildPaymentEmail({event:'PAYMENT_DECLARATION_RECEIVED',orderId:'order-1',amountMyr:49});
  const provisional=buildPaymentEmail({event:'PAYMENT_PROVISIONAL_ACTIVE',orderId:'order-1',credits:500});
  const confirmed=buildPaymentEmail({event:'PAYMENT_CONFIRMED',orderId:'order-1'});
  const rejected=buildPaymentEmail({event:'PAYMENT_REJECTED',orderId:'order-1'});
  const reactivated=buildPaymentEmail({event:'PAYMENT_HOLD_RELEASED',orderId:'order-1'});
  expect(declaration.text).toMatch(/masih belum disahkan.*rekod bank/i);
  expect(provisional.text).toMatch(/500 kredit[\s\S]*belum dianggap diterima oleh bank/i);
  expect(confirmed.text).toMatch(/telah disahkan[\s\S]*Tiada kredit tambahan/i);
  expect(rejected.text).toMatch(/belum dapat disahkan[\s\S]*dibekukan sementara/i);
  expect(rejected.text).not.toMatch(/penipu|fraud|menipu/i);
  expect(reactivated.text).toMatch(/Sekatan sementara telah dilepaskan/i);
  for(const email of [declaration,provisional,confirmed,rejected,reactivated])expect(email.html).toContain('AffiMatik by Pawarna');
 });

 it('separates confirmed cash, provisional exposure, liabilities and estimated costs',()=>{
  const now=new Date('2026-11-10T12:00:00.000Z');
  const metrics=summarizeCommercialOperations({now,
   orders:[
    {id:'o1',workspace_id:'w1',plan_id:'plan_starter',amount_myr:49,status:'PAID',payment_state:'PAYMENT_CONFIRMED'},
    {id:'o2',workspace_id:'w1',plan_id:'topup_plus',amount_myr:34,status:'PAID',payment_state:'BANK_PAYMENT_VERIFIED'},
    {id:'o3',workspace_id:'w2',plan_id:'plan_agency',amount_myr:399,status:'PENDING',payment_state:'PROVISIONALLY_ACTIVE'},
    {id:'o4',workspace_id:'qa',plan_id:'plan_pro',amount_myr:129,status:'PAID',payment_state:'PAYMENT_CONFIRMED',metadata:{qa_simulation:true}},
   ],
   wallets:[{balance:500},{balance:100}],commissions:[{amount_myr:4.9,status:'PENDING'},{amount_myr:8,status:'REVERSED'}],
   jobs:[
    {id:'j1',status:'COMPLETED',provider:'nexabot',provider_model_id:'376',created_at:'2026-11-10T10:00:00Z',updated_at:'2026-11-10T10:02:00Z',output_size_bytes:1000},
    {id:'j2',status:'SUBMITTING',provider:'nexabot',created_at:'2026-11-10T10:00:00Z',updated_at:'2026-11-10T10:05:00Z',submission_uncertain:true},
    {id:'j3',status:'FAILED',provider:'nexabot',created_at:'2026-11-10T11:00:00Z',updated_at:'2026-11-10T11:01:00Z',error_message:'provider insufficient credit balance'},
   ],
   costs:[{job_id:'j1',estimated_myr_cost:0.04,observed_provider_credits:0.15}],products:[{size_bytes:2000}],backgrounds:[{size_bytes:3000}],fixedOperatingCostMyr:10,storageCostPerGbMyr:1,creditReservePerVideoMyr:0.15,
  });
  expect(metrics.revenue.confirmedMyr).toBe(83);
  expect(metrics.revenue.provisionalMyr).toBe(399);
  expect(metrics.revenue.payingCustomers).toBe(1);
  expect(metrics.revenue.sales.starter).toEqual({orders:1,revenueMyr:49});
  expect(metrics.revenue.sales.topUp).toEqual({orders:1,revenueMyr:34});
  expect(metrics.costs.actualNexabotGenerationVolume).toBe(1);
  expect(metrics.costs.estimatedNexabotCostMyr).toBe(0.04);
  expect(metrics.liabilities.affiliateCommissionMyr).toBe(4.9);
  expect(metrics.liabilities.estimatedCreditLiabilityMyr).toBe(9);
  expect(metrics.margin.safeToWithdrawMyr).toBe(0);
  expect(metrics.queue.maxActive).toBe(3);
  expect(metrics.queue.alerts.map(alert=>alert.code)).toEqual(expect.arrayContaining(['STUCK_JOBS','PROVIDER_BALANCE','AMBIGUOUS_SUBMISSION']));
 });

 it('keeps emails non-blocking, reviews oldest-first and preserves queue capacity',()=>{
  const receipt=fs.readFileSync('src/app/api/billing/qr-receipt/route.ts','utf8');
  const control=fs.readFileSync('src/lib/billing/payment-control.ts','utf8');
  const queue=fs.readFileSync('src/lib/db/store.ts','utf8');
  expect(receipt).toContain('Promise.allSettled');
  expect(control).toContain('order=evidence_submitted_at.asc');
  expect(control).toContain("status=response.ok?'SENT':'FAILED'");
  expect(queue).toMatch(/maxActive[^\n]*3|MAX_ACTIVE_NEXABOT_JOBS/);
 });
});
