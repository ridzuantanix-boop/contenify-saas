type ConversionRow={event_name:string;visitor_id?:string;user_id?:string;workspace_id?:string;occurred_at:string};
type ProfileRow={id:string;email?:string;full_name?:string;default_workspace_id?:string;tier?:string;created_at:string};
type OrderRow={workspace_id:string;plan_id?:string;status:string;payment_state?:string;amount_myr:number;created_at:string};
type JobRow={id?:string;user_id?:string;workspace_id:string;status:string;provider?:string;preset_id?:string;provider_task_id?:string;required_credits?:number;error_message?:string;created_at:string;completed_at?:string;updated_at:string};
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
  const today=dateKey(now);
  const eventsByName:Record<string,number>={};
  for(const event of input.events)eventsByName[event.event_name]=(eventsByName[event.event_name]||0)+1;
  const visitors=(events:ConversionRow[])=>new Set(events.map(event=>event.visitor_id).filter(Boolean)).size;
  const allVisitors=visitors(input.events),visitors7d=visitors(input.events.filter(event=>new Date(event.occurred_at).getTime()>=cut7)),visitors30d=visitors(input.events.filter(event=>new Date(event.occurred_at).getTime()>=cut30));
  const confirmed=input.orders.filter(order=>order.status==='PAID'&&['PAYMENT_CONFIRMED','BANK_PAYMENT_VERIFIED'].includes(order.payment_state||''));
  const provisional=input.orders.filter(order=>order.payment_state==='PROVISIONALLY_ACTIVE');
  const completed=input.jobs.filter(job=>job.status==='COMPLETED'),failed=input.jobs.filter(job=>job.status==='FAILED'||job.status==='FAILED_FINAL');
  const activeStatuses=new Set(['QUEUED','SUBMITTING','PROCESSING','GENERATING','QUALITY_CHECK']);
  const jobsToday=input.jobs.filter(job=>dateKey(job.created_at)===today);
  const completedToday=completed.filter(job=>dateKey(job.completed_at||job.updated_at)===today);
  const failedToday=failed.filter(job=>dateKey(job.updated_at)===today);
  const terminalToday=completedToday.length+failedToday.length;
  const jobs7d=input.jobs.filter(job=>new Date(job.created_at).getTime()>=cut7);
  const completed7d=completed.filter(job=>new Date(job.completed_at||job.updated_at).getTime()>=cut7);
  const failed7d=failed.filter(job=>new Date(job.updated_at).getTime()>=cut7);
  const jobs30d=input.jobs.filter(job=>new Date(job.created_at).getTime()>=cut30);
  const activeCreators=(cutoff:number)=>new Set(input.jobs.filter(job=>new Date(job.updated_at).getTime()>=cutoff).map(job=>job.workspace_id)).size;
  const activeCreatorsToday=new Set(input.jobs.filter(job=>dateKey(job.updated_at)===today).map(job=>job.workspace_id)).size;
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
  const profileByWorkspace=new Map(input.profiles.filter(row=>row.default_workspace_id).map(row=>[row.default_workspace_id!,row]));
  const styleMap=new Map<string,{styleId:string;total:number;completed:number;failed:number}>();
  for(const job of input.jobs){const styleId=job.preset_id||'Tidak dikenal pasti';const item=styleMap.get(styleId)||{styleId,total:0,completed:0,failed:0};item.total++;if(job.status==='COMPLETED')item.completed++;if(job.status==='FAILED'||job.status==='FAILED_FINAL')item.failed++;styleMap.set(styleId,item);}
  const topStyles=[...styleMap.values()].sort((a,b)=>b.total-a.total).slice(0,8).map(item=>({...item,successRate:percent(item.completed,item.completed+item.failed)}));
  const statusDistribution=Object.entries(input.jobs.reduce<Record<string,number>>((acc,job)=>{acc[job.status]=(acc[job.status]||0)+1;return acc;},{})).sort((a,b)=>b[1]-a[1]).map(([status,count])=>({status,count}));
  const recentJobs=[...input.jobs].sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime()).slice(0,30).map(job=>{const profile=profileByWorkspace.get(job.workspace_id);return{id:job.id||'',workspaceId:job.workspace_id,customer:profile?.full_name||'Pengguna',email:profile?.email||'',styleId:job.preset_id||'—',status:job.status,provider:job.provider||'—',providerTaskId:job.provider_task_id||'',requiredCredits:number(job.required_credits),createdAt:job.created_at,updatedAt:job.updated_at,error:job.error_message||''};});
  const tierDistribution=Object.entries(input.profiles.reduce<Record<string,number>>((acc,profile)=>{const tier=profile.tier||'free';acc[tier]=(acc[tier]||0)+1;return acc;},{})).sort((a,b)=>b[1]-a[1]).map(([tier,count])=>({tier,count}));
  const visitorsToday=visitors(input.events.filter(event=>dateKey(event.occurred_at)===today));
  const confirmedToday=confirmed.filter(order=>dateKey(order.created_at)===today);
  const confirmed30d=confirmed.filter(order=>new Date(order.created_at).getTime()>=cut30);
  return{
    traffic:{uniqueVisitors:allVisitors,uniqueVisitorsToday:visitorsToday,uniqueVisitors7d:visitors7d,uniqueVisitors30d:visitors30d,landingViews:eventsByName.landing_view||0,demoPlays:eventsByName.demo_play||0,trackingSince:input.events.length?input.events.reduce((min,event)=>new Date(event.occurred_at)<new Date(min)?event.occurred_at:min,input.events[0].occurred_at):null},
    funnel:{events:funnel,rates:{visitorToRegistration:percent(funnel.registration_completed,allVisitors),registrationToCheckout:percent(funnel.launch_checkout_started,funnel.registration_completed),checkoutToReceipt:percent(funnel.qr_evidence_submitted,funnel.launch_checkout_started),receiptToVerified:percent(funnel.payment_bank_verified,funnel.qr_evidence_submitted),verifiedToFirstVideo:percent(funnel.first_video_completed,funnel.payment_bank_verified)}},
    customers:{total:input.profiles.length,newToday:input.profiles.filter(row=>dateKey(row.created_at)===today).length,new24h:input.profiles.filter(row=>new Date(row.created_at).getTime()>=cut24).length,new7d:input.profiles.filter(row=>new Date(row.created_at).getTime()>=cut7).length,new30d:input.profiles.filter(row=>new Date(row.created_at).getTime()>=cut30).length,paying:new Set(confirmed.map(row=>row.workspace_id)).size,provisional:new Set(provisional.map(row=>row.workspace_id)).size,activeToday:activeCreatorsToday,active7d:activeCreators(cut7),active30d:activeWorkspaces30d,tierDistribution,recentSignups:[...input.profiles].sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime()).slice(0,10).map(profile=>({id:profile.id,name:profile.full_name||'Pengguna',email:profile.email||'',tier:profile.tier||'free',createdAt:profile.created_at}))},
    revenue:{confirmedMyr:money(confirmed.reduce((sum,row)=>sum+number(row.amount_myr),0)),confirmedTodayMyr:money(confirmedToday.reduce((sum,row)=>sum+number(row.amount_myr),0)),confirmed30dMyr:money(confirmed30d.reduce((sum,row)=>sum+number(row.amount_myr),0)),provisionalMyr:money(provisional.reduce((sum,row)=>sum+number(row.amount_myr),0)),confirmedOrders:confirmed.length,confirmedOrdersToday:confirmedToday.length,provisionalOrders:provisional.length},
    videos:{totalJobs:input.jobs.length,submittedToday:jobsToday.length,completed:completed.length,failed:failed.length,active:input.jobs.filter(job=>activeStatuses.has(job.status)).length,completedToday:completedToday.length,failedToday:failedToday.length,successRateToday:percent(completedToday.length,terminalToday),submitted7d:jobs7d.length,completed7d:completed7d.length,failed7d:failed7d.length,successRate7d:percent(completed7d.length,completed7d.length+failed7d.length),submitted30d:jobs30d.length,completed24h:completed.filter(job=>new Date(job.completed_at||job.updated_at).getTime()>=cut24).length,completed30d:completed.filter(job=>new Date(job.completed_at||job.updated_at).getTime()>=cut30).length,topStyles,statusDistribution,recentJobs},
    rewards:{claims:input.rewards.length,creditsGranted:input.rewards.reduce((sum,row)=>sum+number(row.credits_granted),0)},timeline:days,
  };
}

export async function getAdminDashboardInsights(){
  const[events,profiles,orders,jobs,rewards]=await Promise.all([
    rows<ConversionRow>('conversion_events?select=event_name,visitor_id,user_id,workspace_id,occurred_at&order=occurred_at.desc&limit=50000'),
    rows<ProfileRow>('profiles?select=id,email,full_name,default_workspace_id,tier,created_at&limit=10000'),
    rows<OrderRow>('orders?select=workspace_id,plan_id,status,payment_state,amount_myr,created_at&limit=10000'),
    rows<JobRow>('video_jobs?select=id,user_id,workspace_id,status,provider,preset_id,provider_task_id,required_credits,error_message,created_at,completed_at,updated_at&order=created_at.desc&limit=50000'),
    rows<RewardRow>('review_reward_claims?select=workspace_id,credits_granted,granted_at,status&limit=10000'),
  ]);
  return summarizeAdminDashboard({events,profiles,orders,jobs,rewards});
}
