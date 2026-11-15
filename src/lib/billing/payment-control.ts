type PaymentControl={paymentHold:boolean;holdReason?:string;holdOrderId?:string};
export type PaymentEmailEvent='PAYMENT_DECLARATION_RECEIVED'|'PAYMENT_PROVISIONAL_ACTIVE'|'PAYMENT_CONFIRMED'|'PAYMENT_REJECTED'|'PAYMENT_HOLD_RELEASED';
type EmailDeliveryStatus='SENT'|'FAILED'|'NOT_CONFIGURED';
type PendingEmailNotification={id:string;user_id:string;notification_type:PaymentEmailEvent;related_order_id?:string;email_attempts:number};

export function paymentEmailConfiguration(){
 return{configured:Boolean(process.env.RESEND_API_KEY),sender:process.env.PAYMENT_EMAIL_FROM||'AffiMatik <noreply@affimatik.online>',replyTo:process.env.PAYMENT_EMAIL_REPLY_TO||'support@affimatik.online',provider:'Resend'};
}

function db(){if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)throw new Error('Pangkalan data tidak tersedia.');const key=process.env.SUPABASE_SERVICE_ROLE_KEY;return{base:process.env.SUPABASE_URL.replace(/\/$/,''),headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'}};}
const escapeHtml=(value:string)=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]||char));

export async function getWorkspacePaymentControl(workspaceId:string):Promise<PaymentControl>{
 if(process.env.VITEST&&!process.env.SUPABASE_URL)return{paymentHold:false};
 const{base,headers}=db();const r=await fetch(`${base}/rest/v1/workspace_payment_controls?workspace_id=eq.${encodeURIComponent(workspaceId)}&select=hold_status,hold_reason,hold_order_id&limit=1`,{headers,cache:'no-store'});
 if(!r.ok){if(r.status===404)return{paymentHold:false};throw new Error('Status pembayaran akaun tidak tersedia.');}
 const rows=await r.json() as Array<{hold_status:string;hold_reason?:string;hold_order_id?:string}>;return{paymentHold:rows[0]?.hold_status==='PAYMENT_HOLD',holdReason:rows[0]?.hold_reason,holdOrderId:rows[0]?.hold_order_id};
}
export async function listCustomerNotifications(workspaceId:string){const{base,headers}=db();const r=await fetch(`${base}/rest/v1/customer_notifications?workspace_id=eq.${encodeURIComponent(workspaceId)}&select=id,title,message,notification_type,related_order_id,read_at,created_at&order=created_at.desc&limit=20`,{headers,cache:'no-store'});if(!r.ok)return[];return r.json();}
export async function getProfileEmail(userId:string){const{base,headers}=db();const r=await fetch(`${base}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=email&limit=1`,{headers});if(!r.ok)return'';const rows=await r.json() as Array<{email:string}>;return rows[0]?.email||'';}
export async function getWorkspaceOwnerEmail(workspaceId:string){const{base,headers}=db();const workspace=await fetch(`${base}/rest/v1/workspaces?id=eq.${encodeURIComponent(workspaceId)}&select=owner_id&limit=1`,{headers});if(!workspace.ok)return'';const rows=await workspace.json() as Array<{owner_id:string}>;return rows[0]?.owner_id?getProfileEmail(rows[0].owner_id):'';}

