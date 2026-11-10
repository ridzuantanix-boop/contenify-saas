import { DurableStore } from '@/lib/db/store';
import { DynamicPromptCompiler } from '@/lib/engine/compiler';
import { ProductProfile,ScenePlan } from '@/lib/engine/types';
import { sanitizePersonalizationSettings } from '@/lib/personalization/config';
import { getVideoStyle } from '@/lib/styles/registry';

const base=()=>String(process.env.SUPABASE_URL||'').replace(/\/$/,'');
const key=()=>String(process.env.SUPABASE_SERVICE_ROLE_KEY||'');
export const headers=()=>{if(!base()||!key())throw new Error('Auto Factory database unavailable.');return{apikey:key(),Authorization:`Bearer ${key()}`,'Content-Type':'application/json'}};
export async function dbRows<T>(path:string):Promise<T[]>{const r=await fetch(`${base()}/rest/v1/${path}`,{headers:headers(),cache:'no-store'});if(!r.ok)throw new Error(`Auto Factory DB HTTP ${r.status}: ${await r.text()}`);return r.json() as Promise<T[]>}
export async function dbWrite<T=unknown>(path:string,method:string,body:unknown,prefer='return=representation'):Promise<T>{const r=await fetch(`${base()}/rest/v1/${path}`,{method,headers:{...headers(),Prefer:prefer},body:JSON.stringify(body)});const text=await r.text();if(!r.ok)throw new Error(`Auto Factory DB HTTP ${r.status}: ${text}`);return(text?JSON.parse(text):undefined) as T}
export async function rpc<T=Record<string,unknown>>(name:string,body:unknown):Promise<T>{return dbWrite<T>(`rpc/${name}`,'POST',body)}

