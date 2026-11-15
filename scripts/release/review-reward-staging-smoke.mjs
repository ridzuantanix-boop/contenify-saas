import { createHmac, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import pg from 'pg';

const base = process.env.STAGING_APP_URL || 'https://affimatik-launch-lite-staging.nanotiva-garden.workers.dev';
const supabase = process.env.STAGING_SUPABASE_URL || 'https://bymorrozeokshzuzcdro.supabase.co';
for (const key of ['STAGING_GATE_SECRET','STAGING_SERVICE_ROLE_KEY','STAGING_SESSION_SECRET']) {
  if (!process.env[key]) throw new Error(`${key} diperlukan.`);
}
const userId=randomUUID(), workspaceId=randomUUID(), job1=randomUUID(), job2=randomUUID();
const serviceHeaders={ 'Content-Type':'application/json', apikey:process.env.STAGING_SERVICE_ROLE_KEY,
  Authorization:`Bearer ${process.env.STAGING_SERVICE_ROLE_KEY}` };
const apiHeaders={ 'Content-Type':'application/json','x-affimatik-staging-key':process.env.STAGING_GATE_SECRET };

function token() {
  const now=Math.floor(Date.now()/1000);
  const encode=(value)=>Buffer.from(JSON.stringify(value)).toString('base64url');
  const header=encode({alg:'HS256',typ:'JWT'});
  const payload=encode({userId,email:'review-reward-qa@example.test',fullName:'Review Reward QA',workspaceId,role:'owner',tier:'free',emailVerified:true,issuedAt:now,expiresAt:now+3600});
  const data=`${header}.${payload}`;
  return `${data}.${createHmac('sha256',process.env.STAGING_SESSION_SECRET).update(data).digest('base64url')}`;
}

async function rest(path, method='GET', body) {
  const response=await fetch(`${supabase}/rest/v1/${path}`,{method,headers:{...serviceHeaders,...(method==='POST'?{Prefer:'return=representation'}:{})},body:body?JSON.stringify(body):undefined});
  if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${await response.text()}`);
  return response.status===204?null:response.json();
}
async function call(body) {
  const response=await fetch(`${base}/api/review-reward`,{method:'POST',headers:{...apiHeaders,Cookie:`affimatik_session=${token()}`},body:JSON.stringify(body)});
  const result=await response.json();
  if (!response.ok) throw new Error(`API ${response.status}: ${JSON.stringify(result)}`);
  return result;
}

try {
  await rest('workspaces','POST',{id:workspaceId,name:'Review Reward QA',slug:`review-reward-${workspaceId.slice(0,8)}`,owner_id:userId,status:'active'});
  await rest('workspace_members','POST',{workspace_id:workspaceId,user_id:userId,role:'owner'});
  await rest('credit_wallets','POST',{workspace_id:workspaceId,balance:20,reserved_balance:0,lifetime_granted:20,lifetime_spent:0});
  for (const [id,request] of [[job1,'review-smoke-1'],[job2,'review-smoke-2']]) {
    await rest('video_jobs','POST',{id,workspace_id:workspaceId,user_id:userId,preset_id:'NX01',preset_version:2,provider:'nexabot',duration_seconds:15,required_credits:10,status:'COMPLETED',client_request_id:request,idempotency_key:request,compiled_prompt_snapshot:'qa',input_options:{},result_video_r2_key:`workspaces/${workspaceId}/outputs/${id}.mp4`});
  }
  const first=await call({action:'record_download',videoId:job1});
  const duplicateDownload=await call({action:'record_download',videoId:job1});
  const second=await call({action:'record_download',videoId:job2});
  const grant=await call({action:'claim',reviewText:'AffiMatik mudah digunakan dan membantu saya siapkan video tanpa perlu rakam muka.',publishedUrl:'',marketingConsent:true});
  const replay=await call({action:'claim',reviewText:'AffiMatik mudah digunakan dan membantu saya siapkan video tanpa perlu rakam muka.',publishedUrl:'',marketingConsent:true});
  const wallet=(await rest(`credit_wallets?workspace_id=eq.${workspaceId}&select=balance,lifetime_granted`))[0];
  const ledger=await rest(`credit_ledger?workspace_id=eq.${workspaceId}&reference_type=eq.REVIEW_REWARD&select=id`);
  if (first.download_count!==1 || duplicateDownload.download_count!==1 || second.download_count!==2 || grant.credits_granted!==30 || replay.credits_granted!==0 || wallet.balance!==50 || ledger.length!==1) throw new Error('Staging reward invariants failed.');
  console.log(JSON.stringify({success:true,first,duplicateDownload,second,grant:{credits_granted:grant.credits_granted,balance:grant.balance},replay:{credits_granted:replay.credits_granted,balance:replay.balance},wallet,ledgerEntries:ledger.length},null,2));
} finally {
  if (!process.env.STAGING_DB_PASSWORD) throw new Error('STAGING_DB_PASSWORD diperlukan untuk cleanup QA.');
  const client=new pg.Client({
    host:process.env.STAGING_DB_HOST||'aws-0-ap-southeast-2.pooler.supabase.com',port:5432,
    user:process.env.STAGING_DB_USER||'postgres.bymorrozeokshzuzcdro',database:'postgres',password:process.env.STAGING_DB_PASSWORD,
    ssl:{ca:readFileSync('output/release/tools/supabase-prod-ca-2021.crt','utf8'),rejectUnauthorized:true},
  });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM review_reward_claims WHERE workspace_id=$1',[workspaceId]);
    await client.query('DELETE FROM review_reward_downloads WHERE workspace_id=$1',[workspaceId]);
    const deleted=await client.query("DELETE FROM workspaces WHERE id=$1 AND slug LIKE 'review-reward-%' RETURNING id",[workspaceId]);
    if (deleted.rowCount!==1) throw new Error('Cleanup QA workspace tidak lengkap.');
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { await client.end(); }
}