export function buildPaymentEmail(input:{event:PaymentEmailEvent;orderId?:string;credits?:number;amountMyr?:number}){
 const credits=Number(input.credits||0).toLocaleString('ms-MY'),amount=Number(input.amountMyr||0).toFixed(2);
 const content:Record<PaymentEmailEvent,{subject:string;heading:string;message:string;accent:string}>={
  PAYMENT_DECLARATION_RECEIVED:{subject:'Deklarasi pembayaran AffiMatik diterima',heading:'Bukti pembayaran dah diterima',message:`Kami dah terima deklarasi pembayaran${input.amountMyr?` berjumlah RM${amount}`:''}. Ia masih belum disahkan melalui rekod bank dan akan disemak oleh pihak AffiMatik.`,accent:'#d97706'},
  PAYMENT_PROVISIONAL_ACTIVE:{subject:'Kredit AffiMatik anda dah aktif',heading:`${credits} kredit dah boleh digunakan`,message:'Kredit pakej anda telah diaktifkan serta-merta dan boleh digunakan untuk menjana video. Pembayaran masih dalam proses pengesahan dan belum dianggap diterima oleh bank.',accent:'#4f46e5'},
  PAYMENT_CONFIRMED:{subject:'Pembayaran AffiMatik anda telah disahkan',heading:'Pembayaran telah disahkan',message:'Semakan pembayaran selesai. Akaun, kredit dan akses AffiMatik anda kekal aktif. Tiada kredit tambahan diberikan semasa pengesahan ini.',accent:'#059669'},
  PAYMENT_REJECTED:{subject:'Semakan pembayaran AffiMatik diperlukan',heading:'Kami perlukan maklumat pembayaran yang betul',message:'Pembayaran anda belum dapat disahkan. Penggunaan kredit akaun dibekukan sementara—tanpa memadam baki atau video sedia ada. Sila hubungi sokongan atau kemukakan maklumat pembayaran yang betul.',accent:'#dc2626'},
  PAYMENT_HOLD_RELEASED:{subject:'Akaun AffiMatik anda telah diaktifkan semula',heading:'Semakan pembayaran telah selesai',message:'Sekatan sementara telah dilepaskan. Anda boleh menggunakan baki kredit dan menjana video seperti biasa.',accent:'#059669'},
 };
 const item=content[input.event],reference=input.orderId?`<p style="font-size:12px;color:#64748b;margin-top:24px">Rujukan: ${escapeHtml(input.orderId)}</p>`:'';
 return{subject:item.subject,text:`${item.heading}\n\n${item.message}${input.orderId?`\n\nRujukan: ${input.orderId}`:''}\n\nBantuan: support@affimatik.online`,html:`<!doctype html><html><body style="margin:0;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a"><div style="max-width:560px;margin:0 auto;padding:32px 16px"><div style="background:white;border:1px solid #e2e8f0;border-radius:18px;padding:28px"><p style="margin:0 0 18px;color:#4f46e5;font-weight:800">AffiMatik by Pawarna</p><h1 style="font-size:22px;line-height:1.3;margin:0 0 14px;color:${item.accent}">${escapeHtml(item.heading)}</h1><p style="font-size:15px;line-height:1.7;margin:0">${escapeHtml(item.message)}</p>${reference}<p style="font-size:12px;line-height:1.6;color:#64748b;margin:24px 0 0">Emel automatik AffiMatik. Perlukan bantuan? Hubungi <a href="mailto:support@affimatik.online" style="color:#4f46e5">support@affimatik.online</a>.</p></div></div></body></html>`};
}

function retryAt(attempt:number){const minutes=[5,15,60,240,720][Math.max(0,Math.min(attempt-1,4))];return new Date(Date.now()+minutes*60_000).toISOString();}
function safeProviderError(status:number,payload:unknown){const record=payload&&typeof payload==='object'?payload as Record<string,unknown>:{};return `HTTP_${status}:${String(record.name||record.message||'RESEND_ERROR').slice(0,300)}`;}
function idempotencyKey(event:PaymentEmailEvent,orderId?:string){return `affimatik/${event}/${orderId||'no-order'}`.slice(0,256);}

async function deliverPaymentEmail(input:{to:string;event:PaymentEmailEvent;orderId?:string;credits?:number;amountMyr?:number}){
 if(!process.env.RESEND_API_KEY)return{status:'NOT_CONFIGURED' as EmailDeliveryStatus,error:'RESEND_API_KEY_NOT_CONFIGURED'};
 if(!input.to)return{status:'FAILED' as EmailDeliveryStatus,error:'CUSTOMER_EMAIL_MISSING'};
 const email=buildPaymentEmail(input),config=paymentEmailConfiguration();
 try{
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':idempotencyKey(input.event,input.orderId)},body:JSON.stringify({from:config.sender,to:[input.to],reply_to:config.replyTo,subject:email.subject,html:email.html,text:email.text})});
  const payload=await response.json().catch(()=>({})) as Record<string,unknown>;
  if(response.ok)return{status:'SENT' as EmailDeliveryStatus,providerId:typeof payload.id==='string'?payload.id:undefined};
  return{status:'FAILED' as EmailDeliveryStatus,error:safeProviderError(response.status,payload)};
 }catch(error){return{status:'FAILED' as EmailDeliveryStatus,error:`NETWORK:${error instanceof Error?error.name:'UNKNOWN'}`};}
}

async function updateEmailState(input:{notificationId?:string;orderId?:string;event:PaymentEmailEvent;status:EmailDeliveryStatus;providerId?:string;error?:string;attempt?:number}){
 const{base,headers}=db();
 if(input.notificationId){await fetch(`${base}/rest/v1/rpc/finish_customer_notification_email`,{method:'POST',headers,body:JSON.stringify({p_notification_id:input.notificationId,p_status:input.status,p_provider_id:input.providerId||null,p_error:input.error||null,p_next_attempt_at:input.status==='SENT'?null:retryAt(input.attempt||1)})});return;}
 if(!input.orderId)return;
 await fetch(`${base}/rest/v1/customer_notifications?related_order_id=eq.${encodeURIComponent(input.orderId)}&notification_type=eq.${encodeURIComponent(input.event)}&email_status=in.(PENDING,FAILED,NOT_CONFIGURED)`,{method:'PATCH',headers:{...headers,Prefer:'return=minimal'},body:JSON.stringify({email_status:input.status,email_provider_id:input.providerId||null,email_last_error:input.error||null,email_next_attempt_at:input.status==='SENT'?null:retryAt(1)})}).catch(()=>undefined);
}

