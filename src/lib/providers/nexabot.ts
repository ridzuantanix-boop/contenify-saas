import {
  IProviderAdapter,
  NormalizedError,
  ProviderCapabilities,
  ProviderJobInput,
  ProviderOutputResult,
  ProviderStatusResult,
  ProviderSubmitResult,
} from './types';

export interface NexabotConfig {
  apiKey: string;
  baseUrl?: string;
}

export class NexabotAdapter implements IProviderAdapter {
  readonly name = 'nexabot' as const;
  private apiKey: string;
  private baseUrl: string;

  constructor(config: NexabotConfig) {
    this.apiKey = config.apiKey || process.env.NEXABOT_API_KEY || '';
    this.baseUrl = config.baseUrl || process.env.NEXABOT_BASE_URL || 'https://nexabot.id';
  }

  getCapabilities(): ProviderCapabilities {
    return {
      providerName: 'nexabot',
      supportedDurations: [10, 15], // 10s historical jobs; new Voice styles request verified i2v 15s.
      supportsSpokenBM: true, // Priority for native Malaysian Malay
      supportsProductResearch: true, // Provider interprets the uploaded reference image
      maxReferenceImages: 3, // i2v supports 1-3 images
      creditCostPerSecond: 0.01, // Observed 0.15 provider credit for the 15s i2v test; not a billing rate.
      supportsDirectCancellation: false,
      supportsWebhooks: false,
    };
  }

  validateInput(input: ProviderJobInput): { isValid: boolean; error?: string } {
    if (!this.apiKey) {
      return { isValid: false, error: 'Nexabot API key is not configured in server environment' };
    }
    if (input.durationSeconds !== 10 && input.durationSeconds !== 15) {
      return {
        isValid: false,
        error: `Nexabot i2v supports 15s new generation or 10s historical compatibility. Received: ${input.durationSeconds}s`,
      };
    }
    if (!input.prompt || input.prompt.trim().length === 0) {
      return { isValid: false, error: 'Prompt snapshot is required for Nexabot' };
    }
    return { isValid: true };
  }

  preparePayload(input: ProviderJobInput): Record<string, unknown> {
    const images: string[] = [];
    const maxReferenceImages = this.getCapabilities().maxReferenceImages;
    const isValidImage = (src?: string) =>
      src && (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:image/')) && !src.includes('mock');

    if (input.mainImageKeyOrUrl && !isValidImage(input.mainImageKeyOrUrl)) {
      throw new Error('Nexabot product reference image is invalid; generation was not submitted.');
    }
    if (isValidImage(input.mainImageKeyOrUrl)) {
      images.push(input.mainImageKeyOrUrl!);
    }
    const additionalReferences = input.referenceImageKeysOrUrls || [];
    if (additionalReferences.length > 0) {
      if (additionalReferences.length > maxReferenceImages - 1) {
        throw new Error('Nexabot accepts at most two personalization references after the product image.');
      }
      for (const img of additionalReferences) {
        if (!isValidImage(img)) throw new Error('Nexabot personalization reference image is invalid; no selected reference was silently omitted.');
      }
    }

    // A repeated ingredient/subject reference materially reduced start-frame copying
    // in a controlled real Nexabot i2v test. Use the spare slot to send the exact
    // product twice, while never dropping a customer-selected avatar/background.
    if (
      input.mainImageKeyOrUrl &&
      images.length + additionalReferences.length < maxReferenceImages &&
      !additionalReferences.includes(input.mainImageKeyOrUrl)
    ) {
      images.push(input.mainImageKeyOrUrl);
    }
    images.push(...additionalReferences);

    // Determine mode according to Nexabot spec:
    // "t2v" = Text to Video (no image)
    // "i2v" = Ingredient / Subject Reference Image to Video (1-3 product reference images)
    // "sfv" = Start Frame to Video (only when explicitly requested as mandatory starting frame)
    let mode = 't2v';
    if (images.length > 0) {
      mode = 'i2v';
    }

    // ratio: 1 = landscape, 2 = portrait (9:16)
    const ratio = input.aspectRatio === '9:16' ? 2 : 1;

    return {
      mode,
      prompt: input.prompt,
      telegram_id: 'web',
      media: images,
      ratio,
      resolution: 720,
      duration: input.durationSeconds,
      use_unlimited: false,
    };
  }

  async submit(input: ProviderJobInput): Promise<ProviderSubmitResult> {
    const validation = this.validateInput(input);
    if (!validation.isValid) {
      throw new Error(`Nexabot validation failed: ${validation.error}`);
    }

    const payload = this.preparePayload(input);
    const endpoint = `${this.baseUrl}/api/v1/api`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        'x-api-key': this.apiKey,
        'X-Idempotency-Key': input.idempotencyKey,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Nexabot submit failed (HTTP ${res.status}): ${text}`);
    }

    const data = await res.json() as Record<string, unknown>;
    if (!data.ok && data.error) {
      throw new Error(`Nexabot API error: ${data.error}`);
    }

    const taskId = String(data.id || data.job_id || data.task_id || '');
    if (!taskId) {
      throw new Error(`Nexabot response missing job id: ${JSON.stringify(data)}`);
    }

    return {
      providerTaskId: taskId,
      rawStatus: String(data.status || 'queued'),
      estimatedWaitSeconds: 60,
      metadata: data,
    };
  }

  async getStatus(providerTaskId: string): Promise<ProviderStatusResult> {
    const endpoint = `${this.baseUrl}/api/v1/jobs/${providerTaskId}`;
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Nexabot query failed (HTTP ${res.status}): ${text}`);
    }

