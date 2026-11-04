import { NextRequest, NextResponse } from 'next/server';
import { getVideoStyle, getAllVideoStyles } from '@/lib/styles/registry';
import { AICreativeDirector } from '@/lib/engine/creative-director';
import { DynamicPromptCompiler } from '@/lib/engine/compiler';
import { ProviderRouter } from '@/lib/providers/router';
import { JobStateMachine } from '@/lib/orchestration/state-machine';
import { CreditManager } from '@/lib/orchestration/credit-manager';

export const runtime = 'edge';

// In-memory runtime instances for Milestone 0 harness
const creditManager = new CreditManager([{ workspaceId: 'ws_default', balance: 10, reservedBalance: 0 }]);
const router = new ProviderRouter();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      productName,
      productCategory = 'General',
      productFacts = [],
      styleId,
      presetId, // backward compatibility
      provider: requestedProvider,
      callToAction = 'spoken_button',
      isMuslimahModest = true,
      customPrompt,
      imageKeys = [],
    } = body;

    const workspaceId = 'ws_default';
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const idempotencyKey = `idem_${jobId}`;

    // 1. Find Video Style (supports both styleId and legacy presetId)
    const targetStyleId = styleId || presetId || 'NX01';
    const style = getVideoStyle(targetStyleId);
    if (!style) {
      return NextResponse.json({ error: `Gaya video '${targetStyleId}' tidak ditemui dalam Video Style Registry.` }, { status: 400 });
    }

    // 2. Extract Product Intelligence & Scene Plan via AI Creative Director
    const productProfile = AICreativeDirector.extractProductProfile({
      productName,
      productCategory,
      productFacts: Array.isArray(productFacts) ? productFacts.filter(Boolean) : [],
    });

    const scenePlan = AICreativeDirector.createScenePlan(productProfile, style, {
      modestyLock: isMuslimahModest,
    });

    // 3. Compile Provider-Specific Prompt with Deterministic Preflight
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

    // 4. Validate & Reserve Credits
    const durationSeconds = style.durationSeconds;
    const providerAdapter = router.resolveProvider(durationSeconds as any, requestedProvider || style.engine);
    const requiredCredits = router.calculateCreditCost(durationSeconds as any, providerAdapter.name);

    const reservation = creditManager.reserveCredits(workspaceId, jobId, requiredCredits, `res_${idempotencyKey}`);
    if (!reservation.success) {
      return NextResponse.json({ error: reservation.error }, { status: 402 });
    }

    // 5. Job State Transitions
    JobStateMachine.transition('DRAFT', 'VALIDATING', { jobId });
    JobStateMachine.transition('VALIDATING', 'QUEUED', { jobId });
    JobStateMachine.transition('QUEUED', 'SUBMITTING', { jobId });

    // 6. Submit to Provider Adapter
    const mainImage = imageKeys.length > 0 ? imageKeys[0] : undefined;
    const submitResult = await providerAdapter.submit({
      jobId,
      idempotencyKey,
      workspaceId,
      prompt: compiled.providerPrompt,
      durationSeconds: durationSeconds as any,
      aspectRatio: '9:16',
      mainImageKeyOrUrl: mainImage,
      referenceImageKeysOrUrls: imageKeys.slice(1),
    });

    return NextResponse.json({
      success: true,
      jobId,
      providerTaskId: submitResult.providerTaskId,
      provider: providerAdapter.name,
      styleId: style.id,
      styleName: style.name,
      status: 'SUBMITTED',
      reservedCredits: requiredCredits,
      estimatedWaitSeconds: submitResult.estimatedWaitSeconds || 45,
      compiledPrompt: compiled.providerPrompt,
      spokenScript: compiled.spokenScript || null,
      audioDirective: compiled.audioDirective,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const providerTaskId = searchParams.get('providerTaskId');
  const provider = searchParams.get('provider') || 'nexabot';

  if (providerTaskId) {
    try {
      const adapter = router.resolveProvider(10, provider as any);
      const statusRes = await adapter.getStatus(providerTaskId);
      let outputRes = null;
      if (statusRes.normalizedStatus === 'COMPLETED') {
        outputRes = await adapter.getOutputs(providerTaskId);
      }
      return NextResponse.json({
        providerTaskId,
        provider,
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

  return NextResponse.json({
    status: 'ONLINE',
    brand: 'AffiMatik by Pawarna',
    tagline: 'Affiliate Jadi Automatik',
    version: '2.0.0',
    availableStyles: getAllVideoStyles().map((s) => ({
      id: s.id,
      name: s.name,
      benefit: s.benefit,
      category: s.category,
      duration: s.durationSeconds,
      engine: s.engine,
      audioMode: s.audioMode,
      qualityStatus: s.qualityStatus,
    })),
  });
}
