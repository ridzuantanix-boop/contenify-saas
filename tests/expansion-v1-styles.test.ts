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

  it('marks new media honestly as prompt-validated development placeholders',()=>{
    for(const id of ids){
      expect(getVideoStyle(id)?.qualityStatus).toBe('prompt_validated');
      expect(getVideoStyle(id)?.previewVideoUrl).toBeNull();
      expect(STYLE_MARKETING_METADATA[id as keyof typeof STYLE_MARKETING_METADATA].previewStatus).toBe('development_placeholder');
    }
  });

  it('compiles unique provider-owned directors with Shariah, scale, CTA and reference locks',()=>{
    const prompts=ids.map(id=>DynamicPromptCompiler.compile(product,getVideoStyle(id)!,scene,{callToAction:'tiktok_shop'}).providerPrompt);
    expect(new Set(prompts).size).toBe(10);
    for(const [index,prompt] of prompts.entries()){
      expect(prompt).toContain(`[STYLE ${ids[index]} — PREDEFINED CONFIGURATION]`);
      expect(prompt).toContain('[SHARIAH MODESTY LOCK');
      expect(prompt).toContain('[PRODUCT SCALE LOCK]');
      expect(prompt).toContain('larger products retain their plausible real dimensions');
      expect(prompt).toContain('Nexabot alone creates the product-specific hook, story, dialogue, selling angle, FOMO');
      expect(prompt).toContain('[TRUE-WHITE REAL PHONE COLOUR]');
      expect(prompt).toContain('Genuinely white surfaces stay white');
      expect(prompt).toContain('[NATURAL MALAYSIAN VOICE]');
      expect(prompt).toContain('Nexabot remains the sole writer of every spoken sentence');
      expect(prompt).toContain('[NO FAKE SELF-USE TESTIMONIAL — STRICT]');
      expect(prompt).toContain('age-appropriate delivery');
      expect(prompt).toContain('Speak it naturally once as the final utterance');
      expect(prompt).toContain('References are not start frames');
      expect(prompt).not.toContain('Script:');
    }
  });

  it('applies REAL V3 compact colour and voice foundations to all 30 styles',()=>{
    const expansionPrompt=DynamicPromptCompiler.compile(product,getVideoStyle('NX21')!,scene,{callToAction:'tiktok_shop'}).providerPrompt;
    const productionPrompt=DynamicPromptCompiler.compile(product,getVideoStyle('NX01')!,scene,{callToAction:'tiktok_shop'}).providerPrompt;
    expect(expansionPrompt).toContain('Avoid global yellow, cream, amber, sepia or muddy grading');
    expect(expansionPrompt).toContain('Do not force a universal catchphrase, banned-word list or identical presenter personality');
    expect(expansionPrompt).not.toContain('Avoid formulaic ad phrases, forced slang, repeated “lah/la”');
    expect(expansionPrompt).not.toContain('warm golden cinematic lighting');
    expect(expansionPrompt).not.toContain('cream-coloured white surfaces');
    expect(productionPrompt).toContain('[TRUE-WHITE REAL PHONE COLOUR]');
    expect(productionPrompt).toContain('[NATURAL MALAYSIAN VOICE]');
    expect(productionPrompt).toContain('[REAL V3 NATIVE SPEECH CONTRACT]');
  });

  it('keeps audio contracts non-contradictory and kid presentation faceless',()=>{
    for(const id of ids){
      const prompt=DynamicPromptCompiler.compile(product,getVideoStyle(id)!,scene).providerPrompt;
      const expected=['NX25','NX26','NX27','NX28'].includes(id)?'OFF-CAMERA VOICEOVER':'SPOKEN PRESENTER';
      expect(prompt).toContain(`Effective audio mode: ${expected}`);
      expect(prompt.match(/Effective audio mode:/g)).toHaveLength(1);
    }
    expect(STYLE_DIRECTORS.NX25.presenterVisibility).toContain('No child face');
  });

  it('applies only the evidence-backed NX23 and NX27 defect corrections',()=>{
    const nx23=DynamicPromptCompiler.compile(product,getVideoStyle('NX23')!,scene,{callToAction:'click_button'}).providerPrompt;
    const nx27=DynamicPromptCompiler.compile(product,getVideoStyle('NX27')!,scene,{callToAction:'click_button'}).providerPrompt;
    expect(nx23).toContain('plain neutral daylight dressing wall physically unrelated to the source retail display');
    expect(nx23).toContain('Do not inherit warm boutique lighting, cream décor or the source-image background');
    expect(nx23).toContain('Nexabot freely chooses natural product-specific wording and persuasive rhythm');
    expect(nx23).toContain('Only visible colour, pattern, shape, drape and customer-confirmed fabric facts');
    expect(nx23).toContain('omit unsupported comfort, cooling, non-slip, easy-styling and time-saving claims');
    expect(nx23).toContain('transition directly into the selected CTA once with no repeated lead-in');
    expect(nx27).toContain('bright, naturally exposed Malaysian home kitchen with neutral daylight-balanced whites');
    expect(nx27).toContain('a loose opaque sleeve must cover the forearm and wrist continuously');
    expect(nx27).toContain('Nexabot freely creates a product-relevant selling flow around the believable cooking action');
    expect(nx27).toContain('never infer rapid heating, heat distribution, coating, durability or cooking performance');
    expect(nx27).toContain('Give the selected CTA enough unhurried conversational room to finish naturally');
    expect(nx27).not.toContain('mandatory short script');
    expect(nx27).not.toContain('fixed silence');
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

