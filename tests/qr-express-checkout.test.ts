import { describe,expect,it } from 'vitest';
import fs from 'node:fs';
import { NextRequest } from 'next/server';
import { AUTHORITATIVE_PLANS } from '../src/lib/billing/plans';
import { inspectEvidence,normalizeQrConfig } from '../src/lib/billing/qr-checkout';
import { POST as checkout } from '../src/app/api/billing/checkout/route';
import { POST as receipt } from '../src/app/api/billing/qr-receipt/route';
import { GET as adminSettings } from '../src/app/api/admin/billing-settings/route';

describe('AffiMatik V8.4 QR Express Checkout',()=>{
  it('locks the approved plan amounts and allocations',()=>{
    expect(AUTHORITATIVE_PLANS.map(p=>[p.id,p.priceMyr,p.monthlyCredits])).toEqual([
      ['plan_starter',49,100],['plan_pro',129,300],['plan_agency',399,1000],
    ]);
  });
  it('normalizes a strict capped QR configuration',()=>{
    const config=normalizeQrConfig({enabled:true,autoFulfillEnabled:true,merchantName:' Merchant ',recipientInfo:' Recipient ',qrObjectKey:'qr.png',recipientConfirmed:true,provisionalExposureCapMyr:999999,maxAutoOrderMyr:399});
    expect(config.merchantName).toBe('Merchant');
    expect(config.provisionalExposureCapMyr).toBe(300);
    expect(config.maxAutoOrderMyr).toBe(129);
  });
  it('checks actual receipt magic instead of trusting the MIME header',()=>{
    const png=new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0]).buffer;
    expect(inspectEvidence(png,'image/png').extension).toBe('png');
    expect(()=>inspectEvidence(png,'image/jpeg')).toThrow(/JPEG, PNG, WebP atau PDF/);
    const pdf=new TextEncoder().encode('%PDF-1.7 synthetic').buffer;
    expect(inspectEvidence(pdf,'application/pdf').extension).toBe('pdf');
  });
  it('fails closed for unauthenticated checkout, receipt and admin settings',async()=>{
    expect((await checkout(new NextRequest('https://affimatik.test/api/billing/checkout',{method:'POST',body:'{}'}))).status).toBe(401);
    expect((await receipt(new NextRequest('https://affimatik.test/api/billing/qr-receipt',{method:'POST'}))).status).toBe(401);
    expect((await adminSettings(new NextRequest('https://affimatik.test/api/admin/billing-settings'))).status).toBe(403);
  });
  it('ships additive atomic anti-replay and affiliate-safe SQL with a non-destructive rollback',()=>{
    const migration=fs.readFileSync('supabase/migrations/00020_qr_express_checkout.sql','utf8');
    expect(migration).toContain('provision_qr_order_atomic');
    expect(migration).toContain('pg_advisory_xact_lock');
    expect(migration).toContain('orders_receipt_sha256_once');
    expect(migration).toContain("payment_state='CREDITS_PROVISIONALLY_GRANTED'");
    expect(migration).toContain("payment_state='BANK_PAYMENT_VERIFIED'");
    expect(migration.indexOf('affiliate_commissions')).toBeGreaterThan(migration.indexOf('verify_qr_order_payment_atomic'));
    const rollback=fs.readFileSync('supabase/rollback/00020_qr_express_checkout.sql','utf8');
    expect(rollback).toContain('"autoFulfillEnabled":false');
    expect(rollback).not.toMatch(/DROP TABLE|DROP COLUMN|DELETE FROM orders/i);
  });
});
