type OrderRow={id:string;workspace_id:string;plan_id:string;amount_myr:number;status:string;payment_state?:string;metadata?:Record<string,unknown>};
type WalletRow={balance:number};
type CommissionRow={amount_myr:number;status:string};
type JobRow={id:string;status:string;provider:string;provider_model_id?:string;created_at:string;updated_at:string;error_message?:string;submission_uncertain?:boolean;output_size_bytes?:number};
type CostRow={job_id:string;estimated_myr_cost?:number;observed_provider_credits?:number;cost_status?:string};
type SizedRow={size_bytes?:number};

export type CommercialOperationsInput={orders:OrderRow[];wallets:WalletRow[];commissions:CommissionRow[];jobs:JobRow[];costs:CostRow[];products:SizedRow[];backgrounds:SizedRow[];now?:Date;storageCostPerGbMyr?:number;fixedOperatingCostMyr?:number;creditReservePerVideoMyr?:number};

const money=(value:number)=>Math.round(value*100)/100;
const number=(value:unknown)=>Number.isFinite(Number(value))?Number(value):0;

export function summarizeCommercialOperations(input:CommercialOperationsInput){
 const now=input.now||new Date(),dayAgo=now.getTime()-86400000,stuckBefore=now.getTime()-15*60000;
 const confirmed=input.orders.filter(order=>order.status==='PAID'&&['PAYMENT_CONFIRMED','BANK_PAYMENT_VERIFIED'].includes(order.payment_state||'')&&order.metadata?.qa_simulation!==true);
 const provisional=input.orders.filter(order=>order.status==='PENDING'&&order.payment_state==='PROVISIONALLY_ACTIVE');
 const sales:{starter:{orders:number;revenueMyr:number};pro:{orders:number;revenueMyr:number};agency:{orders:number;revenueMyr:number};topUp:{orders:number;revenueMyr:number}}={starter:{orders:0,revenueMyr:0},pro:{orders:0,revenueMyr:0},agency:{orders:0,revenueMyr:0},topUp:{orders:0,revenueMyr:0}};
 for(const order of confirmed){const key=order.plan_id.startsWith('topup_')?'topUp':order.plan_id==='plan_agency'?'agency':order.plan_id==='plan_pro'?'pro':'starter';sales[key].orders++;sales[key].revenueMyr=money(sales[key].revenueMyr+number(order.amount_myr));}
 const completedNexabot=input.jobs.filter(job=>job.provider==='nexabot'&&job.status==='COMPLETED');
 const completedIds=new Set(completedNexabot.map(job=>job.id));
 const completedCosts=input.costs.filter(cost=>completedIds.has(cost.job_id));
 const estimatedProviderCostMyr=money(completedCosts.reduce((sum,cost)=>sum+number(cost.estimated_myr_cost),0));
 const observedProviderCredits=money(completedCosts.reduce((sum,cost)=>sum+number(cost.observed_provider_credits),0));
 const storageBytes=[...input.products,...input.backgrounds].reduce((sum,row)=>sum+number(row.size_bytes),0)+input.jobs.reduce((sum,row)=>sum+number(row.output_size_bytes),0);
 const storageGb=storageBytes/1073741824,storageRate=Math.max(0,number(input.storageCostPerGbMyr)),storageCost=money(storageGb*storageRate);
 const operatingCost=money(Math.max(0,number(input.fixedOperatingCostMyr)));
 const affiliateLiability=money(input.commissions.filter(item=>['PENDING','APPROVED','PAYABLE'].includes(item.status)).reduce((sum,item)=>sum+number(item.amount_myr),0));
 const confirmedRevenue=money(confirmed.reduce((sum,order)=>sum+number(order.amount_myr),0));
 const outstandingCredits=input.wallets.reduce((sum,wallet)=>sum+number(wallet.balance),0),reservePerVideo=Math.max(0,number(input.creditReservePerVideoMyr)||0.15);
 const estimatedCreditLiability=money(outstandingCredits/10*reservePerVideo);
 const recentProviderJobs=input.jobs.filter(job=>job.provider==='nexabot'&&new Date(job.updated_at).getTime()>=dayAgo);
 const recentFailures=recentProviderJobs.filter(job=>job.status==='FAILED');
 const stuck=input.jobs.filter(job=>job.provider==='nexabot'&&['PROCESSING','SUBMITTING'].includes(job.status)&&new Date(job.updated_at).getTime()<stuckBefore);
 const balanceErrors=input.jobs.filter(job=>job.provider==='nexabot'&&new Date(job.updated_at).getTime()>=dayAgo&&/insufficient|baki|provider credit|credit balance/i.test(job.error_message||''));
 const uncertain=input.jobs.filter(job=>job.provider==='nexabot'&&job.submission_uncertain===true);
 const failureRate=recentProviderJobs.length?recentFailures.length/recentProviderJobs.length:0;
 const alerts:Array<{severity:'critical'|'warning';code:string;message:string;count:number}>=[];
 if(stuck.length)alerts.push({severity:'critical',code:'STUCK_JOBS',message:'Job Nexabot melebihi 15 minit tanpa kemas kini.',count:stuck.length});
 if(balanceErrors.length)alerts.push({severity:'critical',code:'PROVIDER_BALANCE',message:'Ralat menunjukkan baki atau kredit provider mungkin tidak mencukupi.',count:balanceErrors.length});
 if(uncertain.length)alerts.push({severity:'critical',code:'AMBIGUOUS_SUBMISSION',message:'Submission provider belum dapat dipastikan dan memerlukan rekonsiliasi task ID.',count:uncertain.length});
 if(recentFailures.length>=3||failureRate>=0.25&&recentProviderJobs.length>=4)alerts.push({severity:'warning',code:'UNUSUAL_FAILURE_RATE',message:'Kadar kegagalan Nexabot 24 jam lebih tinggi daripada biasa.',count:recentFailures.length});
 return{
  revenue:{confirmedMyr:confirmedRevenue,provisionalMyr:money(provisional.reduce((sum,order)=>sum+number(order.amount_myr),0)),provisionalOrders:provisional.length,payingCustomers:new Set(confirmed.map(order=>order.workspace_id)).size,sales},
  costs:{actualNexabotGenerationVolume:completedNexabot.length,estimatedNexabotCostMyr:estimatedProviderCostMyr,observedProviderCredits,providerCostBasis:'ESTIMATED_FROM_MODEL_376_JOB_RECORDS',storageTrackedBytes:storageBytes,storageEstimatedCostMyr:storageCost,storageCostBasis:storageRate>0?`CONFIGURED_RM_${storageRate}_PER_GB_MONTH`:'UNCONFIGURED_RATE',fixedOperatingCostMyr:operatingCost,operatingCostBasis:operatingCost>0?'CONFIGURED_ESTIMATE':'UNCONFIGURED'},
  liabilities:{affiliateCommissionMyr:affiliateLiability,outstandingCredits,estimatedCreditLiabilityMyr:estimatedCreditLiability},
  margin:{estimatedContributionMyr:money(confirmedRevenue-estimatedProviderCostMyr-storageCost-operatingCost-affiliateLiability),basis:'ESTIMATE_NOT_SETTLED_CASH',safeToWithdrawMyr:0},
  queue:{maxActive:3,active:input.jobs.filter(job=>job.provider==='nexabot'&&job.status==='PROCESSING').length,dispatching:input.jobs.filter(job=>job.provider==='nexabot'&&job.status==='SUBMITTING').length,queued:input.jobs.filter(job=>job.provider==='nexabot'&&job.status==='QUEUED').length,stuck:stuck.length,recentFailures:recentFailures.length,failureRate24h:Math.round(failureRate*1000)/10,alerts},
 };
}