    const data = await res.json() as Record<string, unknown>;
    const job = (data.job || data) as Record<string, unknown>;
    const rawStatus = String(job.status || data.status || 'unknown').toLowerCase();

    if (rawStatus === 'done' || rawStatus === 'completed' || rawStatus === 'succeeded') {
      return {
        providerTaskId,
        normalizedStatus: 'COMPLETED',
        progressPercent: 100,
        rawStatus,
      };
    }

    if (rawStatus === 'failed' || rawStatus === 'error') {
      const errorMsg = String(job.error || data.error || data.message || 'Generation failed on Nexabot');
      return {
        providerTaskId,
        normalizedStatus: 'FAILED',
        rawStatus,
        errorMessage: errorMsg,
        isRetryable: !errorMsg.includes('insufficient'),
      };
    }

    return {
      providerTaskId,
      normalizedStatus: rawStatus === 'processing' ? 'RUNNING' : 'PENDING',
      progressPercent: rawStatus === 'processing' ? 60 : 15,
      rawStatus,
    };
  }

  async getOutputs(providerTaskId: string): Promise<ProviderOutputResult> {
    const statusRes = await this.getStatus(providerTaskId);
    if (statusRes.normalizedStatus !== 'COMPLETED') {
      throw new Error(`Nexabot task ${providerTaskId} is not ready (status: ${statusRes.normalizedStatus})`);
    }

    const endpoint = `${this.baseUrl}/api/v1/jobs/${providerTaskId}`;
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'X-API-Key': this.apiKey,
      },
    });

    const data = await res.json() as Record<string, unknown>;
    const job = (data.job || data) as Record<string, unknown>;
    const videoUrl = String(job.storage_url || job.video_url || `${this.baseUrl}/api/v1/jobs/${providerTaskId}/download`);

    return {
      providerTaskId,
      videoUrl,
      thumbnailUrl: String(job.thumbnail_url || ''),
      durationSeconds: typeof job.duration_seconds === 'number' ? job.duration_seconds : typeof job.duration === 'number' ? job.duration : undefined,
      metadata: job,
    };
  }

  normalizeError(error: unknown): NormalizedError {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('401') || msg.includes('Unauthorized') || msg.includes('Invalid API key')) {
      return {
        isRetryable: false,
        category: 'AUTH',
        code: 'NEXABOT_AUTH_INVALID',
        message: 'Nexabot API key invalid or expired',
        wasBilled: false,
      };
    }
    if (msg.includes('credit') || msg.includes('insufficient')) {
      return {
        isRetryable: false,
        category: 'RATE_LIMIT',
        code: 'NEXABOT_CREDITS_EXHAUSTED',
        message: 'Nexabot credit balance exhausted',
        wasBilled: false,
      };
    }
    return {
      isRetryable: true,
      category: 'PROVIDER_INTERNAL',
      code: 'NEXABOT_ERROR',
      message: msg,
      wasBilled: false,
    };
  }
}
