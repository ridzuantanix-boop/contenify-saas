import {describe,expect,it} from 'vitest';
import fs from 'node:fs';

const read=(path:string)=>fs.readFileSync(path,'utf8');

describe('AffiMatik UX Rescue V1',()=>{
  it('makes Jana Video the clear primary journey and keeps legacy routes compatible',()=>{
    const nav=read('src/components/layout/sidebar.tsx');
    expect(nav).toContain("{ name: 'Jana Video', href: '/factory'");
    expect(nav).toContain("{ name: 'Video Saya', href: '/library'");
    expect(nav).toContain("{ name: 'Produk Saya', href: '/products'");
    expect(nav).toContain("{ name: 'Auto Factory', href: '/auto-factory'");
  });

  it('surfaces real Creator Profiles inside the simple factory flow',()=>{
    const page=read('src/app/(dashboard)/factory/page.tsx');
    const picker=read('src/components/factory/creator-profile-selector.tsx');
    expect(page).toContain("fetch('/api/creator-profiles'");
    expect(page).toContain('CreatorProfileSelector');
    expect(page).toContain('creatorProfileId: selectedCreatorProfileId');
    expect(page).toContain('generation-summary');
    expect(picker).toContain('Pilih Creator Profile');
    expect(picker).toContain('/creator-profiles?new=1&returnTo=factory');
    expect(picker).toContain('Cipta Creator Baru');
    expect(picker).toContain('Creator Profile digunakan:');
    expect(picker).toContain('Edit di Creator Studio');
  });

  it('verifies profile ownership and applies the actual assets server-side',()=>{
    const route=read('src/app/api/jobs/route.ts');
    expect(route).toContain('creator_profiles?id=eq.${encodeURIComponent(creatorProfileId)}&workspace_id=eq.${encodeURIComponent(workspaceId)}');
    expect(route).toContain('effectiveAvatarId');
    expect(route).toContain('effectiveBackgroundId');
    expect(route).toContain('creatorProfileVersion');
    expect(route).toContain('creator_profile_id:verifiedCreatorProfile.id');
    expect(route).toContain('generation_snapshot:snapshot');
  });

  it('preserves profile and style when moving to bulk generation',()=>{
    const factory=read('src/app/(dashboard)/factory/page.tsx');
    const auto=read('src/app/(dashboard)/auto-factory/page.tsx');
    expect(factory).toContain('/auto-factory?profileId=');
    expect(auto).toContain("params.get('profileId')");
    expect(auto).toContain("params.get('styleId')");
  });

  it('blocks incompatible avatar styles before credit admission',()=>{
    const factory=read('src/app/(dashboard)/factory/page.tsx');
    const route=read('src/app/api/jobs/route.ts');
    expect(factory).toContain('personalizationError');
    expect(factory).toContain('Gaya ${selectedStyle.name} tidak menggunakan avatar presenter');
    expect(route).toContain('Gaya tangan/produk ini tidak menggunakan avatar presenter');
  });
});
