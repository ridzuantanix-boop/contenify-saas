import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DynamicPromptCompiler } from '../../src/lib/engine/compiler';
import type { ProductProfile, ScenePlan } from '../../src/lib/engine/types';
import { getVideoStyle } from '../../src/lib/styles/registry';

const repo=resolve(import.meta.dirname,'..','..');
const out=resolve(repo,'output/provider-qa/demo-replacement-v1');
mkdirSync(resolve(out,'prompts'),{recursive:true});
const ownerRoot='C:/Users/user/.codex/codex-remote-attachments/01a1a93c-06c3-7a63-9909-599706e05606';
const products={
  sherb:{label:'Owner screenshot · Minyak Herba S-HERB',path:`${ownerRoot}/A26B9D5E-5503-41BD-9CCF-A94B485CE8DF/1-Photo-1.jpg`},
  vitamin:{label:'Owner product image · Vitamin C+E',path:`${ownerRoot}/BDED2172-20A7-4BB5-86B1-1F18CCFDDD81/2-Photo-2.jpg`},
  seriya:{label:'SERIYA Radiance Serum',path:resolve(repo,'scripts/release/assets/premium-products/seriya-serum.png')},
  veile:{label:'VEILÉ Sun Fluid SPF 50',path:resolve(repo,'scripts/release/assets/premium-products/veile-sun-fluid.png')},
  lumea:{label:'LUMÉA Collagen Glow+',path:resolve(repo,'scripts/release/assets/premium-products/lumea-collagen.png')},
  aromae:{label:'AROMAÉ Home Mist',path:resolve(repo,'scripts/release/assets/premium-products/aromae-home-mist.png')},
  potonggo:{label:'POTONGGO Manual Chopper',path:resolve(repo,'scripts/release/assets/premium-products/potonggo-chopper.png')},
} as const;
const plan=[
 ['NX01','sherb','tekan beg kuning'],['NX02','vitamin','tekan butang di bawah'],['NX03','seriya','tengok detail dekat bawah'],
 ['NX05','lumea','kalau nak cuba, tekan beg kuning'],['NX07','veile','kalau nak tengok lebih lanjut, klik butang di bawah'],
 ['NX09','sherb','kalau nak semak, boleh tekan di bawah'],['NX10','vitamin','tekan beg kuning'],
 ['RH01','seriya','tekan butang di bawah'],['RH02','veile','tengok detail dekat bawah'],['RH03','lumea','kalau nak cuba, tekan beg kuning'],
 ['RH04','vitamin','kalau nak tengok lebih lanjut, klik butang di bawah'],['RH17','vitamin','kalau nak semak, boleh tekan di bawah'],
 ['RH19','aromae','tekan beg kuning'],['NX11','sherb','tekan butang di bawah'],['NX12','seriya','tengok detail dekat bawah'],
 ['NX13','potonggo','kalau nak cuba, tekan beg kuning'],['NX14','vitamin','kalau nak tengok lebih lanjut, klik butang di bawah'],
 ['NX15','lumea','kalau nak semak, boleh tekan di bawah'],['NX16','veile','tekan beg kuning'],['NX17','seriya','tekan butang di bawah'],
] as const;
if(plan.length!==20||new Set(plan.map(row=>row[0])).size!==20)throw new Error('Campaign must contain exactly 20 unique styles.');
const sha=(data:Buffer|string)=>createHash('sha256').update(data).digest('hex');
const neutral:ProductProfile={name:'',spokenShortName:'',category:'',brand:'',packagingFormat:'general',shapeDescription:'',dominantColors:[],observedPhysicalFacts:[],coreFunction:'',confirmedFeatures:[],unknownFields:['All product-specific attributes must be interpreted conservatively from the supplied image.'],prohibitedClaims:['Unsupported product facts, medical outcomes, efficacy, ingredients, price, popularity, testimonial, guarantee and personal-use claims.'],sourceConfidence:'ai_interpreted',provenance:'manual_user_entry',isVisionSupported:false};
const handLed=new Set(['NX09','NX10','RH01','RH02','RH03','RH04','RH17','RH19','NX11']);
const jobs:Array<{styleId:string;productKey:string;productLabel:string;imagePath:string;imageSha256:string;imageBytes:number;cta:string;promptPath:string;promptLength:number;promptSha256:string;promptVersion?:string;mediaCount:number;mediaOrder:string[];productFramePercentage:string;preflightValid:boolean}>=[];
for(const [styleId,productKey,cta] of plan){
 const product=products[productKey];if(!existsSync(product.path))throw new Error(`Missing ${product.path}`);
 const style=getVideoStyle(styleId);if(!style)throw new Error(`Missing style ${styleId}`);
 const scene:ScenePlan={mainSubject:handLed.has(styleId)?'One naturally proportioned sleeve-covered adult hand presenting the exact supplied product; no face unless the selected style explicitly requires a presenter':'One modest adult Malaysian creator naturally presenting the exact supplied product',location:'A newly composed ordinary Malaysian environment chosen by Nexabot from the recognized product category and selected style; never copy the source-image composition',lighting:'Believable bright natural Malaysian daylight without polished television-ad grading',cameraDistance:'Realistic smartphone 1x framing; the complete physical product occupies approximately 20–30% of the vertical frame and never dominates the composition',cameraMovement:'Natural handheld micro-movement appropriate to the selected style',startPose:'A new live-action opening with natural human or hand movement from frame zero; never the uploaded image as first frame',actionProgression:'One style-specific motivated action with credible product weight and stable identity',endPose:'Complete the selected CTA, then only a short natural silent physical ending',primaryAction:'Create a persuasive Malaysian affiliate moment while preserving exact visible product identity at 20–30% frame scale',audioPolicy:handLed.has(styleId)?'off_camera_narration':'spoken_bm',targetDurationSeconds:15};
 const creativeInstruction='Nexabot independently interprets the two byte-identical product references and creates all product-specific dialogue. The product should occupy approximately 20% to 30% of the vertical frame, remain fully recognizable and never appear giant, doubled or 2–3 times plausible size. The two references are identity ingredients only, never start frames or source compositions. Exclude every marketplace UI element, app border, button, price, search bar and screenshot background. Use a real Malaysian affiliate hook, one relevant product point and the selected CTA; avoid packaging narration and do not invent objectively false facts, medical outcomes, personal experience, price, review count or performance guarantee.';
 const compiled=DynamicPromptCompiler.compile(neutral,style,scene,{callToAction:'custom',customCta:cta,imageRole:'reference',isMuslimahModest:true,audioTreatment:'voiceover',creativeInstruction});
 if(!compiled.preflightValid)throw new Error(`${styleId}: ${compiled.validationErrors.join('; ')}`);
 if(/S-HERB|Vitamin C\+E|SERIYA|VEIL[ÉE]|LUM[ÉE]A|AROMA[ÉE]|POTONGGO/i.test(compiled.providerPrompt))throw new Error(`${styleId}: product hardcoding leaked into provider prompt.`);
 const promptPath=resolve(out,'prompts',`${styleId}.txt`);writeFileSync(promptPath,compiled.providerPrompt,'utf8');
 const bytes=readFileSync(product.path);
 jobs.push({styleId,productKey,productLabel:product.label,imagePath:product.path,imageSha256:sha(bytes),imageBytes:bytes.length,cta,promptPath,promptLength:compiled.providerPrompt.length,promptSha256:sha(compiled.providerPrompt),promptVersion:compiled.promptVersion,mediaCount:2,mediaOrder:['same-source-image','same-source-image'],productFramePercentage:'20-30%',preflightValid:true});
}
const manifest={campaign:'AFFIMATIK_DEMO_REPLACEMENT_V1',createdAt:new Date().toISOString(),provider:'Nexabot',model:'omni_flash',mode:'i2v',duration:15,resolution:720,ratio:2,useUnlimited:false,exactPaidSubmissionLimit:20,expectedCostPerJob:0.3,maximumExpectedDebit:6.0,productionDeploymentAuthorized:true,productionCustomerWalletImpact:'NONE',jobs};
writeFileSync(resolve(out,'manifest.json'),JSON.stringify(manifest,null,2));
console.log(JSON.stringify({jobs:jobs.length,products:[...new Set(jobs.map(job=>job.productLabel))],ctaDistribution:Object.fromEntries([...new Set(jobs.map(job=>job.cta))].map(cta=>[cta,jobs.filter(job=>job.cta===cta).length])),promptLengths:{min:Math.min(...jobs.map(job=>job.promptLength)),max:Math.max(...jobs.map(job=>job.promptLength))}},null,2));
