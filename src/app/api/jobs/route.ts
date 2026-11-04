import { NextRequest, NextResponse } from 'next/server';
import { getVideoStyle, getAllVideoStyles } from '@/lib/styles/registry';
import { AICreativeDirector } from '@/lib/engine/creative-director';
import { DynamicPromptCompiler } from '@/lib/engine/compiler';
import { ProviderRouter } from '@/lib/providers/router';
import { JobStateMachine } from '@/lib/orchestration/state-machine';
import { getSessionFromRequest } from '@/lib/auth/session';
import { DurableStore, PLAN_CONCURRENCY_LIMITS } from '@/lib/db/store';

export const runtime = 'edge';

const router = new ProviderRouter();

/**
 * Validates CSRF via Origin / Referer header for state-changing POST requests
 */
function isCsrfSafe(req: NextRequest): boolean {
  if (process.env.NODE_ENV === 'test') return true;
  const origin = req.headers.get('origin');
  const host = req.headers.get('host');
  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      return originHost === host;
    } catch {
      return false;
    }
  }
  return true;
}

export async function POST(req: NextRequest) {
  try {
    // 1. CSRF Protection
    if (!isCsrfSafe(req)) {
      return NextResponse.json({ error: 'Permintaan ditolak: Ralat pengesahan Origin CSRF.' }, { status: 403 });
    }

    // 2. Strict Authentication Requirement
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json(
        { error: 'Akses Ditolak: Anda mesti log masuk untuk menghantar tugasan penjanaan video.' },
        { status: 401 }
      );
    }

    const workspaceId = session.workspaceId;
    const isSuperAdmin = session.role === 'superadmin';

    const body = await req.json();
    const {
      clientRequestId,
      productName,
      productCategory = 'General',
      productFacts = [],
      styleId,
      presetId,
      provider: requestedProvider,
      callToAction = 'spoken_button',
      isMuslimahModest = true,
      customPrompt,
      imageKeys = [],
    } = body;

    // Mandate clientRequestId to prevent accidental non-idempotent job creation
    if (!clientRequestId || typeof clientRequestId !== 'string' || clientRequestId.trim().length === 0) {
      return NextResponse.json(
        { error: 'Permintaan tidak sah: clientRequestId (UUID unik) wajib disertakan untuk setiap penjanaan video.' },
        { status: 400 }
      );
    }

    // Disallow mock provider for non-admin accounts in production
    if (requestedProvider === 'mock' && !isSuperAdmin && process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'Pembekal Mock dilarang sama sekali dalam persekitaran produksi.' },
        { status: 403 }
      );
    }

    // 4. Video Style Verification
    const targetStyleId = styleId || presetId || 'NX01';
    const style = getVideoStyle(targetStyleId);
    if (!style) {
      return NextResponse.json(
        { error: `Gaya video '${targetStyleId}' tidak sah atau tiada dalam Video Style Registry.` },
        { status: 400 }
      );
    }

    if (style.publicationStatus !== 'published') {
      return NextResponse.json(
        { error: `Gaya video '${targetStyleId}' belum diterbitkan untuk kegunaan umum.` },
        { status: 400 }
      );
    }

    // 5. Provider Resolution & Explicit Configuration Check
    const durationSeconds = style.durationSeconds;
    const providerName = (requestedProvider || style.engine) as any;

    let providerAdapter;
    try {
      providerAdapter = router.resolveProvider(durationSeconds as any, providerName, isSuperAdmin);
    } catch (configErr: unknown) {
      const msg = configErr instanceof Error ? configErr.message : String(configErr);
      return NextResponse.json({ error: msg }, { status: 503 });
    }

    // 6. Product Profile & Prompt Compilation
    const productProfile = AICreativeDirector.extractProductProfile({
      productName,
      productCategory,
      productFacts: Array.isArray(productFacts) ? productFacts.filter(Boolean) : [],
    });

    const scenePlan = AICreativeDirector.createScenePlan(productProfile, style, {
      modestyLock: isMuslimahModest,
    });

    const compiled = DynamicPromptCompiler.compile(productProfile, style, scenePlan, {
      callToAction,
      isMuslimahModest,
      customScript: customPrompt,
    });

    if (!compiled.preflightValid) {
      return NextResponse.json(
        { error: `Preflight gagal: ${compiled.validationErrors.join(', ')}` },
        { status: 400 }
      );
    }

    // 7. Atomic, Database-Enforced Admission & Credit Reservation (Single Coordinated Transaction)
    const jobId = crypto.randomUUID();
    const requiredCredits = router.calculateCreditCost(durationSeconds as any, providerAdapter.name);
    const maxConcurrent = isSuperAdmin ? 999 : (PLAN_CONCURRENCY_LIMITS[session.tier] || 1);

    const admission = await DurableStore.admitJobAtomic({
      workspaceId,
      userId: session.userId,
      jobId,
      clientRequestId,
      styleId: style.id,
      styleName: style.name,
      presetVersion: 2,
      provider: providerAdapter.name,
      durationSeconds,
      requiredCredits,
      maxConcurrency: maxConcurrent,
      compiledPrompt: compiled.providerPrompt,
      productName: productProfile.name,
      productCategory: productProfile.category,
      inputOptions: {
        callToAction,
        isMuslimahModest,
        imageKeysCount: imageKeys.length,
      },
    });

    if (admission.isDuplicate) {
      return NextResponse.json({
        success: true,
        jobId: admission.jobId,
        providerTaskId: admission.providerTaskId || null,
        provider: providerAdapter.name,
        styleId: style.id,
        styleName: style.name,
        status: admission.status || 'PROCESSING',
        reservedCredits: admission.requiredCredits || requiredCredits,
        isDuplicateSubmission: true,
      });
    }

    if (!admission.success) {
      if (admission.concurrencyLimitReached) {
        return NextResponse.json({ error: admission.error }, { status: 429 });
      }
      if (admission.insufficientCredits) {
        return NextResponse.json({ error: admission.error }, { status: 402 });
      }
      return NextResponse.json({ error: admission.error || 'Ralat pendaftaran tugasan video.' }, { status: 400 });
    }

    // 8. Provider API Dispatch (Job is already durably recorded with SUBMITTING status)
    const idempotencyKey = `idem_${jobId}`;
    const mainImage = imageKeys.length > 0 ? imageKeys[0] : undefined;
    let submitResult;
    try {
      submitResult = await providerAdapter.submit({
        jobId,
        idempotencyKey,
        workspaceId,
        prompt: compiled.providerPrompt,
        durationSeconds: durationSeconds as any,
        aspectRatio: '9:16',
        mainImageKeyOrUrl: mainImage,
        referenceImageKeysOrUrls: imageKeys.slice(1),
      });

      // Immediately persist providerTaskId and transition status to PROCESSING
      await DurableStore.updateJobStatus(jobId, {
        providerTaskId: submitResult.providerTaskId,
        status: 'PROCESSING',
      });
    } catch (submitErr: unknown) {
      // Safe Rollback: release reserved credits immediately if provider dispatch fails
      await DurableStore.releaseCredits(workspaceId, jobId, `rel_${idempotencyKey}`);
      await DurableStore.updateJobStatus(jobId, {
        status: 'FAILED',
        errorMessage: submitErr instanceof Error ? submitErr.message : 'Kegagalan komunikasi pembekal AI.',
      });
      throw submitErr;
    }

    // 11. Customer-Safe Response
    const baseResponse: Record<string, unknown> = {
      success: true,
      jobId,
      providerTaskId: submitResult.providerTaskId,
      provider: providerAdapter.name,
      styleId: style.id,
      styleName: style.name,
      status: 'PROCESSING',
      reservedCredits: requiredCredits,
      estimatedWaitSeconds: submitResult.estimatedWaitSeconds || 45,
    };

    if (isSuperAdmin) {
      baseResponse.compiledPrompt = compiled.providerPrompt;
      baseResponse.spokenScript = compiled.spokenScript || null;
      baseResponse.audioDirective = compiled.audioDirective;
    }

    return NextResponse.json(baseResponse);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const providerTaskId = searchParams.get('providerTaskId');
  const jobId = searchParams.get('jobId');
  const listMode = searchParams.get('list');

  // Authenticate session
  const session = await getSessionFromRequest(req);

  // 1. Polling a Specific Job (Strict Ownership Verification)
  if (providerTaskId || jobId) {
    if (!session) {
      return NextResponse.json(
        { error: 'Akses Ditolak: Anda mesti log masuk untuk menyemak status tugasan.' },
        { status: 401 }
      );
    }

    // Strict Database Lookup: Task must exist in the database
    let job = null;
    if (jobId) {
      job = await DurableStore.getJob(jobId);
    } else if (providerTaskId) {
      job = await DurableStore.getJobByProviderTaskId(providerTaskId, session.workspaceId);
    }

    // If job does not exist in our system, return 404
    if (!job) {
      return NextResponse.json(
        { error: 'Tugasan video tidak ditemui dalam pangkalan data.' },
        { status: 404 }
      );
    }

    // Enforce Tenant Ownership: Reject cross-workspace inspection
    if (job.workspaceId !== session.workspaceId && session.role !== 'superadmin') {
      return NextResponse.json(
        { error: 'Akses Ditolak: Anda tidak mempunyai kebenaran melihat tugasan akaun lain.' },
        { status: 403 }
      );
    }

    try {
      const activeTaskId = job.providerTaskId;
      if (!activeTaskId) {
        return NextResponse.json({
          jobId: job.id,
          status: job.status,
          rawStatus: 'Menunggu dispatch pembekal...',
        });
      }

      // Query provider adapter using the validated job's providerTaskId
      const adapter = router.resolveProvider(10, job.provider, session.role === 'superadmin');
      const statusRes = await adapter.getStatus(activeTaskId);

      let outputRes = null;
      if (statusRes.normalizedStatus === 'COMPLETED') {
        outputRes = await adapter.getOutputs(activeTaskId);

        // Atomic settlement upon verified MP4 URL
        if (outputRes?.videoUrl && job.status !== 'COMPLETED') {
          const settleRes = await DurableStore.settleCredits(
            job.workspaceId,
            job.id,
            job.requiredCredits,
            `stl_${job.id}`
          );
          if (settleRes.success) {
            await DurableStore.updateJobStatus(job.id, {
              status: 'COMPLETED',
              videoUrl: outputRes.videoUrl,
              rawStatus: statusRes.rawStatus,
            });
          }
        }
      } else if (statusRes.normalizedStatus === 'FAILED') {
        if (job.status !== 'FAILED') {
          await DurableStore.releaseCredits(job.workspaceId, job.id, `rel_${job.id}`);
          await DurableStore.updateJobStatus(job.id, {
            status: 'FAILED',
            errorMessage: statusRes.rawStatus || 'Tugasan gagal di pelayan AI.',
            rawStatus: statusRes.rawStatus,
          });
        }
      }

      return NextResponse.json({
        jobId: job.id,
        providerTaskId: activeTaskId,
        provider: job.provider,
        status: statusRes.normalizedStatus,
        progress: statusRes.progressPercent,
        rawStatus: statusRes.rawStatus,
        output: outputRes,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  // 2. Fetch User's Recent Production Queue
  if (listMode && session) {
    const jobs = await DurableStore.listJobs(session.workspaceId, 20);
    return NextResponse.json({ jobs });
  }

  // 3. Public Service & Style Registry Catalogue Summary
  const styles = getAllVideoStyles();
  return NextResponse.json({
    status: 'ONLINE',
    brand: 'AffiMatik by Pawarna',
    tagline: 'Affiliate Jadi Automatik',
    version: '2.1.3',
    catalogueSummary: {
      totalStyles: styles.length,
      qualityVerified: styles.filter((s) => s.qualityStatus === 'quality_verified').length,
      promptValidated: styles.filter((s) => s.qualityStatus === 'prompt_validated').length,
    },
    availableStyles: styles.map((s) => ({
      id: s.id,
      name: s.name,
      benefit: s.benefit,
      category: s.category,
      duration: s.durationSeconds,
      engine: s.engine,
      audioMode: s.audioMode,
      qualityStatus: s.qualityStatus,
      previewVideoUrl: s.previewVideoUrl || null,
    })),
  });
}
