import { NextRequest, NextResponse } from 'next/server';
import { getVideoStyle, getAllVideoStyles } from '@/lib/styles/registry';
import { AICreativeDirector } from '@/lib/engine/creative-director';
import { DynamicPromptCompiler } from '@/lib/engine/compiler';
import { ProviderRouter } from '@/lib/providers/router';
import { JobStateMachine } from '@/lib/orchestration/state-machine';
import { getSessionFromRequest } from '@/lib/auth/session';
import { DurableStore } from '@/lib/db/store';

export const runtime = 'edge';

const router = new ProviderRouter();

// Simple in-memory rate limiter per workspace (sliding window: max 10 requests / min)
const rateLimitMap: Map<string, number[]> = new Map();

function checkRateLimit(workspaceId: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxReqs = 10;

  const timestamps = (rateLimitMap.get(workspaceId) || []).filter((t) => now - t < windowMs);
  if (timestamps.length >= maxReqs) {
    return false;
  }
  timestamps.push(now);
  rateLimitMap.set(workspaceId, timestamps);
  return true;
}

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate Session
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json(
        { error: 'Sila log masuk untuk menghantar tugasan penjanaan video.' },
        { status: 401 }
      );
    }

    const workspaceId = session.workspaceId;
    const isSuperAdmin = session.role === 'superadmin';

    // 2. Apply Rate Limiting
    if (!checkRateLimit(workspaceId)) {
      return NextResponse.json(
        { error: 'Had permintaan tercapai (Maksimum 10 tugasan per minit). Sila tunggu sebentar.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const {
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

    // Disallow mock provider for normal users in production
    if (requestedProvider === 'mock' && !isSuperAdmin && process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'Pembekal Mock tidak dibenarkan dalam akaun produksi.' },
        { status: 403 }
      );
    }

    const targetStyleId = styleId || presetId || 'NX01';
    const style = getVideoStyle(targetStyleId);
    if (!style) {
      return NextResponse.json(
        { error: `Gaya video '${targetStyleId}' tidak ditemui dalam Video Style Registry.` },
        { status: 400 }
      );
    }

    // Provider resolution & compatibility check
    const durationSeconds = style.durationSeconds;
    const providerName = (requestedProvider || style.engine) as any;

    let providerAdapter;
    try {
      providerAdapter = router.resolveProvider(durationSeconds as any, providerName, isSuperAdmin);
    } catch (configErr: unknown) {
      const msg = configErr instanceof Error ? configErr.message : String(configErr);
      return NextResponse.json({ error: msg }, { status: 503 });
    }

    // 3. Extract Product Intelligence & Scene Plan via AI Creative Director
    const productProfile = AICreativeDirector.extractProductProfile({
      productName,
      productCategory,
      productFacts: Array.isArray(productFacts) ? productFacts.filter(Boolean) : [],
    });

    const scenePlan = AICreativeDirector.createScenePlan(productProfile, style, {
      modestyLock: isMuslimahModest,
    });

    // 4. Compile Provider-Specific Prompt with Deterministic Preflight & Script Validation
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

    // 5. Atomic, Transactional Credit Reservation
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const idempotencyKey = `idem_${jobId}`;
    const requiredCredits = router.calculateCreditCost(durationSeconds as any, providerAdapter.name);

    const reservation = await DurableStore.reserveCredits(
      workspaceId,
      jobId,
      requiredCredits,
      `res_${idempotencyKey}`
    );

    if (!reservation.success) {
      return NextResponse.json({ error: reservation.error }, { status: 402 });
    }

    // 6. Job State Transitions
    JobStateMachine.transition('DRAFT', 'VALIDATING', { jobId });
    JobStateMachine.transition('VALIDATING', 'QUEUED', { jobId });
    JobStateMachine.transition('QUEUED', 'SUBMITTING', { jobId });

    // 7. Dispatch to AI Provider Adapter
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
    } catch (submitErr: unknown) {
      // Release reserved credits immediately on upstream submission crash
      await DurableStore.releaseCredits(workspaceId, jobId, `rel_${idempotencyKey}`);
      throw submitErr;
    }

    // 8. Persist Job Record to Durable Store
    await DurableStore.saveJob({
      id: jobId,
      workspaceId,
      userId: session.userId,
      styleId: style.id,
      styleName: style.name,
      provider: providerAdapter.name,
      providerTaskId: submitResult.providerTaskId,
      durationSeconds,
      status: 'SUBMITTED',
      productName: productProfile.name,
      productCategory: productProfile.category,
      requiredCredits,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // 9. Build Customer-Safe Response (Do not expose internal prompt compilation to non-admins)
    const baseResponse: Record<string, unknown> = {
      success: true,
      jobId,
      providerTaskId: submitResult.providerTaskId,
      provider: providerAdapter.name,
      styleId: style.id,
      styleName: style.name,
      status: 'SUBMITTED',
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
  const provider = searchParams.get('provider') || 'nexabot';
  const listMode = searchParams.get('list');

  // Authenticate session for user-specific queries
  const session = await getSessionFromRequest(req);

  // 1. Polling a Specific Job Status
  if (providerTaskId || jobId) {
    if (!session) {
      return NextResponse.json(
        { error: 'Sila log masuk untuk menyemak status tugasan.' },
        { status: 401 }
      );
    }

    // Look up job in durable store
    const job = jobId
      ? await DurableStore.getJob(jobId)
      : await DurableStore.getJobByProviderTaskId(providerTaskId!);

    // Enforce Tenant Ownership: users can only view their own jobs
    if (job && job.workspaceId !== session.workspaceId && session.role !== 'superadmin') {
      return NextResponse.json(
        { error: 'Akses Ditolak: Anda tidak mempunyai kebenaran melihat tugasan akaun lain.' },
        { status: 403 }
      );
    }

    try {
      const activeTaskId = providerTaskId || job?.providerTaskId;
      if (!activeTaskId) {
        return NextResponse.json({ error: 'ID tugasan pembekal tidak ditemui.' }, { status: 404 });
      }

      const activeProvider = (job?.provider || provider) as any;
      const adapter = router.resolveProvider(10, activeProvider, session.role === 'superadmin');
      const statusRes = await adapter.getStatus(activeTaskId);

      let outputRes = null;
      if (statusRes.normalizedStatus === 'COMPLETED') {
        outputRes = await adapter.getOutputs(activeTaskId);

        // Transactional Credit Settlement when video output is verified
        if (job && outputRes?.videoUrl) {
          await DurableStore.settleCredits(
            job.workspaceId,
            job.id,
            job.requiredCredits,
            `stl_${job.id}`
          );
          await DurableStore.updateJobStatus(job.id, {
            status: 'COMPLETED',
            videoUrl: outputRes.videoUrl,
            rawStatus: statusRes.rawStatus,
          });
        }
      } else if (statusRes.normalizedStatus === 'FAILED') {
        // Release reserved credits on failure
        if (job) {
          await DurableStore.releaseCredits(job.workspaceId, job.id, `rel_${job.id}`);
          await DurableStore.updateJobStatus(job.id, {
            status: 'FAILED',
            errorMessage: statusRes.rawStatus || 'Tugasan gagal di pelayan AI.',
            rawStatus: statusRes.rawStatus,
          });
        }
      }

      return NextResponse.json({
        providerTaskId: activeTaskId,
        provider: activeProvider,
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

  // 2. Fetch User's Recent Production Queue / Jobs List
  if (listMode && session) {
    const jobs = await DurableStore.listJobs(session.workspaceId, 20);
    return NextResponse.json({ jobs });
  }

  // 3. Public Service & Video Styles Catalogue Metadata
  const styles = getAllVideoStyles();
  return NextResponse.json({
    status: 'ONLINE',
    brand: 'AffiMatik by Pawarna',
    tagline: 'Affiliate Jadi Automatik',
    version: '2.1.1',
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
