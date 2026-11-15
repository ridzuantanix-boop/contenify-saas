import { chromium } from 'playwright-core';
import crypto from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const stagingKey=process.env.STAGING_GATE_SECRET;
const sessionSecret=process.env.SESSION_SECRET;
const qaUser=process.env.QA_USER_JSON?JSON.parse(process.env.QA_USER_JSON):null;
if(!stagingKey||!sessionSecret||!qaUser)throw new Error('STAGING_GATE_SECRET, SESSION_SECRET and QA_USER_JSON are required.');
const base='https://affimatik-launch-lite-staging.nanotiva-garden.workers.dev';
const output=path.resolve('output/expansion-v1-qa');
await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});

function sessionToken(){
  const now=Math.floor(Date.now()/1000);
  const header=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
  const payload=Buffer.from(JSON.stringify({userId:qaUser.id,email:qaUser.email,fullName:qaUser.full_name||'Expansion QA',workspaceId:qaUser.default_workspace_id,role:'owner',tier:qaUser.tier||'free',emailVerified:true,issuedAt:now,expiresAt:now+3600})).toString('base64url');
  const body=`${header}.${payload}`;
  return `${body}.${crypto.createHmac('sha256',sessionSecret.trim()).update(body).digest('base64url')}`;
}

async function inspect(name,viewport){
  const context=await browser.newContext({viewport,locale:'ms-MY',extraHTTPHeaders:{'x-affimatik-staging-key':stagingKey}});
  await context.addCookies([{name:'affimatik_session',value:sessionToken(),domain:'affimatik-launch-lite-staging.nanotiva-garden.workers.dev',path:'/',httpOnly:true,secure:true,sameSite:'Lax'}]);
  const page=await context.newPage();
  await page.goto(`${base}/styles`,{waitUntil:'networkidle',timeout:60_000});
  await page.getByText('NX30',{exact:true}).waitFor({state:'visible',timeout:30_000});
  await page.screenshot({path:path.join(output,`styles-${name}.png`),fullPage:true});
  const styles=await page.evaluate(()=>({
    cards:document.querySelectorAll('[data-testid^="style-media-"]').length,
    placeholders:[...document.querySelectorAll('[data-testid^="style-media-"]')].filter(node=>node.textContent?.includes('MP4 sebenar belum disahkan')).length,
    hasNX21:document.body.innerText.includes('NX21')&&document.body.innerText.includes('Kurung Catwalk'),
    hasNX30:document.body.innerText.includes('NX30')&&document.body.innerText.includes('Dapur Problem Solver'),
    overflow:document.documentElement.scrollWidth>window.innerWidth+1,
  }));

  await page.goto(`${base}/factory?styleId=NX21`,{waitUntil:'networkidle',timeout:60_000});
  await page.getByText('Kurung Catwalk',{exact:true}).first().waitFor({state:'visible',timeout:30_000});
  await page.screenshot({path:path.join(output,`factory-${name}.png`),fullPage:true});
  const factory=await page.evaluate(async()=>{
    const response=await fetch('/api/styles');const data=await response.json();
    return {apiStatus:response.status,apiCount:data.count,registryIds:data.styles?.map(style=>style.id),selected:document.body.innerText.includes('Kurung Catwalk'),promptStaging:document.body.innerText.includes('Prompt Staging'),overflow:document.documentElement.scrollWidth>window.innerWidth+1};
  });
  await context.close();
  return {viewport,styles,factory};
}

const report={mobile:await inspect('mobile-390',{width:390,height:844}),desktop:await inspect('desktop-1440',{width:1440,height:1000})};
await browser.close();
await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));

