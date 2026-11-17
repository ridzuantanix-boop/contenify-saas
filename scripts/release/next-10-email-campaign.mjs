import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import pg from 'pg';

const mode = process.argv[2] || 'preview';
if (!['preview','test','live'].includes(mode)) throw new Error('Mode must be preview, test or live.');
const campaignSlug = 'affimatik-the-next-10-2026';
const copyRevision = 'v2';
const subject = '10 gaya baru dah masuk — kini 30 gaya dalam AffiMatik';
const baseUrl = (process.env.APP_BASE_URL || 'https://affimatik.online').replace(/\/$/, '');
const posterUrl = `${baseUrl}/marketing/email/affimatik-the-next-10-launch.jpg`;
const sender = process.env.PAYMENT_EMAIL_FROM || 'AffiMatik <noreply@affimatik.online>';
const replyTo = 'support@affimatik.online';
const hash = (email) => createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
const output = resolve('output/email-campaigns/the-next-10');
await mkdir(output, { recursive: true });

function copy(unsubscribeUrl) {
  const text = `AFFIMATIK — THE NEXT 10

Konten affiliate anda baru dapat lebih banyak gaya.

Kalau produk banyak tetapi video selalu nampak hampir sama, ini update yang anda tunggu. 10 gaya baru sudah masuk ke AffiMatik:
• 6 gaya Fesyen
• 4 gaya Dapur
• Kini 30 gaya video affiliate untuk anda pilih

Daripada baju kurung, kebaya, tudung dan pakaian kanak-kanak hinggalah kuali, air fryer dan microwave — sekarang lebih mudah untuk hasilkan video yang sesuai dengan jenis produk anda.

Mahukan video yang lebih dekat dengan identiti konten anda? Untuk gaya yang menyokong personalization, anda juga boleh menggunakan gambar avatar sendiri dan background sendiri.

Tak perlu tulis skrip atau fikir prompt panjang. Upload gambar produk, pilih gaya, personalize jika diperlukan, kemudian biarkan Nexabot menghasilkan video affiliate Bahasa Melayu Malaysia.

Cuba gaya baru sekarang: ${baseUrl}/

Urus e-mel pemasaran: ${unsubscribeUrl}
Sokongan: ${replyTo}`;
  const html = `<!doctype html><html lang="ms"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f4f2f8;color:#111827;font-family:Arial,sans-serif"><div style="display:none;max-height:0;overflow:hidden">6 gaya fesyen, 4 gaya dapur — dan kini 30 gaya video affiliate untuk anda pilih.</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f2f8"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#fff;border:1px solid #e5e7eb;border-radius:24px;overflow:hidden"><tr><td><a href="${baseUrl}/" style="text-decoration:none"><img src="${posterUrl}" width="620" alt="AffiMatik — 10 gaya baru dah masuk, kini 30 gaya video affiliate" style="display:block;width:100%;height:auto;border:0"></a></td></tr><tr><td style="padding:34px 30px"><p style="margin:0;color:#6d28d9;font-size:12px;font-weight:800;letter-spacing:.14em">AFFIMATIK — THE NEXT 10</p><h1 style="margin:12px 0 16px;font-size:30px;line-height:1.15;color:#111827">Konten affiliate anda baru dapat lebih banyak gaya.</h1><p style="margin:0 0 18px;font-size:16px;line-height:1.7;color:#374151">Kalau produk banyak tetapi video selalu nampak hampir sama, ini update yang anda tunggu. <strong>10 gaya baru sudah masuk</strong> dan AffiMatik kini mempunyai <strong>30 gaya video affiliate</strong> untuk anda pilih.</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="padding:16px;background:#f5f3ff;border-radius:14px;font-size:15px;line-height:1.8;color:#312e81"><strong>👗 6 gaya Fesyen</strong><br><strong>🍳 4 gaya Dapur</strong><br><strong>✨ 30 gaya tersedia secara keseluruhan</strong></td></tr></table><p style="margin:22px 0 0;font-size:15px;line-height:1.7;color:#4b5563">Daripada baju kurung, kebaya, tudung dan pakaian kanak-kanak hinggalah kuali, air fryer dan microwave — kini lebih mudah untuk padankan gaya video dengan produk yang anda mahu promosikan.</p><h2 style="margin:26px 0 10px;font-size:21px;color:#111827">Video anda. Identiti anda.</h2><p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#4b5563">Untuk gaya yang menyokong personalization, gunakan gambar avatar sendiri dan background sendiri supaya hasil video lebih dekat dengan identiti konten anda.</p><p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#4b5563"><strong>Tak perlu tulis skrip atau fikir prompt panjang.</strong> Upload gambar produk, pilih gaya, personalize jika diperlukan, kemudian biarkan Nexabot menghasilkan video affiliate Bahasa Melayu Malaysia.</p><table role="presentation" cellspacing="0" cellpadding="0"><tr><td style="border-radius:12px;background:#6d28d9"><a href="${baseUrl}/" style="display:inline-block;padding:15px 24px;color:#fff;text-decoration:none;font-size:15px;font-weight:800">Cuba Gaya Baru Sekarang →</a></td></tr></table><p style="margin:28px 0 0;font-size:12px;line-height:1.7;color:#6b7280">Output kreatif bergantung pada imej, gaya dan provider. Semak kandungan sebelum diterbitkan.</p></td></tr><tr><td style="padding:22px 30px;background:#111827;color:#cbd5e1;font-size:11px;line-height:1.7">AffiMatik by Pawarna Studio · Dikendalikan oleh Muhammad Ridzuan bin Ramli<br>TTGU, Tasek Gelugor, Pulau Pinang · <a href="mailto:${replyTo}" style="color:#ddd6fe">${replyTo}</a><br><a href="${unsubscribeUrl}" style="color:#ddd6fe">Berhenti menerima e-mel pemasaran</a></td></tr></table></td></tr></table></body></html>`;
  return { html, text };
}

