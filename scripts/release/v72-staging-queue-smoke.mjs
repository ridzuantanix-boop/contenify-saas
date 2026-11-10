import { chromium } from 'playwright-core';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import crypto from 'node:crypto';

const base='https://affimatik-launch-lite-staging.nanotiva-garden.workers.dev';
const supabase='https://oudxnvazrdmnxdndpgmy.supabase.co';
const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
const gateKey=process.env.STAGING_GATE_SECRET;
const cronSecret=process.env.STAGING_CRON_SECRET;
const nexabotKey=process.env.NEXABOT_API_KEY;
if(!serviceKey||!gateKey||!cronSecret||!nexabotKey)throw new Error('Rahsia staging V7.2 tidak lengkap.');
const runId=`v72-queue-${new Date().toISOString().replace(/[:.]/g,'-')}`;
const out=resolve('output/provider-qa',runId);mkdirSync(out,{recursive:true});
const evidence={runId,startedAt:new Date().toISOString(),accounts:[],submissions:[],snapshots:[],reconciles:[],provider:{},cancel:null,settlement:[],cleanup:null};
const headers={apikey:serviceKey,Authorization:`Bearer ${serviceKey}`,'Content-Type':'application/json'};
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
async function api(path,init={}){const response=await fetch(`${supabase}${path}`,{...init,headers:{...headers,...init.headers}});const text=await response.text();const data=text?JSON.parse(text):null;if(!response.ok)throw new Error(`Supabase HTTP ${response.status} ${path}: ${text.slice(0,500)}`);return data;}
async function providerCredits(){const response=await fetch('https://nexabot.id/api/v1/credits',{headers:{Authorization:`Bearer ${nexabotKey}`,'X-API-Key':nexabotKey}});const data=await response.json().catch(()=>({}));if(!response.ok||typeof data.credit!=='number')throw new Error(`Nexabot credits HTTP ${response.status}`);return data.credit;}
async function walletSnapshot(){const rows=await api('/rest/v1/credit_wallets?select=workspace_id,balance,reserved_balance,lifetime_granted,lifetime_spent&order=workspace_id.asc');return JSON.stringify(rows);}
async function createAccount(index){const email=`codex.v72.queue.${runId}.${index}@example.com`;const password=`V72-${crypto.randomBytes(20).toString('base64url')}!`;const created=await api('/auth/v1/admin/users',{method:'POST',body:JSON.stringify({email,password,email_confirm:true,user_metadata:{full_name:'Codex V7.2 Queue QA',whatsapp:'601100000000'}})});const provision=await api('/rest/v1/rpc/provision_verified_account_atomic',{method:'POST',body:JSON.stringify({p_user_id:created.id,p_email:email,p_full_name:'Codex V7.2 Queue QA',p_whatsapp:'601100000000',p_referral_code:null})});if(!provision.success)throw new Error(`Provision QA ${index} gagal`);const account={index,userId:created.id,workspaceId:provision.workspace_id,email,password};evidence.accounts.push({index,userId:created.id,workspaceId:provision.workspace_id,email});return account;}
async function unlockAndLogin(page,account){await page.goto(`${base}/__stage_access`,{waitUntil:'domcontentloaded'});await page.locator('input[name="key"]').fill(gateKey);await Promise.all([page.waitForURL(`${base}/`),page.getByRole('button',{name:'Enter'}).click()]);await page.goto(`${base}/login`,{waitUntil:'networkidle'});await page.locator('input[type="email"]').fill(account.email);await page.locator('input[type="password"]').fill(account.password);await page.getByRole('button',{name:'Log Masuk'}).click();await page.waitForURL(/\/dashboard/,{timeout:30000});}
async function uploadProduct(page,index){const imagePath=resolve(index%2?'output/provider-qa/v7-inputs/beauty-seri-dewi.png':'output/provider-qa/v7-inputs/kitchen-potonggo.png');const bytes=readFileSync(imagePath);return page.evaluate(async({payload,index})=>{const bytes=Uint8Array.from(atob(payload),c=>c.charCodeAt(0));const form=new FormData();form.append('image',new File([bytes],`v72-queue-${index}.png`,{type:'image/png'}));form.append('name',`V7.2 Queue QA Product ${index}`);const response=await fetch('/api/products',{method:'POST',body:form});const data=await response.json();if(!response.ok)throw new Error(`Upload HTTP ${response.status}: ${JSON.stringify(data)}`);return data;},{payload:bytes.toString('base64'),index});}
async function submit(page,assetId,index){return page.evaluate(async({assetId,index})=>{const response=await fetch('/api/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clientRequestId:`v72_queue_${crypto.randomUUID()}`,styleId:'NX01',productName:`V7.2 Queue QA Product ${index}`,imageAssetId:assetId,niche:index%2?'beauty':'kitchen',callToAction:'none',scriptMode:'provider_auto',isMuslimahModest:true})});const data=await response.json();return{http:response.status,...data};},{assetId,index});}
async function dbJobs(ids){return api(`/rest/v1/video_jobs?id=in.(${ids.join(',')})&select=id,workspace_id,status,provider_task_id,queue_sequence,dispatch_attempt_count,max_retries,result_video_r2_key,required_credits,created_at,updated_at&order=queue_sequence.asc`);}
async function recordSnapshot(label,ids){const rows=await dbJobs(ids);evidence.snapshots.push({label,at:new Date().toISOString(),rows});writeFileSync(resolve(out,'progress.json'),JSON.stringify(evidence,null,2));return rows;}
async function reconcile(page){const result=await page.evaluate(async(secret)=>{const response=await fetch('/api/jobs/reconcile',{method:'POST',headers:{'x-cron-secret':secret}});return{http:response.status,data:await response.json()};},cronSecret);evidence.reconciles.push({at:new Date().toISOString(),...result});if(result.http!==200)throw new Error(`Reconcile HTTP ${result.http}: ${JSON.stringify(result.data)}`);return result.data;}
async function deleteStorageObject(path){if(!path)return;await api('/storage/v1/object/affimatik-assets',{method:'DELETE',body:JSON.stringify({prefixes:[path]})});}
async function cleanupAccount(account){const [products,videos]=await Promise.all([api(`/rest/v1/product_images?workspace_id=eq.${account.workspaceId}&select=r2_key`),api(`/rest/v1/video_jobs?workspace_id=eq.${account.workspaceId}&result_video_r2_key=not.is.null&select=result_video_r2_key`)]);for(const path of [...products.map(x=>x.r2_key),...videos.map(x=>x.result_video_r2_key)].filter(Boolean))await deleteStorageObject(path);await api(`/rest/v1/workspaces?id=eq.${account.workspaceId}&owner_id=eq.${account.userId}`,{method:'DELETE'});await api(`/rest/v1/profiles?id=eq.${account.userId}`,{method:'DELETE'});await api(`/auth/v1/admin/users/${account.userId}`,{method:'DELETE'});return products.length+videos.length;}

const baselineWallets=await walletSnapshot();
const creditsBefore=await providerCredits();evidence.provider.creditsBefore=creditsBefore;
if(creditsBefore<0.6)throw new Error(`Baki Nexabot tidak cukup untuk had ujian 4 generation: ${creditsBefore}`);
const accounts=[];const contexts=[];let browser;let safeToCleanup=false;
try{
  for(let i=1;i<=5;i++)accounts.push(await createAccount(i));
  browser=await chromium.launch({executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',headless:true});
  for(const account of accounts){const context=await browser.newContext({viewport:{width:1280,height:800}});const page=await context.newPage();await unlockAndLogin(page,account);account.context=context;account.page=page;account.asset=await uploadProduct(page,account.index);contexts.push(context);}
  const submitted=await Promise.all(accounts.slice(0,4).map((account)=>submit(account.page,account.asset.assetId,account.index)));
  evidence.submissions=submitted;for(const item of submitted)if(!item.jobId||![200,202].includes(item.http))throw new Error(`Submission gagal: ${JSON.stringify(item)}`);
  const jobIds=submitted.map(x=>x.jobId);
  await api(`/rest/v1/video_jobs?id=in.(${jobIds.join(',')})`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({max_retries:0})});
  const initial=await recordSnapshot('initial-four',jobIds);
  const active=initial.filter(x=>x.status==='PROCESSING'&&x.provider_task_id).length;const queued=initial.filter(x=>x.status==='QUEUED'&&!x.provider_task_id).length;
  if(active!==3||queued!==1)throw new Error(`Had queue tidak terbukti: active=${active}, queued=${queued}`);
  const cancelSubmit=await submit(accounts[4].page,accounts[4].asset.assetId,5);if(!cancelSubmit.jobId||cancelSubmit.status!=='QUEUED')throw new Error(`Job cancel tidak kekal queued: ${JSON.stringify(cancelSubmit)}`);
  await api(`/rest/v1/video_jobs?id=eq.${cancelSubmit.jobId}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({max_retries:0})});
  const cancelResult=await accounts[4].page.evaluate(async(jobId)=>{const response=await fetch(`/api/jobs?jobId=${jobId}`,{method:'DELETE'});return{http:response.status,data:await response.json()};},cancelSubmit.jobId);evidence.cancel={jobId:cancelSubmit.jobId,...cancelResult};if(cancelResult.http!==200||!cancelResult.data.creditRestored)throw new Error(`Cancel/refund gagal: ${JSON.stringify(cancelResult)}`);
  let fourthDispatched=false;let terminal=false;
  for(let attempt=0;attempt<60;attempt++){
    await reconcile(accounts[0].page);const rows=await recordSnapshot(`poll-${attempt+1}`,jobIds);
    fourthDispatched=fourthDispatched||rows.every(x=>Boolean(x.provider_task_id));
    terminal=rows.every(x=>['COMPLETED','FAILED','CANCELLED'].includes(x.status));
    if(terminal)break;await sleep(10000);
  }
  const finalRows=await recordSnapshot('final-four',jobIds);safeToCleanup=finalRows.every(x=>['COMPLETED','FAILED','CANCELLED'].includes(x.status));
  if(!fourthDispatched)throw new Error('Job keempat tidak didispatch selepas slot tersedia.');
  if(!safeToCleanup)throw new Error('Empat job tidak mencapai status terminal dalam had masa.');
  if(finalRows.some(x=>x.status!=='COMPLETED'))throw new Error(`Provider tidak menyiapkan semua empat job: ${JSON.stringify(finalRows.map(x=>({id:x.id,status:x.status})))}`);
  const reservations=await api(`/rest/v1/credit_reservations?job_id=in.(${jobIds.join(',')},${cancelSubmit.jobId})&select=job_id,status,amount`);
  const ledger=await api(`/rest/v1/credit_ledger?reference_id=in.(${jobIds.join(',')},${cancelSubmit.jobId})&select=reference_id,event_type,amount,idempotency_key&order=created_at.asc`);
  evidence.settlement={reservations,ledger};
  for(const id of jobIds){const rs=reservations.filter(x=>x.job_id===id);const ls=ledger.filter(x=>x.reference_id===id);if(rs.length!==1||rs[0].status!=='SETTLED'||ls.filter(x=>x.event_type==='SETTLE').length!==1)throw new Error(`Settlement bukan tepat sekali untuk ${id}`);}
  const cancelReservation=reservations.find(x=>x.job_id===cancelSubmit.jobId);if(cancelReservation?.status!=='RELEASED')throw new Error('Reservation job cancel tidak RELEASED.');
  const creditsAfter=await providerCredits();evidence.provider.creditsAfter=creditsAfter;evidence.provider.used=Number((creditsBefore-creditsAfter).toFixed(4));
  if(Math.abs(evidence.provider.used-0.6)>0.0001)throw new Error(`Caj provider berbeza daripada 4 x 0.15: ${evidence.provider.used}`);
}finally{
  if(browser)await browser.close();
  if(safeToCleanup){let objects=0;for(const account of accounts)objects+=await cleanupAccount(account);const afterWallets=await walletSnapshot();evidence.cleanup={accounts:accounts.length,objects,walletSnapshotUnchanged:afterWallets===baselineWallets};if(afterWallets!==baselineWallets)throw new Error('Snapshot wallet pelanggan berubah selepas cleanup QA.');}
  evidence.finishedAt=new Date().toISOString();writeFileSync(resolve(out,'evidence.json'),JSON.stringify(evidence,null,2));
}
console.log(JSON.stringify({runId,provider:evidence.provider,submissions:evidence.submissions,snapshots:[evidence.snapshots[0],evidence.snapshots.at(-1)],cancel:evidence.cancel,cleanup:evidence.cleanup},null,2));
