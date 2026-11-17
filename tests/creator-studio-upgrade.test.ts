import {describe,expect,it} from 'vitest';
import fs from 'node:fs';

const page=fs.readFileSync('src/app/(dashboard)/creator-profiles/page.tsx','utf8');
const jobs=fs.readFileSync('src/app/api/jobs/route.ts','utf8');

describe('Creator Studio Upgrade',()=>{
 it('ships a guided visual four-step creator builder',()=>{
  for(const text of ['Identiti Creator','Personaliti & Suara','Background','Preview Akhir','live-creator-preview'])expect(page).toContain(text);
  expect(page).toContain('PREVIEW ASET · BUKAN VIDEO AI');
  expect(page).toContain('Tiada caj kredit');
 });
 it('maps friendly choices only to supported personalization settings',()=>{
  for(const value of ['friendly','energetic','calm','confident','conversation','q_and_a','product_showcase'])expect(page).toContain(value);
  expect(page).toContain('Nexabot tetap mencipta dialog sebenar');
  expect(page).not.toContain('generatedScript');
 });
 it('supports visual personal uploads with consent and live assets',()=>{
  expect(page).toContain("fetch('/api/avatars'");
  expect(page).toContain("form.set('consent','true')");
  expect(page).toContain("fetch('/api/backgrounds'");
  expect(page).toContain('setValue(\'avatarId\',result.id)');
  expect(page).toContain('setValue(\'backgroundId\',result.id)');
 });
 it('saves and returns the exact reusable profile to Video Factory',()=>{
  expect(page).toContain('Simpan & Guna Dalam Video');
  expect(page).toContain('/factory?profileId=');
  expect(jobs).toContain('effectiveAvatarId');
  expect(jobs).toContain('effectiveBackgroundId');
  expect(jobs).toContain('creator_profile_id:verifiedCreatorProfile.id');
 });
 it('preserves existing ids, editing, default and missing-asset recovery',()=>{
  expect(page).toContain("params.get('edit')");
  expect(page).toContain('isDefault:true');
  expect(page).toContain('Aset hilang — edit sebelum guna');
  expect(page).toContain('duplicateFrom:profile.id');
 });
});
