import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DynamicPromptCompiler } from '../../src/lib/engine/compiler';
import type { ProductProfile, ScenePlan } from '../../src/lib/engine/types';
import { getVideoStyle } from '../../src/lib/styles/registry';

const ids=['NX21','NX22','NX23','NX24','NX25','NX26','NX27','NX28','NX29','NX30'];
const root=path.resolve('output/expansion-v1-qa/prompts');
await mkdir(root,{recursive:true});
const rows=[];
for(const id of ids){
  const fashion=Number(id.slice(2))<=26;
  const product:ProductProfile={
    name:fashion?'uploaded garment reference':'uploaded kitchen product reference',
    category:fashion?'modest fashion garment':'kitchen product',
    packagingFormat:'general',spokenShortName:fashion?'pakaian ini':'produk dapur ini',
    confirmedFeatures:[],prohibitedClaims:['invented fit, performance or efficacy'],unknownFields:['material','size','performance'],
    sourceConfidence:'manual_fallback',provenance:'manual_user_entry',isVisionSupported:false,
  };
  const scene:ScenePlan={mainSubject:product.name,location:'provider-selected relevant setting',lighting:'neutral daylight',cameraDistance:'smartphone 1x',cameraMovement:'style-specific continuous action',startPose:'natural',actionProgression:'style-specific action',endPose:'natural',primaryAction:'style-specific action',audioPolicy:getVideoStyle(id)!.audioMode,targetDurationSeconds:15};
  const compiled=DynamicPromptCompiler.compile(product,getVideoStyle(id)!,scene,{callToAction:id==='NX21'?'tiktok_shop':'click_button'});
  await writeFile(path.join(root,`${id}.txt`),compiled.providerPrompt,'utf8');
  rows.push({id,promptVersion:compiled.promptVersion,length:compiled.providerPrompt.length,preflightValid:compiled.preflightValid,audio:getVideoStyle(id)!.audioMode,preview:'development_placeholder'});
}
await writeFile(path.join(root,'summary.json'),JSON.stringify(rows,null,2),'utf8');
console.log(JSON.stringify(rows));

