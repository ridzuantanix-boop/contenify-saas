type ConversionRow={event_name:string;visitor_id?:string;user_id?:string;workspace_id?:string;occurred_at:string};
type ProfileRow={id:string;default_workspace_id?:string;tier?:string;created_at:string};
type OrderRow={workspace_id:string;status:string;payment_state?:string;amount_myr:number;created_at:string};
type JobRow={workspace_id:string;status:string;provider?:string;created_at:string;completed_at?:string;updated_at:string};
type RewardRow={workspace_id:string;credits_granted:number;granted_at:string;status:string};

function database(){
  if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)throw new Error('Pangkalan data production tidak tersedia.');
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  return{base:process.env.SUPABASE_URL.replace(/\/$/,''),headers:{apikey:key,Authorization:`Bearer ${key}`}};
}
async function rows<T>(path:string):Promise<T[]>{
  const{base,headers}=database();const response=await fetch(`${base}/rest/v1/${path}`,{headers,cache:'no-store'});
  if(!response.ok)throw new Error(`Admin analytics tidak tersedia (${response.status}).`);
  return response.json() as Promise<T[]>;
}
const number=(value:unknown)=>Number.isFinite(Number(value))?Number(value):0;
const money=(value:number)=>Math.round(value*100)/100;
const percent=(value:number,total:number)=>total>0?Math.round(value/total*1000)/10:0;
const dateKey=(value:Date|string)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));

export function summarizeAdminDashboard(input:{events:ConversionRow[];profiles:ProfileRow[];orders:OrderRow[];jobs:JobRow[];rewards:RewardRow[];now?:Date}){
  const now=input.now||new Date(),day=86400000,cut7=now.getTime()-7*day,cut30=now.getTime()-30*day,cut24=now.getTime()-day;
  const eventsByName:Record<string,number>={};
  for(const event of input.events)eventsByName[event.event_name]=(eventsByName[event.event_name]||0)+1;
  const visitors=(events:ConversionRow[])=>new Set(events.map(event=>event.visitor_id).filter(Boolean)).size;
  const allVisitors=visitors(input.events),visitors7d=visitors(input.events.filter(event=>new Date(event.occurred_at).getTime()>=cut7)),visitors30d=visitors(input.events.filter(event=>new Date(event.occurred_at).getTime()>=cut30));
  const confirmed=input.orders.filter(order=>order.status==='PAID'&&['PAYMENT_CONFIRMED','BANK_PAYMENT_VERIFIED'].includes(order.payment_state||''));
  const provisional=input.orders.filter(order=>order.payment_state==='PROVISIONALLY_ACTIVE');
  const completed=input.jobs.filter(job=>job.status==='COMPLETED'),failed=input.jobs.filter(job=>job.status==='FAILED'||job.status==='FAILED_FINAL');
  const activeStatuses=new Set(['QUEUED','SUBMITTING','PROCESSING','GENERATING','QUALITY_CHECK']);
  const activeWorkspaces30d=new Set(input.jobs.filter(job=>new Date(job.updated_at).getTime()>=cut30).map(job=>job.workspace_id)).size;
  const days=Array.from({length:14},(_,index)=>{const date=new Date(now.getTime()-(13-index)*day);return{date:dateKey(date),visitors:0,registrations:0,completedVideos:0}});
  const timeline=new Map(days.map(item=>[item.date,item]));
  const visitorsByDate=new Map<string,Set<string>>();
  for(const event of input.events){const key=dateKey(event.occurred_at);if(!timeline.has(key)||!event.visitor_id)continue;if(!visitorsByDate.has(key))visitorsByDate.set(key,new Set());visitorsByDate.get(key)!.add(event.visitor_id);}
  for(const profile of input.profiles){const item=timeline.get(dateKey(profile.created_at));if(item)item.registrations++;}
  for(const job of completed){const item=timeline.get(dateKey(job.completed_at||job.updated_at));if(item)item.completedVideos++;}
  for(const item of days)item.visitors=visitorsByDate.get(item.date)?.size||0;
  const funnelNames=['landing_view','launch_cta_click','registration_started','registration_completed','email_verified','launch_checkout_started','qr_evidence_submitted','payment_bank_verified','first_video_completed'];
  const funnel=Object.fromEntries(funnelNames.map(name=>[name,eventsByName[name]||0]));
  return{
    traffic:{uniqueVisitors:allVisitors,uniqueVisitors7d:visitors7d,uniqueVisitors30d:visitors30d,landingViews:eventsByName.landing_view||0,demoPlays:eventsByName.demo_play||0,trackingSince:input.events.length?input.events.reduce((min,event)=>new Date(event.occurred_at)<new Date(min)?event.occurred_at:min,input.events[0].occurred_at):null},
    funnel:{events:funnel,rates:{visitorToRegistration:percent(funnel.registration_completed,allVisitors),registrationToCheckout:percent(funnel.launch_checkout_started,funnel.registration_completed),checkoutToReceipt:percent(funnel.qr_evidence_submitted,funnel.launch_checkout_started),receiptToVerified:percent(funnel.payment_bank_verified,funnel.qr_evidence_submitted),verifiedToFirstVideo:percent(funnel.first_video_completed,funnel.payment_bank_verified)}},
    customers:{total:input.profiles.length,new24h:input.profiles.filter(row=>new Date(row.created_at).getTime()>=cut24).length,new7d:input.profiles.filter(row=>new Date(row.created_at).getTime()>=cut7).length,new30d:input.profiles.filter(row=>new Date(row.created_at).getTime()>=cut30).length,paying:new Set(confirmed.map(row=>row.workspace_id)).size,provisional:new Set(provisional.map(row=>row.workspace_id)).size,active30d:activeWorkspaces30d},
    revenue:{confirmedMyr:money(confirmed.reduce((sum,row)=>sum+number(row.amount_myr),0)),provisionalMyr:money(provisional.reduce((sum,row)=>sum+number(row.amount_myr),0)),confirmedOrders:confirmed.length,provisionalOrders:provisional.length},
    videos:{totalJobs:input.jobs.length,completed:completed.length,failed:failed.length,active:input.jobs.filter(job=>activeStatuses.has(job.status)).length,completed24h:completed.filter(job=>new Date(job.completed_at||job.updated_at).getTime()>=cut24).length,completed30d:completed.filter(job=>new Date(job.completed_at||job.updated_at).getTime()>=cut30).length},
    rewards:{claims:input.rewards.length,creditsGranted:input.rewards.reduce((sum,row)=>sum+number(row.credits_granted),0)},timeline:days,
  };
}

export async function getAdminDashboardInsights(){
  const[events,profiles,orders,jobs,rewards]=await Promise.all([
    rows<ConversionRow>('conversion_events?select=event_name,visitor_id,user_id,workspace_id,occurred_at&order=occurred_at.desc&limit=50000'),
    rows<ProfileRow>('profiles?select=id,default_workspace_id,tier,created_at&limit=10000'),
    rows<OrderRow>('orders?select=workspace_id,status,payment_state,amount_myr,created_at&limit=10000'),
    rows<JobRow>('video_jobs?select=workspace_id,status,provider,created_at,completed_at,updated_at&limit=50000'),
    rows<RewardRow>('review_reward_claims?select=workspace_id,credits_granted,granted_at,status&limit=10000'),
  ]);
  return summarizeAdminDashboard({events,profiles,orders,jobs,rewards});
}