export function seededStylePlan(productIds:string[],styleIds:string[],videosPerProduct:number,seed:string,mode:'QUICK_BULK'|'AUTO_MIX'|'DAILY_AUTO'){
 const hash=(value:string)=>{let h=2166136261;for(const char of value){h^=char.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0};
 const styles=styleIds.filter((value,index,array)=>array.indexOf(value)===index);
 if(!styles.length)throw new Error('At least one style is required.');
 return productIds.flatMap((productId,productIndex)=>Array.from({length:videosPerProduct},(_,videoIndex)=>{
  const ordinal=videoIndex+1;const start=hash(seed)%styles.length;const globalIndex=productIndex*videosPerProduct+videoIndex;const styleIndex=mode==='QUICK_BULK'?0:(start+globalIndex)%styles.length;
  return{productId,styleId:styles[styleIndex],ordinal};
 }));
}

type CreateBatchInput={workspaceId:string;userId:string;name:string;mode:'QUICK_BULK'|'AUTO_MIX'|'DAILY_AUTO';profileId?:string|null;presetId?:string|null;styleIds:string[];videosPerProduct:number;seed:string;idempotencyKey:string;products:Array<{id:string;imageId:string;folderId?:string|null;name?:string;category?:string;notes?:string;confirmedFacts?:string[]}>};
export async function createBatch(input:CreateBatchInput){
 const planned=seededStylePlan(input.products.map(p=>p.id),input.styleIds,input.videosPerProduct,input.seed,input.mode),productMap=new Map(input.products.map(p=>[p.id,p]));
 const items=planned.map(item=>{const product=productMap.get(item.productId)!;return{product_id:item.productId,product_image_id:product.imageId,style_id:item.styleId,ordinal:item.ordinal,snapshot:{productName:product.name||'Produk',productCategory:product.category||'',productNotes:product.notes||'',productFolderId:product.folderId||null,confirmedFacts:(product.confirmedFacts||[]).slice(0,10)}}});
 const batchId=crypto.randomUUID();return rpc('create_auto_factory_batch_atomic',{p_workspace_id:input.workspaceId,p_user_id:input.userId,p_batch_id:batchId,p_name:input.name,p_mode:input.mode,p_profile_id:input.profileId||null,p_preset_id:input.presetId||null,p_style_ids:input.styleIds,p_seed:input.seed,p_videos_per_product:input.videosPerProduct,p_idempotency_key:input.idempotencyKey,p_items:items});
}

function compile(item:any,batch:any,product:any,profile:any){
 const style=getVideoStyle(String(item.selected_style_id));if(!style||style.engine!=='nexabot')throw new Error('STYLE_UNAVAILABLE');
 const facts=Array.isArray(product.confirmed_facts)?product.confirmed_facts.filter((v:unknown)=>typeof v==='string').slice(0,10):[];
 const frozenProfile=item.immutable_snapshot?.creatorProfile;
 const frozenPreset=item.immutable_snapshot?.legacyPreset;
 const settings=sanitizePersonalizationSettings(frozenProfile?.settings||frozenPreset?.settings||profile?.settings||{});
 if(settings.scriptMode==='custom')throw new Error('CUSTOM_SCRIPT_NOT_ALLOWED_FOR_MIXED_BULK');
 const p:ProductProfile={name:product.name||'produk dalam imej',category:product.category||settings.niche||'produk',packagingFormat:'general',spokenShortName:'produk ini',coreFunction:'tujuan sebenar yang disokong imej dan fakta disahkan sahaja',usageContext:'konteks biasa yang relevan',buyerProblem:'masalah pembeli yang relevan tanpa mendakwa hasil',allowedQaQuestion:'kegunaan produk yang disokong bukti',confirmedFeatures:facts,verifiedBenefits:facts,verifiedFacts:facts,unknownFields:['ingredients','certifications','medical outcomes','prices','testimonials'],prohibitedClaims:['invented claims','personal experience','medical outcomes','prices','testimonials'],sourceConfidence:facts.length?'verified_user':'manual_fallback',provenance:'manual_user_entry',isVisionSupported:false};
 const scene:ScenePlan={mainSubject:p.name,location:'ordinary Malaysian setting chosen from the product context',lighting:style.actionPlan.lightingSpec,cameraDistance:style.cameraProfile,cameraMovement:style.actionPlan.cameraMovement,startPose:style.actionPlan.startPose,actionProgression:style.actionPlan.actionProgression,endPose:style.actionPlan.endPose,primaryAction:style.actionPlan.primaryAction,audioPolicy:style.audioMode,targetDurationSeconds:15};
 const compiled=DynamicPromptCompiler.compile(p,style,scene,{isMuslimahModest:settings.isMuslimahModest,creativeInstruction:settings.creativeInstruction,callToAction:settings.callToAction,scriptMode:settings.scriptMode,customCta:settings.customCta,avatarName:profile?.avatar_name,backgroundName:profile?.background_name,builtInSceneId:settings.builtInSceneId||undefined,niche:settings.niche,voicePersonality:settings.voicePersonality,storyboard:settings.storyboard,scriptVariant:settings.scriptVariant,audioTreatment:settings.audioTreatment});
 if(!compiled.preflightValid)throw new Error(`PREFLIGHT:${compiled.validationErrors.join(',')}`);
 return{style,settings,compiled,p};
}

async function syncItemsAndBatches(){
 const items=await dbRows<any>('auto_factory_items?status=eq.ADMITTED&select=id,batch_id,job_id,video_jobs(status)&limit=200');
 for(const item of items){const status=item.video_jobs?.status;if(status==='COMPLETED'||status==='FAILED'||status==='CANCELLED')await dbWrite(`auto_factory_items?id=eq.${item.id}`,'PATCH',{status:status==='COMPLETED'?'COMPLETED':status==='CANCELLED'?'CANCELLED':'FAILED',updated_at:new Date().toISOString()},'return=minimal')}
 const batches=await dbRows<any>('auto_factory_batches?status=in.(READY,RUNNING)&select=id,total_jobs');
 for(const batch of batches){const rows=await dbRows<any>(`auto_factory_items?batch_id=eq.${batch.id}&select=status`),completed=rows.filter(r=>r.status==='COMPLETED').length,failed=rows.filter(r=>r.status==='FAILED').length,admitted=rows.filter(r=>['ADMITTED','COMPLETED','FAILED'].includes(r.status)).length,terminal=rows.every(r=>['COMPLETED','FAILED','CANCELLED','SKIPPED'].includes(r.status));await dbWrite(`auto_factory_batches?id=eq.${batch.id}`,'PATCH',{admitted_jobs:admitted,completed_jobs:completed,failed_jobs:failed,status:terminal?'COMPLETED':'RUNNING',updated_at:new Date().toISOString()},'return=minimal')}
}

export async function dispatchAutoFactoryCapacity(maxClaims=3){
 await syncItemsAndBatches();let admitted=0,waiting=0,failed=0;
 for(let n=0;n<maxClaims;n++){
  const claim=await rpc<any>('claim_auto_factory_item_atomic',{p_lease_seconds:300});if(!claim.claimed)break;
  try{
   const [item]=await dbRows<any>(`auto_factory_items?id=eq.${claim.item_id}&select=*`),[batch]=await dbRows<any>(`auto_factory_batches?id=eq.${claim.batch_id}&select=*`),[product]=await dbRows<any>(`products?id=eq.${claim.product_id}&workspace_id=eq.${claim.workspace_id}&select=id,name,category,description,confirmed_facts`),profiles=batch.creator_profile_id?await dbRows<any>(`creator_profiles?id=eq.${batch.creator_profile_id}&workspace_id=eq.${claim.workspace_id}&select=*`):[];
   if(!item||!batch||!product)throw new Error('SNAPSHOT_SOURCE_MISSING');
   if(!['READY','RUNNING'].includes(batch.status)){await dbWrite(`auto_factory_items?id=eq.${item.id}&claim_token=eq.${claim.claim_token}`,'PATCH',{status:batch.status==='CANCELLED'?'CANCELLED':'PENDING',claim_token:null,claim_until:null,updated_at:new Date().toISOString()},'return=minimal');continue}
   const profile=profiles[0]||null,{style,settings,compiled,p}=compile(item,batch,product,profile),jobId=crypto.randomUUID();
   const frozenProfile=item.immutable_snapshot?.creatorProfile;
   const snapshot={...item.immutable_snapshot,workspaceId:claim.workspace_id,productId:product.id,imageId:item.product_image_id,creatorProfileId:frozenProfile?.id||profile?.id||null,creatorProfileVersion:frozenProfile?.version||profile?.version||null,styleId:style.id,audioMode:settings.audioTreatment,scriptMode:settings.scriptMode,scriptVariant:settings.scriptVariant,cta:settings.callToAction,providerPrompt:compiled.providerPrompt,creditCharge:10,batchId:batch.id};
   const admission=await DurableStore.admitJobAtomic({workspaceId:claim.workspace_id,userId:batch.user_id,jobId,clientRequestId:`auto:${item.id}`,styleId:style.id,styleName:style.name,presetVersion:2,provider:'nexabot',durationSeconds:15,requiredCredits:10,maxConcurrency:1,compiledPrompt:compiled.providerPrompt,productName:p.name,productCategory:p.category,inputOptions:{imageAssetId:item.product_image_id,avatarId:settings.avatarId||null,backgroundId:settings.backgroundId||null,builtInSceneId:settings.builtInSceneId,niche:settings.niche,voicePersonality:settings.voicePersonality,storyboard:settings.storyboard,callToAction:settings.callToAction,scriptMode:settings.scriptMode,scriptVariant:settings.scriptVariant,audioTreatment:settings.audioTreatment,creatorProfileId:profile?.id||null,autoFactoryBatchId:batch.id}});
   if(!admission.success){await dbWrite(`auto_factory_items?id=eq.${item.id}&claim_token=eq.${claim.claim_token}`,'PATCH',{status:'PENDING',claim_token:null,claim_until:null,error_message:admission.error,updated_at:new Date().toISOString()},'return=minimal');if(admission.insufficientCredits)await dbWrite(`auto_factory_batches?id=eq.${batch.id}`,'PATCH',{status:'PAUSED_CREDITS',updated_at:new Date().toISOString()},'return=minimal');waiting++;continue}
   await Promise.all([dbWrite(`video_jobs?id=eq.${jobId}`,'PATCH',{auto_factory_batch_id:batch.id,creator_profile_id:profile?.id||null,generation_snapshot:snapshot},'return=minimal'),dbWrite(`auto_factory_items?id=eq.${item.id}&claim_token=eq.${claim.claim_token}`,'PATCH',{status:'ADMITTED',job_id:jobId,immutable_snapshot:snapshot,claim_token:null,claim_until:null,updated_at:new Date().toISOString()},'return=minimal')]);admitted++;
  }catch(error){await dbWrite(`auto_factory_items?id=eq.${claim.item_id}`,'PATCH',{status:'FAILED',claim_token:null,claim_until:null,error_message:error instanceof Error?error.message:String(error),updated_at:new Date().toISOString()},'return=minimal').catch(()=>undefined);failed++}
 }
 return{admitted,waiting,failed};
}

export function klNow(date=new Date()){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date);const get=(type:string)=>parts.find(p=>p.type===type)?.value||'';return{date:`${get('year')}-${get('month')}-${get('day')}`,time:`${get('hour')}:${get('minute')}`}}
export async function materializeDueDailyRuns(){
 const now=klNow(),schedules=await dbRows<any>(`daily_auto_schedules?is_active=eq.true&or=(stop_date.is.null,stop_date.gte.${now.date})&select=*&order=created_at.asc`);let created=0,skipped=0;
 for(const schedule of schedules){if(String(schedule.start_time_local).slice(0,5)>now.time||schedule.last_run_date===now.date)continue;
  try{await dbWrite('daily_auto_runs','POST',{schedule_id:schedule.id,workspace_id:schedule.workspace_id,run_date:now.date,status:'STARTED'},'return=representation')}catch{continue}
  let products=await dbRows<any>(`products?workspace_id=eq.${schedule.workspace_id}&folder_id=eq.${schedule.folder_id}&select=id,name,category,description,confirmed_facts,folder_id,product_images(id,is_primary)&order=created_at.asc`);
  if(!schedule.reuse_completed_products){const used=await dbRows<any>(`auto_factory_items?workspace_id=eq.${schedule.workspace_id}&status=eq.COMPLETED&select=product_id`),ids=new Set(used.map(x=>x.product_id));products=products.filter(p=>!ids.has(p.id))}
  const productLimit=Math.max(1,Math.floor(Math.min(schedule.videos_per_day,schedule.max_daily_credits/10)/schedule.videos_per_product));const selected=products.filter(p=>p.product_images?.length).slice(0,productLimit).map(p=>({id:p.id,imageId:(p.product_images.find((i:any)=>i.is_primary)||p.product_images[0]).id,folderId:p.folder_id,name:p.name,category:p.category,notes:p.description,confirmedFacts:p.confirmed_facts}));
  if(!selected.length){await dbWrite(`daily_auto_runs?schedule_id=eq.${schedule.id}&run_date=eq.${now.date}`,'PATCH',{status:'SKIPPED',reason:'NO_ELIGIBLE_PRODUCTS'},'return=minimal');await dbWrite(`daily_auto_schedules?id=eq.${schedule.id}`,'PATCH',{last_run_date:now.date,updated_at:new Date().toISOString()},'return=minimal');skipped++;continue}
  try{const result:any=await createBatch({workspaceId:schedule.workspace_id,userId:schedule.user_id,name:`${schedule.name} · ${now.date}`,mode:'DAILY_AUTO',profileId:schedule.creator_profile_id,presetId:schedule.preset_id,styleIds:schedule.style_ids,videosPerProduct:schedule.videos_per_product,seed:`${schedule.id}:${now.date}`,idempotencyKey:`daily:${schedule.id}:${now.date}`,products:selected});await dbWrite(`daily_auto_runs?schedule_id=eq.${schedule.id}&run_date=eq.${now.date}`,'PATCH',{status:result.success?'CREATED':'SKIPPED',batch_id:result.batch_id||null,reason:result.error||null},'return=minimal');if(result.success)created++;else skipped++}catch(error){await dbWrite(`daily_auto_runs?schedule_id=eq.${schedule.id}&run_date=eq.${now.date}`,'PATCH',{status:'FAILED',reason:error instanceof Error?error.message:String(error)},'return=minimal');skipped++}
  await dbWrite(`daily_auto_schedules?id=eq.${schedule.id}`,'PATCH',{last_run_date:now.date,updated_at:new Date().toISOString()},'return=minimal');
 }
 return{created,skipped};
}