export async function ensurePaymentEventNotification(input:{workspaceId:string;userId:string;event:PaymentEmailEvent;orderId:string;amountMyr?:number;credits?:number}){
 const{base,headers}=db(),email=buildPaymentEmail(input),dedupe=idempotencyKey(input.event,input.orderId);
 const response=await fetch(`${base}/rest/v1/customer_notifications?on_conflict=email_dedupe_key`,{method:'POST',headers:{...headers,Prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify({workspace_id:input.workspaceId,user_id:input.userId,title:email.subject,message:email.text,notification_type:input.event,related_order_id:input.orderId,email_dedupe_key:dedupe})});
 if(!response.ok)throw new Error(`CUSTOMER_NOTIFICATION_WRITE_${response.status}`);
}

export async function sendPaymentEventEmail(input:{to:string;event:PaymentEmailEvent;orderId?:string;credits?:number;amountMyr?:number}){
 const delivery=await deliverPaymentEmail(input);await updateEmailState({...input,...delivery}).catch(()=>undefined);return delivery.status;
}

export async function retryPendingPaymentEmails(limit=20){
 if(!process.env.RESEND_API_KEY)return{configured:false,claimed:0,sent:0,failed:0};
 const{base,headers}=db();const claim=await fetch(`${base}/rest/v1/rpc/claim_customer_notification_emails`,{method:'POST',headers,body:JSON.stringify({p_limit:limit,p_lease_seconds:300})});
 if(!claim.ok)throw new Error(`EMAIL_QUEUE_CLAIM_${claim.status}`);
 const notifications=await claim.json() as PendingEmailNotification[];if(!notifications.length)return{configured:true,claimed:0,sent:0,failed:0};
 const userIds=[...new Set(notifications.map(item=>item.user_id))],profiles=await fetch(`${base}/rest/v1/profiles?id=in.(${userIds.map(encodeURIComponent).join(',')})&select=id,email`,{headers});
 const emails=new Map<string,string>();if(profiles.ok)for(const profile of await profiles.json() as Array<{id:string;email:string}>)emails.set(profile.id,profile.email);
 const orderIds=[...new Set(notifications.map(item=>item.related_order_id).filter((value):value is string=>Boolean(value)))],orders=new Map<string,{amount_myr:number;credits_granted:number}>();
 if(orderIds.length){const response=await fetch(`${base}/rest/v1/orders?id=in.(${orderIds.map(encodeURIComponent).join(',')})&select=id,amount_myr,credits_granted`,{headers});if(response.ok)for(const order of await response.json() as Array<{id:string;amount_myr:number;credits_granted:number}>)orders.set(order.id,order);}
 let sent=0,failed=0;
 for(const item of notifications){const order=item.related_order_id?orders.get(item.related_order_id):undefined;const delivery=await deliverPaymentEmail({to:emails.get(item.user_id)||'',event:item.notification_type,orderId:item.related_order_id,amountMyr:order?.amount_myr,credits:order?.credits_granted});await updateEmailState({notificationId:item.id,event:item.notification_type,status:delivery.status,providerId:delivery.providerId,error:delivery.error,attempt:item.email_attempts});if(delivery.status==='SENT')sent++;else failed++;}
 return{configured:true,claimed:notifications.length,sent,failed};
}

export async function listProvisionalExposure(){
 const{base,headers}=db();const response=await fetch(`${base}/rest/v1/provisional_payment_exposure?select=*&order=evidence_submitted_at.asc`,{headers,cache:'no-store'});if(!response.ok)throw new Error('Semakan bayaran provisional tidak tersedia.');
 const exposure=await response.json() as Array<Record<string,unknown>>,ids=[...new Set(exposure.map(row=>String(row.user_id||'')).filter(Boolean))];if(!ids.length)return exposure;
 const profiles=await fetch(`${base}/rest/v1/profiles?id=in.(${ids.map(encodeURIComponent).join(',')})&select=id,email,full_name`,{headers,cache:'no-store'});if(!profiles.ok)return exposure;
 const map=new Map((await profiles.json() as Array<{id:string;email:string;full_name?:string}>).map(profile=>[profile.id,profile]));return exposure.map(row=>({...row,customer:map.get(String(row.user_id))||null}));
}
