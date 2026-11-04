import { NextRequest, NextResponse } from 'next/server';
import { OFFICIAL_GEMS_PRESETS } from '@/lib/gems/presets';
import { buildUniversalMasterprompt } from '@/lib/gems/prompt-builder';
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
      presetId = 'gem_real_affiliate',
      durationSeconds = 10,
      provider: requestedProvider,
      callToAction = 'spoken_button',
      isMuslimahModest = true,
      customPrompt,
      imageKeys = [],
    } = body;

    const workspaceId = 'ws_default';
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const idempotencyKey = `idem_${jobId}`;

    // 1. Find Preset
    const preset = OFFICIAL_GEMS_PRESETS.find(p => p.id === presetId);
    if (!preset) {
      return NextResponse.json({ error: `Preset '${presetId}' tidak ditemui.` }, { status: 400 });
    }

    // 2. Validate & Reserve Credits
    const providerAdapter = router.resolveProvider(durationSeconds as any, requestedProvider);
    const requiredCredits = router.calculateCreditCost(durationSeconds as any, providerAdapter.name);

    const reservation = creditManager.reserveCredits(workspaceId, jobId, requiredCredits, `res_${idempotencyKey}`);
    if (!reservation.success) {
      return NextResponse.json({ error: reservation.error }, { status: 402 });
    }

    // 3. Compile Universal Masterprompt
    const compiled = buildUniversalMasterprompt({
      preset,
      productName: productName || 'Produk Kualiti Tinggi',
      productCategory,
      productFacts,
      callToAction,
      isMuslimahModest,
      scriptBody: customPrompt,
    });

    // 4. Job State Transitions
    JobStateMachine.transition('DRAFT', 'VALIDATING', { jobId });
    JobStateMachine.transition('VALIDATING', 'QUEUED', { jobId });
    JobStateMachine.transition('QUEUED', 'SUBMITTING', { jobId });

    // 5. Submit to Provider Adapter
    const mainImage = imageKeys[0] || 'https://storage.contenify.mock/samples/default_product.jpg';
    const submitResult = await providerAdapter.submit({
      jobId,
      idempotencyKey,
      workspaceId,
      prompt: compiled.masterPrompt,
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
      status: 'SUBMITTED',
      reservedCredits: requiredCredits,
      estimatedWaitSeconds: submitResult.estimatedWaitSeconds || 45,
      compiledPrompt: compiled.masterPrompt,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ONLINE',
    version: '0.1.0',
    availablePresets: OFFICIAL_GEMS_PRESETS.map(p => ({ id: p.id, name: p.name, duration: p.targetDurationSeconds })),
  });
}
