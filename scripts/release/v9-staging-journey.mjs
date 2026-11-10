import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const worker='https://affimatik-launch-lite-staging.nanotiva-garden.workers.dev';
const supabase='https://bymorrozeokshzuzcdro.supabase.co';
const gate=process.env.STAGING_GATE_SECRET,service=process.env.SUPABASE_SERVICE_ROLE_KEY,cron=process.env.CRON_SECRET;
if(!gate||!service||!cron)throw new Error('Rahsia staging tidak dikonfigurasi.');
const email=`v9-qa-${Date.now()}@example.com`,password=`V9!${crypto.randomBytes(18).toString('base64url')}`;
const adminHeaders={apikey:service,Authorization:`Bearer ${service}`,'Content-Type':'application/json'};
const auth=await fetch(`${supabase}/auth/v1/admin/users`,{method:'POST',headers:adminHeaders,body:JSON.stringify({email,password,email_confirm:true,user_metadata:{full_name:'V9 Staging QA',whatsapp:'601100000000'}})});
if(!auth.ok)throw new Error(`Create QA user HTTP ${auth.status}: ${await auth.text()}`);
const user=await auth.json();
let cookie='';
async function app(url,init={}){const headers=new Headers(init.headers||{});headers.set('x-affimatik-staging-key',gate);if(cookie)headers.set('cookie',cookie);const response=await fetch(`${worker}${url}`,{...init,headers});return response}
const login=await app('/api/auth/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
if(!login.ok)throw new Error(`Login HTTP ${login.status}: ${await login.text()}`);
cookie=login.headers.get('set-cookie')?.split(';')[0]||'';if(!cookie)throw new Error('Session cookie staging tiada.');
const session=await (await app('/api/auth/session')).json();
if(!session.authenticated||session.wallet?.balance!==20)throw new Error(`Session/welcome wallet tidak sah: ${JSON.stringify(session)}`);
const profileResponse=await app('/api/creator-profiles',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'QA Creator Santai',isDefault:true,settings:{voicePersonality:'friendly',callToAction:'none',scriptMode:'provider_auto',scriptVariant:'short',storyboard:'auto',audioTreatment:'voiceover',styleId:'NX01',creativeInstruction:'Bahasa Melayu Malaysia natural dan ringkas.'}})});
if(!profileResponse.ok)throw new Error(`Profile HTTP ${profileResponse.status}: ${await profileResponse.text()}`);const profile=await profileResponse.json();
const folderResponse=await app('/api/product-folders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'V9 QA Products'})});
if(!folderResponse.ok)throw new Error(`Folder HTTP ${folderResponse.status}: ${await folderResponse.text()}`);const folder=await folderResponse.json();
const productIds=[];
for(const [file,name] of [['public/style-posters/NX01.webp','Lampu Meja Nova QA'],['public/style-posters/NX02.webp','Suplemen Harian QA']]){
 const bytes=await fs.readFile(path.resolve(file));const form=new FormData();form.set('image',new Blob([bytes],{type:'image/webp'}),path.basename(file));form.set('name',name);form.set('folderId',folder.id);const upload=await app('/api/products',{method:'POST',body:form});if(!upload.ok)throw new Error(`Upload HTTP ${upload.status}: ${await upload.text()}`);productIds.push((await upload.json()).productId);
}
const batchResponse=await app('/api/auto-factory/batches',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'V9 Real Nexabot QA',productIds,profileId:profile.id,styleIds:['NX01','NX02'],videosPerProduct:1,mode:'AUTO_MIX',seed:'v9-real-qa',idempotencyKey:`v9-real-${user.id}`})});
if(!batchResponse.ok)throw new Error(`Batch HTTP ${batchResponse.status}: ${await batchResponse.text()}`);const batch=await batchResponse.json();
let state=null;
for(let attempt=0;attempt<60;attempt++){
 const reconcile=await app('/api/jobs/reconcile',{method:'POST',headers:{'x-cron-secret':cron}});if(!reconcile.ok)throw new Error(`Reconcile HTTP ${reconcile.status}: ${await reconcile.text()}`);
 state=await (await app('/api/auto-factory/batches')).json();const current=state.batches?.find(item=>item.id===batch.batch_id);
 if(current?.completed_jobs===2||current?.failed_jobs>0||current?.status==='FAILED')break;
 await new Promise(resolve=>setTimeout(resolve,10_000));
}
const current=state?.batches?.find(item=>item.id===batch.batch_id);if(current?.completed_jobs!==2)throw new Error(`Live batch tidak lengkap: ${JSON.stringify(current)}`);
const library=await (await app(`/api/videos?batchId=${batch.batch_id}`)).json();if(library.videos?.length!==2)throw new Error(`Video Library batch tidak lengkap: ${library.videos?.length||0}`);
const range=await app(`${library.videos[0].streamUrl}`,{headers:{Range:'bytes=0-1023'}});if(range.status!==206)throw new Error(`MP4 Range HTTP ${range.status}`);
const finalSession=await (await app('/api/auth/session')).json();
const jobsResponse=await fetch(`${supabase}/rest/v1/video_jobs?auto_factory_batch_id=eq.${batch.batch_id}&select=id,preset_id,status,provider_task_id,result_video_r2_key,actual_duration_seconds,created_at,completed_at,provider_job_costs(observed_provider_credits,estimated_myr_cost,cost_status)&order=created_at`,{headers:adminHeaders});
const jobs=jobsResponse.ok?await jobsResponse.json():[];
const evidence={testedAt:new Date().toISOString(),worker,batchId:batch.batch_id,userId:user.id,workspaceId:session.user?.workspaceId||session.workspaceId,products:productIds,profileId:profile.id,folderId:folder.id,walletBefore:session.wallet,walletAfter:finalSession.wallet,batch:current,jobs,libraryCount:library.videos.length,rangeStatus:range.status};
await fs.mkdir('output/release',{recursive:true});await fs.writeFile('output/release/v9-staging-evidence.json',JSON.stringify(evidence,null,2));
console.log(JSON.stringify(evidence,null,2));
