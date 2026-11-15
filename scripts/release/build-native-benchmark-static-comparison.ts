import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DynamicPromptCompiler } from '../../src/lib/engine/compiler';
import type { ProductProfile, ScenePlan } from '../../src/lib/engine/types';
import { getVideoStyle } from '../../src/lib/styles/registry';

const root=resolve(import.meta.dirname,'..','..');
const out=resolve(root,'output/provider-qa/nexabot-native-intelligence-v1');
const manifest=JSON.parse(readFileSync(resolve(out,'manifest.json'),'utf8'));
const hash=(text:string)=>createHash('sha256').update(text).digest('hex');
const neutralProduct:ProductProfile={name:'',spokenShortName:'',category:'',brand:'',packagingFormat:'general',shapeDescription:'',dominantColors:[],observedPhysicalFacts:[],coreFunction:'',confirmedFeatures:[],unknownFields:['All product-specific attributes are unknown until interpreted from the supplied image.'],prohibitedClaims:['Unsupported product facts, performance, efficacy, ingredients, price, popularity, testimonial and personal-use claims.'],sourceConfidence:'low',provenance:'unverified',isVisionSupported:false};
const cases=[
 {id:'A',styleId:'NX01',cta:'tekan beg kuning',audio:'voiceover' as const,subject:'One adult Malaysian presenter naturally handling the supplied product reference'},
 {id:'B',styleId:'NX17',cta:'tekan butang di bawah',audio:'voiceover' as const,subject:'One adult Malaysian presenter making a spontaneous product recommendation'},
 {id:'C',styleId:'NX09',cta:'semak dekat bio',audio:'voiceover' as const,subject:'One covered hand naturally handling the supplied product reference; no face'},
];
mkdirSync(resolve(out,'static-compiler'),{recursive:true});
const results=[];
for(const item of cases){
 const style=getVideoStyle(item.styleId);if(!style)throw new Error(`Missing ${item.styleId}`);
 const scene:ScenePlan={mainSubject:item.subject,location:'A new physically and culturally relevant Malaysian setting chosen from the product image and selected style; do not copy the source composition',lighting:'Natural believable light appropriate to the chosen scene',cameraDistance:'Realistic smartphone 1x framing with plausible product scale',cameraMovement:'Natural restrained handheld movement appropriate to the style',startPose:'A newly composed live-action opening, not the supplied source frame',actionProgression:'Style-appropriate natural performance without invented product capability',endPose:'CTA completes, followed only by a natural silent physical ending',primaryAction:'Present the exact referenced product while preserving identity and plausible scale',audioPolicy:item.id==='C'?'off_camera_narration':'spoken_presenter',targetDurationSeconds:15};
 const compiled=DynamicPromptCompiler.compile(neutralProduct,style,scene,{callToAction:'custom',customCta:item.cta,imageRole:'reference',isMuslimahModest:true,audioTreatment:item.audio,creativeInstruction:'Nexabot must independently interpret the supplied image. No product name, category, function, benefit, feature, buyer problem or product-specific dialogue is supplied by AffiMatik.'});
 const path=resolve(out,'static-compiler',`${item.id.toLowerCase()}-${item.styleId.toLowerCase()}.txt`);writeFileSync(path,compiled.providerPrompt,'utf8');
 const direct=manifest.tests.find((test:any)=>test.id===item.id);
 results.push({id:item.id,styleId:item.styleId,directPromptLength:direct.promptLength,directPromptSha256:direct.promptSha256,compilerPromptLength:compiled.providerPrompt.length,compilerPromptSha256:hash(compiled.providerPrompt),compilerPreflightValid:compiled.preflightValid,compilerValidationErrors:compiled.validationErrors,compilerAddedExplicitSceneFields:Object.values(scene),containsInternalScript:/\b(FULL SCRIPT|SCRIPT TO SPEAK|say exactly|dialogue:)\b/i.test(compiled.providerPrompt),containsBlankProductFallback:/produk tanpa nama|unnamed product/i.test(compiled.providerPrompt),audioMentions:[...new Set(compiled.providerPrompt.match(/spoken presenter|off-camera voiceover|no speech|ambient|ASMR/gi)||[])],path});
}
writeFileSync(resolve(out,'static-direct-vs-compiler.json'),JSON.stringify({createdAt:new Date().toISOString(),providerSubmissions:0,note:'Static comparison only; it is not a real video A/B result.',results},null,2));
console.log(JSON.stringify(results,null,2));
