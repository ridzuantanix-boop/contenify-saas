import { describe,expect,it } from 'vitest';
import fs from 'node:fs';
import crypto from 'node:crypto';
import sharp from 'sharp';
import jsQR from 'jsqr';
import { NextRequest } from 'next/server';
import { AUTHORITATIVE_PLANS } from '../src/lib/billing/plans';
import { inspectEvidence,normalizeQrConfig } from '../src/lib/billing/qr-checkout';
import { POST as checkout } from '../src/app/api/billing/checkout/route';
import { POST as receipt } from '../src/app/api/billing/qr-receipt/route';
import { GET as adminSettings } from '../src/app/api/admin/billing-settings/route';

describe('AffiMatik V8.4 QR Express Checkout',()=>{
  it('locks the approved plan amounts and allocations',()=>{
    expect(AUTHORITATIVE_PLANS.map(p=>[p.id,p.priceMyr,p.monthlyCredits])).toEqual([
      ['plan_starter',49,500],['plan_pro',129,2000],['plan_agency',399,8000],
    ]);
  });
  it('normalizes the owner-approved full-access QR configuration',()=>{
    const config=normalizeQrConfig({enabled:true,autoFulfillEnabled:true,instantFullAccessEnabled:true,merchantName:' Merchant ',recipientInfo:' Recipient ',qrObjectKey:'qr.png',recipientConfirmed:true,provisionalExposureCapMyr:999999,maxAutoOrderMyr:399});
    expect(config.merchantName).toBe('Merchant');
    expect(config.provisionalExposureCapMyr).toBe(300);
    expect(config.maxAutoOrderMyr).toBe(399);
    expect(config.instantFullAccessEnabled).toBe(true);
  });
  it('accepts common mobile receipt formats by actual magic instead of trusting the MIME header',()=>{
    const png=new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0]).buffer;
    expect(inspectEvidence(png,'image/png').extension).toBe('png');
    expect(inspectEvidence(png,'image/jpeg').mimeType).toBe('image/png');
    const pdf=new TextEncoder().encode('%PDF-1.7 synthetic').buffer;
    expect(inspectEvidence(pdf,'application/pdf').extension).toBe('pdf');
    const heic=new Uint8Array([0,0,0,24,102,116,121,112,104,101,105,99,0,0,0,0]).buffer;
    expect(inspectEvidence(heic,'application/octet-stream')).toEqual({mimeType:'image/heic',extension:'heic'});
    const gif=new TextEncoder().encode('GIF89a synthetic').buffer;
    expect(inspectEvidence(gif,'application/octet-stream').extension).toBe('gif');
    expect(()=>inspectEvidence(new TextEncoder().encode('<html>bad</html>').buffer,'text/html')).toThrow(/fail gambar sebenar/);
  });
  it('ships the 25 MB database contract without weakening wallet idempotency',()=>{
    const migration=fs.readFileSync('supabase/migrations/00029_payment_evidence_mobile_formats.sql','utf8');
    expect(migration).toContain('26214400');
    expect(migration).toContain('image/heic');
    expect(migration).toContain('image/heif');
    expect(migration).toContain('orders_receipt_size_check');
    expect(migration).not.toMatch(/UPDATE\s+(credit_wallets|orders)|INSERT\s+INTO\s+credit_ledger/i);
  });
  it('restores an unresolved QR checkout after refresh so customers can retry the same order',()=>{
    const page=fs.readFileSync('src/app/(dashboard)/billing/page.tsx','utf8');
    expect(page).toContain("order.paymentState==='PAYMENT_UNVERIFIED'");
    expect(page).toContain('pending.gatewayReference');
    expect(page).toContain('Pesanan sedia ada dipulihkan');
    expect(page).toContain('tak perlu buat pesanan baharu');
  });
  it('ships a professional black QR asset whose decoded payment payload is unchanged',async()=>{
    const asset='release-assets/qr/affimatik-tng-duitnow-black.png';
    const image=sharp(asset).ensureAlpha();
    const {data,info}=await image.raw().toBuffer({resolveWithObject:true});
    const decoded=jsQR(new Uint8ClampedArray(data),info.width,info.height);
    expect(decoded).not.toBeNull();
    expect(crypto.createHash('sha256').update(decoded!.data).digest('hex')).toBe('a5861dab97ce3008100111dabc84e8b160553ee3f849c6a8491aa4c7197a6aa8');
    expect(info.width).toBe(1024);
    expect(info.height).toBe(1024);
  });
  it('fails closed for unauthenticated checkout, receipt and admin settings',async()=>{
    expect((await checkout(new NextRequest('https://affimatik.test/api/billing/checkout',{method:'POST',body:'{}'}))).status).toBe(401);
    expect((await receipt(new NextRequest('https://affimatik.test/api/billing/qr-receipt',{method:'POST'}))).status).toBe(401);
    expect((await adminSettings(new NextRequest('https://affimatik.test/api/admin/billing-settings'))).status).toBe(403);
  });
  it('ships additive atomic anti-replay and affiliate-safe SQL with a non-destructive rollback',()=>{
    const migration=fs.readFileSync('supabase/migrations/00020_qr_express_checkout.sql','utf8');
    const v72=fs.readFileSync('supabase/migrations/00023_v72_pricing_and_credit_buckets.sql','utf8');
    expect(migration).toContain('provision_qr_order_atomic');
    expect(migration).toContain('pg_advisory_xact_lock');
    expect(migration).toContain('orders_receipt_sha256_once');
    expect(migration).toContain("payment_state='CREDITS_PROVISIONALLY_GRANTED'");
    expect(migration).toContain("payment_state='BANK_PAYMENT_VERIFIED'");
    expect(migration.indexOf('affiliate_commissions')).toBeGreaterThan(migration.indexOf('verify_qr_order_payment_atomic'));
    expect(v72).toContain('automatic_credit_grant');
    expect(v72).toContain('requires_bank_verification');
    expect(v72).not.toContain('QR_PROVISIONAL_CREDITS_GRANTED');
    const instant=fs.readFileSync('supabase/migrations/00024_instant_qr_full_access.sql','utf8');
    expect(instant).toContain('PROVISIONALLY_ACTIVE');
    expect(instant).toContain('UNRESOLVED_QR_ORDER_EXISTS');
    expect(instant).toContain('PAYMENT_HOLD');
    expect(instant).toContain("credits_regranted',false");
    expect(instant.indexOf("payment_state='PAYMENT_CONFIRMED'")).toBeLessThan(instant.indexOf('affiliate_commissions'));
    const rollback=fs.readFileSync('supabase/rollback/00020_qr_express_checkout.sql','utf8');
    expect(rollback).toContain('"autoFulfillEnabled":false');
    expect(rollback).not.toMatch(/DROP TABLE|DROP COLUMN|DELETE FROM orders/i);
  });
});