function database(){if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)throw new Error('Pangkalan data production tidak tersedia.');const key=process.env.SUPABASE_SERVICE_ROLE_KEY;return{base:process.env.SUPABASE_URL.replace(/\/$/,''),headers:{apikey:key,Authorization:`Bearer ${key}`}};}
async function rows<T>(path:string):Promise<T[]>{const{base,headers}=database();const response=await fetch(`${base}/rest/v1/${path}`,{headers,cache:'no-store'});if(!response.ok)throw new Error(`Metrik operasi tidak tersedia (${response.status}).`);return response.json() as Promise<T[]>;}

export async function getCommercialOperationsMetrics(){
 const[orders,wallets,commissions,jobs,costs,products,backgrounds]=await Promise.all([
  rows<OrderRow>('orders?select=id,workspace_id,plan_id,amount_myr,status,payment_state,metadata&limit=5000'),rows<WalletRow>('credit_wallets?select=balance&limit=5000'),rows<CommissionRow>('affiliate_commissions?select=amount_myr,status&limit=5000'),rows<JobRow>('video_jobs?select=id,status,provider,provider_model_id,created_at,updated_at,error_message,submission_uncertain,output_size_bytes&limit=10000'),rows<CostRow>('provider_job_costs?select=job_id,estimated_myr_cost,observed_provider_credits,cost_status&limit=10000'),rows<SizedRow>('product_images?select=size_bytes&limit=10000'),rows<SizedRow>('background_assets?select=size_bytes&limit=10000'),
 ]);
 return summarizeCommercialOperations({orders,wallets,commissions,jobs,costs,products,backgrounds,storageCostPerGbMyr:Number(process.env.STORAGE_COST_PER_GB_MYR||0),fixedOperatingCostMyr:Number(process.env.FIXED_OPERATING_COST_MYR||0),creditReservePerVideoMyr:Number(process.env.CREDIT_RESERVE_PER_VIDEO_MYR||0.15)});
}
