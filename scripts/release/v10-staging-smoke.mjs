import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import crypto from 'node:crypto';

const worker='https://affimatik-launch-lite-staging.nanotiva-garden.workers.dev';
const supabase='https://bymorrozeokshzuzcdro.supabase.co';
const gate=process.env.STAGING_GATE_SECRET;
const service=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!gate||!service)throw new Error('Rahsia staging V10 tidak dikonfigurasi.');
const email=`v10-smoke-${Date.now()}@example.com`;
const password=`V10!${crypto.randomBytes(18).toString('base64url')}`;
const adminHeaders={apikey:service,Authorization:`Bearer ${service}`,'Content-Type':'application/json'};
const auth=await fetch(`${supabase}/auth/v1/admin/users`,{method:'POST',headers:adminHeaders,body:JSON.stringify({email,password,email_confirm:true,user_metadata:{full_name:'V10 Staging Smoke',whatsapp:'601100000000'}})});
if(!auth.ok)throw new Error(`Cipta akaun QA HTTP ${auth.status}: ${await auth.text()}`);
const user=await auth.json();
const evidence={testedAt:new Date().toISOString(),worker,userId:user.id,desktop:{},mobile:{},api:{}};

async function unlock(page){
  await page.goto(`${worker}/__stage_access`,{waitUntil:'domcontentloaded'});
  await page.locator('input[name="key"]').fill(gate);
  await Promise.all([page.waitForURL(`${worker}/`),page.getByRole('button',{name:'Enter'}).click()]);
}
async function login(page){
  await page.goto(`${worker}/login`,{waitUntil:'networkidle'});
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button',{name:'Log Masuk'}).click();
  await page.waitForURL(/\/dashboard/);
}
async function json(page,path,init={}){
  return page.evaluate(async({path,init})=>{const response=await fetch(path,{cache:'no-store',...init});return{status:response.status,contentType:response.headers.get('content-type'),body:await response.json().catch(()=>({}))}}, {path,init});
}

const browser=await chromium.launch({executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',headless:true});
try{
  const desktop=await browser.newContext({viewport:{width:1440,height:1000}}),page=await desktop.newPage();
  await unlock(page);await login(page);await page.goto(`${worker}/factory`,{waitUntil:'networkidle'});
  await page.locator('input[type="file"]').first().setInputFiles('public/style-posters/NX01.webp');
  await page.getByText('Identiti produk dikunci').waitFor();
  evidence.desktop.generateVisible=await page.getByRole('button',{name:/Jana Video Sekarang/}).isVisible();
  await page.getByRole('button',{name:'Customize',exact:true}).click();
  evidence.desktop.directionVisible=await page.getByText('Arah Kreatif & CTA').isVisible();
  evidence.desktop.creativePromptVisible=await page.getByPlaceholder(/Contoh: Presenter lelaki/).isVisible();
  evidence.desktop.smartScriptCount=await page.getByText('Smart Script',{exact:true}).count();
  evidence.desktop.customScriptCount=await page.getByText('Custom Script',{exact:true}).count();
  evidence.desktop.providerAutoCount=await page.getByText('Provider Auto',{exact:true}).count();
  const styles=await json(page,'/api/styles');evidence.api.stylesStatus=styles.status;evidence.api.styleCount=styles.body.count;
  const checkout=await json(page,'/api/billing/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({planId:'starter'})});evidence.api.checkoutStatus=checkout.status;
  const profile=await json(page,'/api/creator-profiles',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'V10 Legacy Normalization',settings:{styleId:'NX01',scriptMode:'custom',scriptVariant:'story',customScript:'MUST_NOT_REACH_PROVIDER',creativeInstruction:'Suasana rumah yang santai.'}})});evidence.api.profileCreateStatus=profile.status;
  const profiles=await json(page,'/api/creator-profiles');const created=(profiles.body.profiles||[]).find(item=>item.id===profile.body.id);evidence.api.legacyNormalized=created?.settings?.scriptMode==='provider_auto'&&created?.settings?.customScript===''&&created?.settings?.creativeInstruction==='Suasana rumah yang santai.';
  await desktop.close();

  const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true}),mobilePage=await mobile.newPage();
  await unlock(mobilePage);await login(mobilePage);await mobilePage.goto(`${worker}/factory`,{waitUntil:'networkidle'});
  await mobilePage.locator('input[type="file"]').first().setInputFiles('public/style-posters/NX02.webp');
  await mobilePage.getByText('Identiti produk dikunci').waitFor();
  evidence.mobile.stickyGenerateVisible=await mobilePage.getByRole('button',{name:'Jana Video',exact:true}).isVisible();
  await mobilePage.getByRole('button',{name:'Customize',exact:true}).click();
  evidence.mobile.directionVisible=await mobilePage.getByText('Arah Kreatif & CTA').isVisible();
  evidence.mobile.smartScriptCount=await mobilePage.getByText('Smart Script',{exact:true}).count();
  await mobile.close();
}finally{await browser.close()}

const pass=evidence.desktop.generateVisible&&evidence.desktop.directionVisible&&evidence.desktop.creativePromptVisible&&evidence.desktop.smartScriptCount===0&&evidence.desktop.customScriptCount===0&&evidence.desktop.providerAutoCount===0&&evidence.mobile.stickyGenerateVisible&&evidence.mobile.directionVisible&&evidence.mobile.smartScriptCount===0&&evidence.api.stylesStatus===200&&evidence.api.styleCount===20&&evidence.api.checkoutStatus===403&&evidence.api.profileCreateStatus===201&&evidence.api.legacyNormalized;
evidence.pass=Boolean(pass);
await mkdir('output/release',{recursive:true});await writeFile('output/release/v10-staging-smoke.json',JSON.stringify(evidence,null,2));
console.log(JSON.stringify(evidence,null,2));
if(!pass)process.exitCode=1;