const preview = copy(`${baseUrl}/email/unsubscribe?token=PREVIEW_TOKEN`);
await writeFile(resolve(output,'preview.html'), preview.html);
await writeFile(resolve(output,'plain-text.txt'), preview.text);

if (mode === 'preview') {
  console.log(JSON.stringify({ mode, campaignSlug, copyRevision, subject, posterUrl, preview: resolve(output,'preview.html'), liveBlast:'PENDING_OWNER_AUTHORIZATION' }));
  process.exit(0);
}

for (const name of ['AFFIMATIK_BACKUP_DB_PASSWORD','RESEND_API_KEY','AFFIMATIK_SUPABASE_CA']) if (!process.env[name]) throw new Error(`${name} is required.`);
const client = new pg.Client({ host:'aws-0-ap-northeast-1.pooler.supabase.com',port:5432,user:'postgres.oudxnvazrdmnxdndpgmy',password:process.env.AFFIMATIK_BACKUP_DB_PASSWORD,database:'postgres',ssl:{ca:await (await import('node:fs/promises')).readFile(process.env.AFFIMATIK_SUPABASE_CA),rejectUnauthorized:true} });
await client.connect();
try {
  const campaign = (await client.query(`INSERT INTO email_campaigns(slug,name,subject,poster_path,status,metadata) VALUES($1,$2,$3,$4,'DRAFT',$5) ON CONFLICT(slug) DO UPDATE SET subject=excluded.subject,poster_path=excluded.poster_path,metadata=email_campaigns.metadata||excluded.metadata RETURNING id,status`,[campaignSlug,'AFFIMATIK — THE NEXT 10',subject,'/marketing/email/affimatik-the-next-10-launch.jpg',{sender,replyTo,copyRevision}])).rows[0];

  async function sendOne(email,token,idempotencyKey) {
    const unsubscribeUrl=`${baseUrl}/email/unsubscribe?token=${token}`,oneClickUrl=`${baseUrl}/api/email/unsubscribe?token=${token}`;const content=copy(unsubscribeUrl);
    const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':idempotencyKey},body:JSON.stringify({from:sender,to:[email],reply_to:replyTo,subject,html:content.html,text:content.text,headers:{'List-Unsubscribe':`<${oneClickUrl}>`,'List-Unsubscribe-Post':'List-Unsubscribe=One-Click'},tags:[{name:'campaign',value:'the_next_10'}]})});
    const result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(`Resend test send failed HTTP ${response.status}: ${String(result.name||result.message||'unknown').slice(0,100)}`);return result.id;
  }

  if (mode==='test') {
    const email=(process.env.AFFIMATIK_CAMPAIGN_TEST_EMAIL||'').trim().toLowerCase();if(!email)throw new Error('AFFIMATIK_CAMPAIGN_TEST_EMAIL is required.');const emailHash=hash(email);
    const pref=(await client.query(`INSERT INTO email_marketing_preferences(email_hash,source) VALUES($1,'AUTHORIZED_ADMIN_TEST') ON CONFLICT(email_hash) DO UPDATE SET updated_at=now() RETURNING unsubscribe_token`,[emailHash])).rows[0];
    await client.query(`INSERT INTO email_campaign_recipients(campaign_id,email_hash,status) VALUES($1,$2,'PENDING') ON CONFLICT(campaign_id,email_hash) DO NOTHING`,[campaign.id,emailHash]);
    const providerId=await sendOne(email,pref.unsubscribe_token,`${campaignSlug}/admin-test-${copyRevision}`);
    await client.query(`UPDATE email_campaign_recipients SET status='ACCEPTED',provider_email_id=$3,attempt_count=attempt_count+1,accepted_at=now(),updated_at=now() WHERE campaign_id=$1 AND email_hash=$2`,[campaign.id,emailHash,providerId]);
    await client.query(`UPDATE email_campaigns SET status='TESTED',accepted_count=(SELECT count(*) FROM email_campaign_recipients WHERE campaign_id=$1 AND status='ACCEPTED'),metadata=metadata||$2::jsonb WHERE id=$1`,[campaign.id,JSON.stringify({testAcceptedAt:new Date().toISOString(),deliveryStatus:'ACCEPTED_NOT_DELIVERED'})]);
    console.log(JSON.stringify({mode,status:'ACCEPTED',providerEmailId:providerId,campaignId:campaign.id,recipient:'AUTHORIZED_ADMIN_ONLY',liveBlast:'PENDING_OWNER_AUTHORIZATION'}));
    process.exit(0);
  }

  if (process.env.AFFIMATIK_LIVE_CAMPAIGN_AUTHORIZED!=='true') throw new Error('Live campaign is locked pending explicit final owner authorization.');
  const suppressionResponse=await fetch('https://api.resend.com/suppressions',{headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`}});
  if(!suppressionResponse.ok&&suppressionResponse.status!==401)throw new Error(`Provider suppression preflight unavailable (HTTP ${suppressionResponse.status}); live blast aborted.`);
  const providerSuppressionMode=suppressionResponse.ok?'SYNCED':'PROVIDER_MANAGED';
  const providerSuppressions=suppressionResponse.ok?((await suppressionResponse.json()).data||[]):[];
  for(const item of providerSuppressions){await client.query(`INSERT INTO email_suppressions(email_hash,reason,provider_source_id) VALUES($1,$2,$3) ON CONFLICT(email_hash) DO UPDATE SET reason=excluded.reason,provider_source_id=excluded.provider_source_id,active=true,updated_at=now()`,[hash(item.email),String(item.origin||'provider').toUpperCase()==='COMPLAINT'?'COMPLAINT':String(item.origin||'').toUpperCase()==='BOUNCE'?'BOUNCE':'PROVIDER',item.source_id||null]);}
  const recipients=(await client.query(`SELECT au.id user_id,lower(trim(au.email)) email FROM auth.users au JOIN profiles p ON p.id=au.id LEFT JOIN email_marketing_preferences emp ON emp.user_id=au.id LEFT JOIN email_suppressions es ON es.email_hash=encode(digest(lower(trim(au.email)),'sha256'),'hex') AND es.active WHERE au.email_confirmed_at IS NOT NULL AND au.email ~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' AND au.email NOT ILIKE '%@example.test' AND au.email NOT ILIKE '%+qa@%' AND coalesce(p.full_name,'') !~* '(^|[^a-z])(qa|test)([^a-z]|$)' AND coalesce(emp.marketing_enabled,true)=true AND es.email_hash IS NULL ORDER BY au.id`)).rows;
  const expected=Number(process.env.AFFIMATIK_EXPECTED_RECIPIENT_COUNT);if(!Number.isInteger(expected)||expected!==recipients.length)throw new Error(`Recipient count guard mismatch: expected ${expected}, eligible ${recipients.length}.`);
  await client.query(`UPDATE email_campaigns SET status='APPROVED',approved_at=now(),target_count=$2,metadata=metadata||$3::jsonb WHERE id=$1`,[campaign.id,recipients.length,JSON.stringify({providerSuppressionMode,providerSuppressionCount:suppressionResponse.ok?providerSuppressions.length:null,ownerAuthorizedAt:new Date().toISOString()})]);
  let accepted=0;
  for(let i=0;i<recipients.length;i+=100){const batch=recipients.slice(i,i+100);const emails=[];for(const recipient of batch){const emailHash=hash(recipient.email);const pref=(await client.query(`INSERT INTO email_marketing_preferences(user_id,email_hash,source) VALUES($1,$2,'EXISTING_ACCOUNT') ON CONFLICT(email_hash) DO UPDATE SET user_id=coalesce(email_marketing_preferences.user_id,excluded.user_id),updated_at=now() RETURNING unsubscribe_token`,[recipient.user_id,emailHash])).rows[0];await client.query(`INSERT INTO email_campaign_recipients(campaign_id,user_id,email_hash,status,batch_number) VALUES($1,$2,$3,'PENDING',$4) ON CONFLICT(campaign_id,email_hash) DO NOTHING`,[campaign.id,recipient.user_id,emailHash,(i/100)+1]);const unsubscribeUrl=`${baseUrl}/email/unsubscribe?token=${pref.unsubscribe_token}`,oneClickUrl=`${baseUrl}/api/email/unsubscribe?token=${pref.unsubscribe_token}`;const content=copy(unsubscribeUrl);emails.push({from:sender,to:[recipient.email],reply_to:replyTo,subject,html:content.html,text:content.text,headers:{'List-Unsubscribe':`<${oneClickUrl}>`,'List-Unsubscribe-Post':'List-Unsubscribe=One-Click'},tags:[{name:'campaign',value:'the_next_10'}]});}
    const response=await fetch('https://api.resend.com/emails/batch',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`${campaignSlug}/${copyRevision}/batch-${(i/100)+1}`},body:JSON.stringify(emails)});const result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(`Batch ${(i/100)+1} rejected HTTP ${response.status}.`);for(let j=0;j<batch.length;j++){await client.query(`UPDATE email_campaign_recipients SET status='ACCEPTED',provider_email_id=$3,attempt_count=1,accepted_at=now(),updated_at=now() WHERE campaign_id=$1 AND email_hash=$2`,[campaign.id,hash(batch[j].email),result.data?.[j]?.id||null]);accepted++;}}
  await client.query(`UPDATE email_campaigns SET status='COMPLETED',accepted_count=$2,completed_at=now() WHERE id=$1`,[campaign.id,accepted]);
  console.log(JSON.stringify({mode,status:'COMPLETED',eligible:recipients.length,providerSuppressionMode,providerSuppressed:suppressionResponse.ok?providerSuppressions.length:'ENFORCED_BY_RESEND_COUNT_UNAVAILABLE',accepted,delivered:'PENDING_PROVIDER_EVENTS'}));
} finally { await client.end(); }
