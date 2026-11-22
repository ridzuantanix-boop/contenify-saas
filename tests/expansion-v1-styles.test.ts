import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DynamicPromptCompiler } from '@/lib/engine/compiler';
import { STYLE_DIRECTORS } from '@/lib/engine/style-directors';
import { getVideoStyle, VIDEO_STYLES_REGISTRY } from '@/lib/styles/registry';
import { STYLE_MARKETING_METADATA } from '@/lib/styles/marketing-metadata';
import type { ProductProfile, ScenePlan } from '@/lib/engine/types';

const ids = ['NX21','NX22','NX23','NX24','NX25','NX26','NX27','NX28','NX29','NX30'];
const product:ProductProfile={name:'the uploaded product image',category:'product shown',packagingFormat:'general',spokenShortName:'produk ini',confirmedFeatures:[],prohibitedClaims:['invented claims'],unknownFields:['material','size'],sourceConfidence:'manual_fallback',provenance:'manual_user_entry',isVisionSupported:false};
const scene:ScenePlan={mainSubject:product.name,location:'provider-selected relevant setting',lighting:'neutral daylight',cameraDistance:'smartphone 1x',cameraMovement:'style-specific continuous action',startPose:'natural',actionProgression:'style-specific action',endPose:'natural',primaryAction:'style-specific action',audioPolicy:'spoken_bm',targetDurationSeconds:15};

describe('Expansion V1 NX21-NX30',()=>{
  it('adds ten distinct Nexabot styles without mutating the existing twenty IDs',()=>{
    expect(VIDEO_STYLES_REGISTRY.slice(0,20).map(style=>style.id)).toEqual([
      'NX01','NX02','NX03','NX05','NX07','NX09','NX10','RH01','RH02','RH03','RH04','RH17','RH19','NX11','NX12','NX13','NX14','NX15','NX16','NX17',
    ]);
    expect(VIDEO_STYLES_REGISTRY.slice(20).map(style=>style.id)).toEqual(ids);
    expect(new Set(ids.map(id=>STYLE_DIRECTORS[id].concept)).size).toBe(10);
    expect(ids.slice(0,6).every(id=>getVideoStyle(id)?.category==='fashion')).toBe(true);
  });

  it('publishes all owner-approved expansion media',()=>{
    const approvedIds = new Set(ids);
    for(const id of ids){
      const approved = approvedIds.has(id);
      expect(getVideoStyle(id)?.qualityStatus).toBe(approved ? 'video_tested' : 'prompt_validated');
      expect(getVideoStyle(id)?.previewVideoUrl).toBe(approved ? `/api/style-samples/${id}` : null);
      expect(STYLE_MARKETING_METADATA[id as keyof typeof STYLE_MARKETING_METADATA].previewStatus).toBe(approved ? 'verified_media' : 'development_placeholder');
    }
  });

  it('compiles ten distinct compact provider-owned directors',()=>{
    const prompts=ids.map(id=>DynamicPromptCompiler.compile(product,getVideoStyle(id)!,scene,{callToAction:'tiktok_shop'}));
    expect(new Set(prompts.map(item=>item.providerPrompt)).size).toBe(10);
    for(const [index,item] of prompts.entries()){
      expect(item.preflightValid,ids[index]).toBe(true);
      expect(item.providerPrompt.length,ids[index]).toBeLessThanOrEqual(1000);
      expect(item.providerPrompt).toContain(`[${ids[index]}]`);
      expect(item.providerPrompt).toContain('compact product 8-12% frame, max 15%');
      expect(item.providerPrompt).toContain('Final CTA once');
    }
  });

  it('retains true-white and Malaysian voice direction in compact form',()=>{
    for(const id of ['NX01',...ids]){
      const prompt=DynamicPromptCompiler.compile(product,getVideoStyle(id)!,scene).providerPrompt;
      expect(prompt).toContain('Neutral daylight, true whites');
      expect(prompt).toContain('BM Malaysia');
      expect(prompt).not.toContain('warm golden cinematic lighting');
    }
  });

  it('keeps effective audio distinct and the kid style faceless',()=>{
    for(const id of ids){
      const prompt=DynamicPromptCompiler.compile(product,getVideoStyle(id)!,scene).providerPrompt;
      const voiceover=['NX25','NX26','NX27','NX28'].includes(id);
      expect(prompt).toContain(voiceover?'Lively BM Malaysia voiceover':'Lively BM Malaysia presenter');
      expect(prompt).not.toContain('Only synchronized handling ASMR');
    }
    expect(DynamicPromptCompiler.compile(product,getVideoStyle('NX25')!,scene).providerPrompt).toContain('No child actor; garment only');
  });

  it('preserves NX23 and NX27 style identities without old long prose',()=>{
    const nx23=DynamicPromptCompiler.compile(product,getVideoStyle('NX23')!,scene,{callToAction:'click_button'}).providerPrompt;
    const nx27=DynamicPromptCompiler.compile(product,getVideoStyle('NX27')!,scene,{callToAction:'click_button'}).providerPrompt;
    expect(nx23).toContain(STYLE_DIRECTORS.NX23.concept);
    expect(nx27).toContain(STYLE_DIRECTORS.NX27.concept);
    for(const prompt of [nx23,nx27]){
      expect(prompt).toContain('Neutral daylight, true whites');
      expect(prompt).toContain('covered wrists');
      expect(prompt).toContain('Final CTA once');
      expect(prompt.length).toBeLessThanOrEqual(1000);
    }
  });

  it('keeps the mobile picker responsive and labels unverified media clearly',()=>{
    const factory=readFileSync('src/app/(dashboard)/factory/page.tsx','utf8');
    const media=readFileSync('src/components/styles/style-poster-media.tsx','utf8');
    expect(factory).toContain('grid-cols-2');
    expect(factory).toContain("style.qualityStatus === 'video_tested'");
    expect(factory).toContain('Prompt Staging');
    expect(media).toContain('Belum ada preview sebenar');
    expect(media).toContain("metadata.previewStatus === 'verified_media'");
  });

  it('uses an additive preset migration for all ten IDs',()=>{
    const sql=readFileSync('supabase/migrations/00032_expansion_v1_styles.sql','utf8');
    for(const id of ids)expect(sql).toContain(`('${id}'`);
    expect(sql).toContain('ON CONFLICT (id) DO NOTHING');
    expect(sql).not.toMatch(/\b(?:DELETE|DROP|TRUNCATE|UPDATE)\b/i);
  });
});

