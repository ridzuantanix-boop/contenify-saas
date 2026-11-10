import { DurableStore, VideoJobRecord } from '@/lib/db/store';
import { ProviderRouter } from '@/lib/providers/router';
import { resolvePersistedProviderReferences } from './provider-retry';

const router = new ProviderRouter();
export const MAX_ACTIVE_NEXABOT_JOBS = 3;

export type DispatchFailureClass = 'AMBIGUOUS'|'TRANSIENT'|'TERMINAL';
export function classifyDispatchFailure(error: unknown): DispatchFailureClass {
  const message = error instanceof Error ? error.message : String(error || '');
  if (/HTTP (429|5\d\d)/i.test(message)) return 'TRANSIENT';
  if (/invalid api key|unauthori[sz]ed|insufficient credit|payment required|invalid (image|media|mime)|unsupported (mode|format)|moderation|policy violation|unsafe content|HTTP 400/i.test(message)) return 'TERMINAL';
  // A connection reset/timeout can occur after Nexabot accepted the body. It is
  // unsafe to submit a new paid generation without a provider task id.
  return 'AMBIGUOUS';
}

async function persistAcceptedTask(jobId: string, token: string, providerTaskId: string) {
  let last: unknown;
  for (let attempt=0;attempt<3;attempt++) {
    try {
      const result=await DurableStore.completeNexabotDispatch(jobId,token,providerTaskId);
      if(result.success)return result;
      last=new Error(String(result.error||'DISPATCH_PERSIST_FAILED'));
    } catch(error){last=error;}
    await new Promise(resolve=>setTimeout(resolve,150*(attempt+1)));
  }
  throw last instanceof Error?last:new Error('DISPATCH_PERSIST_FAILED');
}

export async function dispatchNexabotQueueCapacity(): Promise<{submitted:number;requeued:number;uncertain:number;finalized:number;claimed:number}> {
  const summary={submitted:0,requeued:0,uncertain:0,finalized:0,claimed:0};
  for(let slot=0;slot<MAX_ACTIVE_NEXABOT_JOBS;slot++){
    const claim=await DurableStore.claimNextNexabotJob(MAX_ACTIVE_NEXABOT_JOBS);
    if(!claim.claimed)break;
    summary.claimed++;
    const job=await DurableStore.getJob(String(claim.job_id));
    const token=String(claim.dispatch_token||'');
    if(!job||!token)break;
    try{
      if(!job.compiledPromptSnapshot)throw new Error('Stored provider prompt is unavailable for retry.');
      const {mainImage,references}=await resolvePersistedProviderReferences(job as VideoJobRecord);
      const adapter=router.resolveProvider(job.durationSeconds as 10|15,'nexabot',true);
      const started=await DurableStore.markNexabotSubmissionStarted(job.id,token);
      if(!started.success)throw new Error(String(started.error||'DISPATCH_CLAIM_LOST'));
      const accepted=await adapter.submit({jobId:job.id,workspaceId:job.workspaceId,idempotencyKey:`idem_${job.id}`,
        prompt:job.compiledPromptSnapshot,durationSeconds:job.durationSeconds as 10|15,aspectRatio:'9:16',
        mainImageKeyOrUrl:mainImage,referenceImageKeysOrUrls:references});
      try{await persistAcceptedTask(job.id,token,accepted.providerTaskId);summary.submitted++;}
      catch(error){await DurableStore.failNexabotDispatch(job.id,token,'AMBIGUOUS',`Accepted task ${accepted.providerTaskId}; persistence failed: ${error instanceof Error?error.message:String(error)}`);summary.uncertain++;}
    }catch(error){
      const failureClass=classifyDispatchFailure(error);
      const failed=await DurableStore.failNexabotDispatch(job.id,token,failureClass,error instanceof Error?error.message:String(error));
      if(failureClass==='TRANSIENT'&&failed.requeued)summary.requeued++;
      else if(failureClass==='AMBIGUOUS'&&failed.submission_uncertain)summary.uncertain++;
      else if(failed.finalize_required){
        await DurableStore.releaseCredits(job.workspaceId,job.id,`rel_dispatch_final_${job.id}`);
        await DurableStore.updateJobStatus(job.id,{status:'FAILED',errorMessage:'Nexabot tidak dapat menerima tugasan ini. Kredit telah dipulangkan sepenuhnya.',rawStatus:'DISPATCH_FINAL_FAILURE'});
        summary.finalized++;
      }
    }
  }
  return summary;
}
