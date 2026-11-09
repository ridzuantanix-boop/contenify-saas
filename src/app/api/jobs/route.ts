import { NextRequest, NextResponse } from 'next/server';
import { publicProviderAvailability } from '@/lib/providers/public-availability';
import { getVideoStyle, getAllVideoStyles } from '@/lib/styles/registry';
import { DynamicPromptCompiler } from '@/lib/engine/compiler';
import { ProductProfile, ScenePlan } from '@/lib/engine/types';
import { ProviderRouter } from '@/lib/providers/router';
import { JobStateMachine } from '@/lib/orchestration/state-machine';
import { getSessionFromRequest } from '@/lib/auth/session';
import { DurableStore, PLAN_CONCURRENCY_LIMITS } from '@/lib/db/store';
import { privateImageDataUri, signPrivateAsset } from '@/lib/storage/supabase-assets';
import { persistCompletedVideo } from '@/lib/orchestration/persist-video';
import { getBuiltInScene, sanitizePersonalizationSettings } from '@/lib/personalization/config';
import { findOfficialAvatar, findOfficialBackground, officialAssetDataUri } from '@/lib/personalization/official-assets';
import { customerFailureMessage, describeCustomerFailure } from '@/lib/jobs/customer-failure';


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

    // 3. Emergency Generation Pause / Circuit Breaker Check
    const genSettings = await DurableStore.getSystemSettings('generation_status');
    if (genSettings?.paused && !isSuperAdmin) {
      return NextResponse.json(
        { error: genSettings.reason || 'Penjanaan video dijeda sementara bagi tujuan penyelenggaraan teknikal.' },
        { status: 503 }
      );
    }

    const body = await req.json();
    const {
      clientRequestId,
      productName,
      productCategory,
      productFacts = [],
      styleId,
      presetId,
      provider: requestedProvider,
      isMuslimahModest = true,
      creativeInstruction,
      customPrompt,
      imageKeys = [],
      imageAssetId,
      avatarId,
      backgroundId,
      builtInSceneId,
      niche,
      voicePersonality,
      storyboard,
      callToAction,
      scriptMode,
      customScript,
      customCta,
      productFact,
      creatorPresetId,
    } = body;

    // Mandate clientRequestId to prevent accidental non-idempotent job creation
    if (!clientRequestId || typeof clientRequestId !== 'string' || clientRequestId.trim().length === 0) {
      return NextResponse.json(
        { error: 'Permintaan tidak sah: clientRequestId (UUID unik) wajib disertakan untuk setiap penjanaan video.' },
        { status: 400 }
      );
    }

    if (!imageAssetId && (!Array.isArray(imageKeys) || imageKeys.length === 0 || typeof imageKeys[0] !== 'string' || imageKeys[0].trim().length === 0)) {
      return NextResponse.json(
        { error: 'Sila muat naik sekurang-kurangnya satu imej rujukan produk sebelum menjana video.' },
        { status: 400 }
      );
    }

    let savedImageUrl: string | undefined;
    if (imageAssetId) {
      if (typeof imageAssetId !== 'string' || !/^[0-9a-f-]{36}$/i.test(imageAssetId) || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return NextResponse.json({ error: 'Aset imej produk tidak sah.' }, { status: 400 });
      }
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const lookup = await fetch(`${process.env.SUPABASE_URL}/rest/v1/product_images?id=eq.${encodeURIComponent(imageAssetId)}&workspace_id=eq.${encodeURIComponent(workspaceId)}&select=r2_key,mime_type&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
      if (!lookup.ok) return NextResponse.json({ error: 'Pengesahan aset imej gagal.' }, { status: 503 });
      const rows = await lookup.json() as Array<{ r2_key: string; mime_type: string }>;
      if (!rows.length) return NextResponse.json({ error: 'Aset imej tidak ditemui dalam ruang kerja ini.' }, { status: 404 });
      savedImageUrl = requestedProvider === 'nexabot' || (!requestedProvider && (styleId || presetId || 'NX01').startsWith('NX'))
        ? await privateImageDataUri(rows[0].r2_key, rows[0].mime_type)
        : await signPrivateAsset(rows[0].r2_key);
    } else if (process.env.NODE_ENV === 'production' && !Boolean(process.env.VITEST)) {
      return NextResponse.json({ error: 'Simpan imej dalam Pustaka Produk sebelum menjana video.' }, { status: 400 });
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

    if (requestedProvider && requestedProvider !== style.engine && !(isSuperAdmin && requestedProvider === 'mock')) {
      return NextResponse.json({ error: 'Pembekal tidak sepadan dengan gaya yang dipilih.' }, { status: 400 });
    }

    const personalization = sanitizePersonalizationSettings({
      styleId: style.id, avatarId, backgroundId, builtInSceneId, niche, voicePersonality,
      storyboard, callToAction, scriptMode, customScript, customCta, productFact,
      isMuslimahModest, creativeInstruction,
    });
    if (avatarId && !personalization.avatarId) return NextResponse.json({ error: 'Avatar yang dipilih tidak sah.' }, { status: 400 });
    if (backgroundId && !personalization.backgroundId) return NextResponse.json({ error: 'Latar yang dipilih tidak sah.' }, { status: 400 });
    if (builtInSceneId && !getBuiltInScene(personalization.builtInSceneId)) return NextResponse.json({ error: 'Pilihan babak tidak sah.' }, { status: 400 });
    if (personalization.avatarId && (style.category === 'hand_demo' || style.category === 'product_handling' || style.category === 'pov' || style.id.startsWith('RH'))) {
      return NextResponse.json({ error: 'Gaya tangan/produk ini tidak menggunakan avatar presenter. Pilih Auto Presenter atau gaya presenter.' }, { status: 400 });
    }

    let verifiedCreatorPresetId: string | null = null;
    if (creatorPresetId) {
      if (typeof creatorPresetId !== 'string' || !/^[0-9a-f-]{36}$/i.test(creatorPresetId) || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return NextResponse.json({ error: 'Preset pencipta tidak sah.' }, { status: 400 });
      }
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/creator_presets?id=eq.${encodeURIComponent(creatorPresetId)}&workspace_id=eq.${encodeURIComponent(workspaceId)}&select=id&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
      if (!response.ok) return NextResponse.json({ error: 'Pengesahan preset gagal.' }, { status: 503 });
      const rows = await response.json() as Array<{ id: string }>;
      if (!rows.length) return NextResponse.json({ error: 'Preset tidak ditemui dalam ruang kerja ini.' }, { status: 404 });
      verifiedCreatorPresetId = rows[0].id;
    }

    let avatarReference: { id: string; name: string; source: string } | null = null;
    let backgroundReference: { id: string; name: string; source: string } | null = null;
    if (personalization.avatarId) {
      const official = findOfficialAvatar(personalization.avatarId);
      if (official) {
        avatarReference = {
          id: official.id,
          name: official.name,
          source: style.engine === 'nexabot' ? await officialAssetDataUri(req, official.referenceUrl) : new URL(official.referenceUrl, req.url).toString(),
        };
      } else {
        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: 'Pengesahan avatar tidak tersedia.' }, { status: 503 });
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/avatars?id=eq.${encodeURIComponent(personalization.avatarId)}&workspace_id=eq.${encodeURIComponent(workspaceId)}&consent_confirmed=eq.true&select=id,name,image_r2_key&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
        if (!response.ok) return NextResponse.json({ error: 'Pengesahan avatar gagal.' }, { status: 503 });
        const rows = await response.json() as Array<{ id: string; name: string; image_r2_key: string }>;
        if (!rows.length) return NextResponse.json({ error: 'Avatar tidak ditemui atau keizinan tidak disahkan.' }, { status: 404 });
        const mime = rows[0].image_r2_key.endsWith('.png') ? 'image/png' : rows[0].image_r2_key.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
        avatarReference = { id: rows[0].id, name: rows[0].name, source: style.engine === 'nexabot' ? await privateImageDataUri(rows[0].image_r2_key, mime) : await signPrivateAsset(rows[0].image_r2_key) };
      }
    }
    if (personalization.backgroundId) {
      const official = findOfficialBackground(personalization.backgroundId);
      if (official) {
        backgroundReference = {
          id: official.id,
          name: official.name,
          source: style.engine === 'nexabot' ? await officialAssetDataUri(req, official.referenceUrl) : new URL(official.referenceUrl, req.url).toString(),
        };
      } else {
        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: 'Pengesahan latar tidak tersedia.' }, { status: 503 });
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/background_assets?id=eq.${encodeURIComponent(personalization.backgroundId)}&workspace_id=eq.${encodeURIComponent(workspaceId)}&select=id,name,image_r2_key,mime_type&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
        if (!response.ok) return NextResponse.json({ error: 'Pengesahan latar gagal.' }, { status: 503 });
        const rows = await response.json() as Array<{ id: string; name: string; image_r2_key: string; mime_type: string }>;
        if (!rows.length) return NextResponse.json({ error: 'Latar tidak ditemui dalam ruang kerja ini.' }, { status: 404 });
        backgroundReference = { id: rows[0].id, name: rows[0].name, source: style.engine === 'nexabot' ? await privateImageDataUri(rows[0].image_r2_key, rows[0].mime_type) : await signPrivateAsset(rows[0].image_r2_key) };
      }
    }

    if (process.env.NODE_ENV === 'production' && !isSuperAdmin && !publicProviderAvailability()[style.engine]) {
      return NextResponse.json(
        { error: `${style.engine === 'nexabot' ? 'AffiMatik Voice' : 'AffiMatik Motion'} belum diaktifkan untuk pelanggan. Tiada kredit ditolak.` },
        { status: 503 }
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

    // 6. Image-first profile and prompt compilation. No Gemini/Vision call,
    // internal product research or generated script is used here. Optional
    // user notes are forwarded as context only; the provider interprets the
    // actual product and creates dialogue/scene details.
    const legacyFacts = Array.isArray(productFacts)
      ? productFacts.filter((fact): fact is string => typeof fact === 'string' && fact.trim().length > 0).map((fact) => fact.trim())
      : [];
    const userFacts = [personalization.productFact, ...legacyFacts].filter(Boolean).slice(0, 1);
    const productProfile: ProductProfile = {
      name: typeof productName === 'string' && productName.trim() ? productName.trim() : 'the uploaded product image',
      category: typeof productCategory === 'string' && productCategory.trim() ? productCategory.trim() : personalization.niche !== 'auto' ? personalization.niche : 'the product shown in the reference image',
      packagingFormat: 'general',
      spokenShortName: 'produk ini',
      coreFunction: 'the actual purpose supported by the uploaded image and optional user notes only',
      usageContext: 'a cautious, ordinary context inferred from the uploaded image',
      buyerProblem: 'a relevant buyer problem grounded in the product image; if unclear, use cautious wording',
      allowedQaQuestion: 'what this product is actually for, only when supported by visible evidence',
      confirmedFeatures: userFacts,
      verifiedBenefits: userFacts,
      verifiedFacts: userFacts,
      unknownFields: ['ingredients', 'certifications', 'medical outcomes', 'personal-use results', 'prices', 'testimonials'],
      prohibitedClaims: ['invented ingredients', 'unverified certifications', 'medical outcomes', 'personal-use claims', 'prices', 'testimonials'],
      sourceConfidence: userFacts.length > 0 ? 'verified_user' : 'manual_fallback',
      provenance: 'manual_user_entry',
      isVisionSupported: false,
    };

    const scenePlan: ScenePlan = {
      mainSubject: productProfile.name,
      location: 'an ordinary, bright Malaysian setting chosen by the provider from the reference image',
      lighting: style.actionPlan.lightingSpec,
      cameraDistance: style.cameraProfile,
      cameraMovement: style.actionPlan.cameraMovement,
      startPose: style.actionPlan.startPose,
      actionProgression: style.actionPlan.actionProgression,
      endPose: style.actionPlan.endPose,
      primaryAction: style.actionPlan.primaryAction,
      audioPolicy: style.audioMode,
      targetDurationSeconds: style.durationSeconds,
    };

    let resolvedCreativeInstruction: string | undefined = undefined;
    if (typeof creativeInstruction === 'string' && creativeInstruction.trim().length > 0) {
      resolvedCreativeInstruction = creativeInstruction.trim();
    } else if (style.engine === 'runninghub' && typeof customPrompt === 'string' && customPrompt.trim().length > 0) {
      resolvedCreativeInstruction = customPrompt.trim();
    }

    const compiled = DynamicPromptCompiler.compile(productProfile, style, scenePlan, {
      isMuslimahModest,
      creativeInstruction: resolvedCreativeInstruction,
      callToAction: personalization.callToAction,
      scriptMode: personalization.scriptMode,
      customScript: personalization.customScript,
      customCta: personalization.customCta,
      avatarName: avatarReference?.name,
      backgroundName: backgroundReference?.name,
      builtInSceneId: personalization.builtInSceneId || undefined,
      niche: personalization.niche,
      voicePersonality: personalization.voicePersonality,
      storyboard: personalization.storyboard,
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
        isMuslimahModest,
        imageKeysCount: imageKeys.length,
        imageAssetId: typeof imageAssetId === 'string' ? imageAssetId : null,
        avatarId: avatarReference?.id || null,
        avatarName: avatarReference?.name || null,
        avatarAssetSource: avatarReference ? (findOfficialAvatar(avatarReference.id) ? 'official' : 'custom') : null,
        avatarAssetVersion: avatarReference && findOfficialAvatar(avatarReference.id) ? findOfficialAvatar(avatarReference.id)?.version : null,
        backgroundId: backgroundReference?.id || null,
        backgroundName: backgroundReference?.name || null,
        backgroundAssetSource: backgroundReference ? (findOfficialBackground(backgroundReference.id) ? 'official' : 'custom') : null,
        backgroundAssetVersion: backgroundReference && findOfficialBackground(backgroundReference.id) ? findOfficialBackground(backgroundReference.id)?.version : null,
        builtInSceneId: personalization.builtInSceneId,
        niche: personalization.niche,
        voicePersonality: personalization.voicePersonality,
        storyboard: personalization.storyboard,
        callToAction: personalization.callToAction,
        scriptMode: personalization.scriptMode,
        customScript: personalization.scriptMode === 'custom' ? personalization.customScript : null,
        customCta: personalization.callToAction === 'custom' ? personalization.customCta : null,
        productFact: personalization.productFact || null,
        creatorPresetId: verifiedCreatorPresetId,
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
    const mainImage = savedImageUrl || String(imageKeys[0]);
    const personalizationReferences = [avatarReference?.source, backgroundReference?.source].filter((value): value is string => Boolean(value));
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
        referenceImageKeysOrUrls: personalizationReferences.length > 0 ? personalizationReferences : imageKeys.slice(1, 3),
      });

      // Immediately persist providerTaskId and transition status to PROCESSING
      await DurableStore.updateJobStatus(jobId, {
        providerTaskId: submitResult.providerTaskId,
        status: 'PROCESSING',
      });
    } catch (submitErr: unknown) {
      // Safe Rollback: release reserved credits immediately if provider dispatch fails
      await DurableStore.releaseCredits(workspaceId, jobId, `rel_${idempotencyKey}`);
      const technicalDetail = submitErr instanceof Error ? submitErr.message : String(submitErr);
      const failure = describeCustomerFailure(submitErr);
      await DurableStore.updateJobStatus(jobId, {
        status: 'FAILED',
        errorMessage: customerFailureMessage(submitErr),
        rawStatus: technicalDetail.slice(0, 1000),
      });
      console.error(`[AffiMatik provider dispatch] job=${jobId} provider=${providerAdapter.name} category=${failure.category}: ${technicalDetail.slice(0, 1000)}`);
      return NextResponse.json({
        error: `${failure.headline}. ${failure.message} ${failure.creditNotice} ${failure.retryGuidance}`,
        failure,
        creditRestored: true,
        jobId,
      }, { status: 503 });
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

    if (job.status === 'COMPLETED' && job.videoObjectKey) {
      return NextResponse.json({ jobId: job.id, provider: job.provider, status: 'COMPLETED', output: { videoUrl: `/api/videos/${job.id}/stream` } });
    }
    if (job.status === 'QA_PENDING' || job.status === 'REJECTED' || job.status === 'FAILED') {
      const failure = job.status === 'FAILED' ? describeCustomerFailure(job.errorMessage) : undefined;
      return NextResponse.json({
        jobId: job.id,
        provider: job.provider,
        status: job.status,
        error: job.errorMessage || undefined,
        failure,
        creditRestored: job.status === 'FAILED',
      });
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
      const adapter = router.resolveProvider(job.durationSeconds as 10 | 15, job.provider, session.role === 'superadmin');
      const statusRes = await adapter.getStatus(activeTaskId);

      let outputRes = null;
      if (statusRes.normalizedStatus === 'COMPLETED') {
        outputRes = await adapter.getOutputs(activeTaskId);

        if (outputRes?.videoUrl && (job.status !== 'COMPLETED' || !job.videoObjectKey)) {
          const persisted = await persistCompletedVideo(job, outputRes.videoUrl, statusRes.rawStatus);
          if (!persisted) {
            const latest = await DurableStore.getJob(job.id);
            if (latest?.status === 'FAILED') {
              return NextResponse.json({ jobId: job.id, provider: job.provider, status: 'FAILED', error: latest.errorMessage });
            }
            throw new Error('Penyelesaian kredit belum berjaya. Tugasan akan dicuba semula.');
          }
          if (job.provider !== 'mock' && process.env.NODE_ENV === 'production' && !process.env.VITEST) {
            outputRes = { ...outputRes, videoUrl: `/api/videos/${job.id}/stream` };
          }
        }
      } else if (statusRes.normalizedStatus === 'FAILED') {
        const failure = describeCustomerFailure(statusRes.errorMessage || statusRes.rawStatus);
        await DurableStore.releaseCredits(job.workspaceId, job.id, `rel_${job.id}`);
        await DurableStore.updateJobStatus(job.id, {
          status: 'FAILED',
          errorMessage: customerFailureMessage(statusRes.errorMessage || statusRes.rawStatus),
          rawStatus: `${statusRes.rawStatus}${statusRes.errorMessage ? `: ${statusRes.errorMessage}` : ''}`.slice(0, 1000),
        });
        return NextResponse.json({
          jobId: job.id,
          providerTaskId: activeTaskId,
          provider: job.provider,
          status: 'FAILED',
          rawStatus: statusRes.rawStatus,
          error: `${failure.headline}. ${failure.message}`,
          failure,
          creditRestored: true,
        });
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
    version: '3.0.0',
    buildCommit: process.env.CF_PAGES_COMMIT_SHA || 'ab4cdaf',
    catalogueSummary: {
      totalStyles: styles.length,
      qualityVerified: styles.filter((s) => s.qualityStatus === 'quality_verified').length,
      promptValidated: styles.filter((s) => s.qualityStatus === 'prompt_validated').length,
      videoTested: styles.filter((s) => s.qualityStatus === 'video_tested').length,
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
