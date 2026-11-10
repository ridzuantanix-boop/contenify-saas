import { describe,expect,it } from 'vitest';
import fs from 'node:fs';
import manifest from '../src/app/manifest';

describe('AffiMatik Admin & CRM PWA',()=>{
 it('is installable with mobile admin and CRM shortcuts',()=>{
  const value=manifest();
  expect(value.name).toBe('AffiMatik Admin & CRM');
  expect(value.start_url).toBe('/admin');
  expect(value.display).toBe('standalone');
  expect(value.icons?.map(icon=>icon.sizes)).toEqual(['192x192','512x512']);
  expect(value.shortcuts?.map(item=>item.url)).toEqual(expect.arrayContaining(['/admin','/admin?tab=users','/admin/finance-ops','/admin/affiliates']));
  for(const file of ['public/admin-pwa-icon-192.png','public/admin-pwa-icon-512.png'])expect(fs.statSync(file).size).toBeGreaterThan(5000);
 });
 it('never caches authentication, admin HTML, APIs, media or customer data',()=>{
  const worker=fs.readFileSync('public/sw.js','utf8');
  expect(worker).toContain("request.mode==='navigate'");
  expect(worker).toContain("url.pathname.startsWith('/api/')");
  expect(worker).toContain("url.pathname.startsWith('/admin')");
  expect(worker).toContain("url.pathname.includes('/stream')");
  expect(worker).not.toMatch(/localStorage|indexedDB/);
 });
 it('keeps server-side admin authentication and provides phone install guidance',()=>{
  const control=fs.readFileSync('src/components/admin/admin-pwa-control.tsx','utf8');
  const layout=fs.readFileSync('src/app/(dashboard)/admin/layout.tsx','utf8');
  expect(control).toContain("navigator.serviceWorker.register('/sw.js'");
  expect(control).toContain('Add to Home Screen');
  expect(control).toContain('Admin login tetap diperlukan');
  expect(layout).toContain("fetch('/api/auth/admin-login'");
  expect(layout).toContain('<AdminPwaControl />');
 });
});
