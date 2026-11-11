type PaymentControl={paymentHold:boolean;holdReason?:string;holdOrderId?:string};
export type PaymentEmailEvent='PAYMENT_DECLARATION_RECEIVED'|'PAYMENT_PROVISIONAL_ACTIVE'|'PAYMENT_CONFIRMED'|'PAYMENT_REJECTED'|'PAYMENT_HOLD_RELEASED';

export function paymentEmailConfiguration(){
 return{configured:Boolean(process.env.RESEND_API_KEY),sender:process.env.PAYMENT_EMAIL_FROM||'AffiMatik <noreply@affimatik.online>',provider:'Resend'};
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
 return{subject:item.subject,text:`${item.heading}\n\n${item.message}${input.orderId?`\n\nRujukan: ${input.orderId}`:''}`,html:`<!doctype html><html><body style="margin:0;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a"><div style="max-width:560px;margin:0 auto;padding:32px 16px"><div style="background:white;border:1px solid #e2e8f0;border-radius:18px;padding:28px"><p style="margin:0 0 18px;color:#4f46e5;font-weight:800">AffiMatik by Pawarna</p><h1 style="font-size:22px;line-height:1.3;margin:0 0 14px;color:${item.accent}">${escapeHtml(item.heading)}</h1><p style="font-size:15px;line-height:1.7;margin:0">${escapeHtml(item.message)}</p>${reference}<p style="font-size:12px;line-height:1.6;color:#64748b;margin:24px 0 0">Emel automatik AffiMatik. Untuk bantuan, balas melalui saluran sokongan rasmi.</p></div></div></body></html>`};
}

export async function sendPaymentEventEmail(input:{to:string;event:PaymentEmailEvent;orderId?:string;credits?:number;amountMyr?:number}){
 let status:'SENT'|'FAILED'|'NOT_CONFIGURED'='NOT_CONFIGURED';const email=buildPaymentEmail(input);
 if(process.env.RESEND_API_KEY&&input.to){try{const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.PAYMENT_EMAIL_FROM||'AffiMatik <noreply@affimatik.online>',to:[input.to],subject:email.subject,html:email.html,text:email.text})});status=response.ok?'SENT':'FAILED';}catch{status='FAILED';}}
 if(input.orderId){const{base,headers}=db();await fetch(`${base}/rest/v1/customer_notifications?related_order_id=eq.${encodeURIComponent(input.orderId)}&notification_type=eq.${encodeURIComponent(input.event)}&email_status=eq.PENDING`,{method:'PATCH',headers:{...headers,Prefer:'return=minimal'},body:JSON.stringify({email_status:status})}).catch(()=>undefined);}
 return status;
}

export async function listProvisionalExposure(){
 const{base,headers}=db();const response=await fetch(`${base}/rest/v1/provisional_payment_exposure?select=*&order=evidence_submitted_at.asc`,{headers,cache:'no-store'});if(!response.ok)throw new Error('Semakan bayaran provisional tidak tersedia.');
 const exposure=await response.json() as Array<Record<string,unknown>>,ids=[...new Set(exposure.map(row=>String(row.user_id||'')).filter(Boolean))];if(!ids.length)return exposure;
 const profiles=await fetch(`${base}/rest/v1/profiles?id=in.(${ids.map(encodeURIComponent).join(',')})&select=id,email,full_name`,{headers,cache:'no-store'});if(!profiles.ok)return exposure;
 const map=new Map((await profiles.json() as Array<{id:string;email:string;full_name?:string}>).map(profile=>[profile.id,profile]));return exposure.map(row=>({...row,customer:map.get(String(row.user_id))||null}));
}
