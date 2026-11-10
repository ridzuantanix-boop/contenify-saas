type PaymentControl={paymentHold:boolean;holdReason?:string;holdOrderId?:string};
function db(){if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)throw new Error('Pangkalan data tidak tersedia.');const key=process.env.SUPABASE_SERVICE_ROLE_KEY;return{base:process.env.SUPABASE_URL.replace(/\/$/,''),headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'}};}
export async function getWorkspacePaymentControl(workspaceId:string):Promise<PaymentControl>{
 if(process.env.VITEST&&!process.env.SUPABASE_URL)return{paymentHold:false};
 const{base,headers}=db();const r=await fetch(`${base}/rest/v1/workspace_payment_controls?workspace_id=eq.${encodeURIComponent(workspaceId)}&select=hold_status,hold_reason,hold_order_id&limit=1`,{headers,cache:'no-store'});
 if(!r.ok){if(r.status===404)return{paymentHold:false};throw new Error('Status pembayaran akaun tidak tersedia.');}
 const rows=await r.json() as Array<{hold_status:string;hold_reason?:string;hold_order_id?:string}>;return{paymentHold:rows[0]?.hold_status==='PAYMENT_HOLD',holdReason:rows[0]?.hold_reason,holdOrderId:rows[0]?.hold_order_id};
}
export async function listCustomerNotifications(workspaceId:string){const{base,headers}=db();const r=await fetch(`${base}/rest/v1/customer_notifications?workspace_id=eq.${encodeURIComponent(workspaceId)}&select=id,title,message,notification_type,related_order_id,read_at,created_at&order=created_at.desc&limit=20`,{headers,cache:'no-store'});if(!r.ok)return[];return r.json();}
export async function getProfileEmail(userId:string){const{base,headers}=db();const r=await fetch(`${base}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=email&limit=1`,{headers});if(!r.ok)return'';const rows=await r.json() as Array<{email:string}>;return rows[0]?.email||'';}
export async function sendPaymentStatusEmail(input:{to:string;subject:string;message:string;orderId:string;notificationType:string}){
 const{base,headers}=db();let status:'SENT'|'FAILED'|'NOT_CONFIGURED'='NOT_CONFIGURED';
 if(process.env.RESEND_API_KEY&&input.to){try{const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.PAYMENT_EMAIL_FROM||'AffiMatik <noreply@affimatik.online>',to:[input.to],subject:input.subject,html:`<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px"><h2 style="color:#4338ca">AffiMatik</h2><p>${input.message}</p><p style="font-size:12px;color:#64748b">Rujukan pesanan: ${input.orderId}</p></div>`})});status=r.ok?'SENT':'FAILED';}catch{status='FAILED';}}
 await fetch(`${base}/rest/v1/customer_notifications?related_order_id=eq.${encodeURIComponent(input.orderId)}&notification_type=eq.${encodeURIComponent(input.notificationType)}&email_status=eq.PENDING`,{method:'PATCH',headers:{...headers,Prefer:'return=minimal'},body:JSON.stringify({email_status:status})}).catch(()=>undefined);
 return status;
}
export async function listProvisionalExposure(){const{base,headers}=db();const r=await fetch(`${base}/rest/v1/provisional_payment_exposure?select=*&order=evidence_submitted_at.desc`,{headers,cache:'no-store'});if(!r.ok)throw new Error('Semakan bayaran provisional tidak tersedia.');return r.json();}
