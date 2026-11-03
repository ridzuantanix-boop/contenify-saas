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
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || process.env.NEXABOT_BASE_URL || 'https://api.nexabot.ai/v1';
  }

  getCapabilities(): ProviderCapabilities {
    return {
      providerName: 'nexabot',
      supportedDurations: [10],
      supportsSpokenBM: true, // Priority for native Malaysian Malay
      supportsProductResearch: true, // Vendor does internal product research
      maxReferenceImages: 5,
      creditCostPerSecond: 1.2,
      supportsDirectCancellation: true,
      supportsWebhooks: true,
    };
  }

  validateInput(input: ProviderJobInput): { isValid: boolean; error?: string } {
    if (!this.apiKey) {
      return { isValid: false, error: 'Nexabot API key is not configured in server environment' };
    }
    if (input.durationSeconds !== 10) {
      return {
        isValid: false,
        error: `Nexabot adapter is prioritized for 10s duration. Received: ${input.durationSeconds}s`,
      };
    }
    if (!input.mainImageKeyOrUrl) {
      return { isValid: false, error: 'Product image reference is required for Nexabot product research' };
    }
    if (!input.prompt || input.prompt.trim().length === 0) {
      return { isValid: false, error: 'Universal prompt snapshot is required for Nexabot' };
    }
    return { isValid: true };
  }

  preparePayload(input: ProviderJobInput): Record<string, unknown> {
    const images = [input.mainImageKeyOrUrl];
    if (input.referenceImageKeysOrUrls) {
      images.push(...input.referenceImageKeysOrUrls);
    }
    if (input.avatarImageKeyOrUrl) {
      images.push(input.avatarImageKeyOrUrl);
    }

    return {
      prompt: input.prompt,
      duration: 10,
      aspect_ratio: input.aspectRatio,
      language: 'ms-MY',
      dialect: 'standard_malaysian_malay',
      reference_images: images,
      idempotency_key: input.idempotencyKey,
      metadata: {
        workspace_id: input.workspaceId,
        job_id: input.jobId,
        voice_style: input.voiceStyle || 'standard',
      },
    };
  }

  async submit(input: ProviderJobInput): Promise<ProviderSubmitResult> {
    const validation = this.validateInput(input);
    if (!validation.isValid) {
      throw new Error(`Nexabot validation failed: ${validation.error}`);
    }

    const payload = this.preparePayload(input);
    const endpoint = `${this.baseUrl}/videos/generate`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        'X-Idempotency-Key': input.idempotencyKey,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Nexabot submit failed (HTTP ${res.status}): ${text}`);
    }

    const data = await res.json() as Record<string, unknown>;
    const taskId = String(data.id || data.task_id || data.job_id || '');

    if (!taskId) {
      throw new Error(`Nexabot response missing task id: ${JSON.stringify(data)}`);
    }

    return {
      providerTaskId: taskId,
      rawStatus: String(data.status || 'queued'),
      estimatedWaitSeconds: Number(data.estimated_duration || 45),
      metadata: data,
    };
  }

  async getStatus(providerTaskId: string): Promise<ProviderStatusResult> {
    const endpoint = `${this.baseUrl}/videos/${providerTaskId}`;
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
    const rawStatus = String(data.status || 'unknown').toLowerCase();

    if (rawStatus === 'succeeded' || rawStatus === 'completed' || rawStatus === 'done') {
      return {
        providerTaskId,
        normalizedStatus: 'COMPLETED',
        progressPercent: 100,
        rawStatus,
      };
    }

    if (rawStatus === 'failed' || rawStatus === 'error' || rawStatus === 'failed_moderation') {
      const errorMsg = String(data.error || data.message || 'Generation failed on Nexabot');
      return {
        providerTaskId,
        normalizedStatus: 'FAILED',
        rawStatus,
        errorMessage: errorMsg,
        isRetryable: rawStatus !== 'failed_moderation' && !errorMsg.includes('moderation'),
      };
    }

    return {
      providerTaskId,
      normalizedStatus: rawStatus === 'processing' ? 'RUNNING' : 'PENDING',
      progressPercent: Number(data.progress || (rawStatus === 'processing' ? 60 : 15)),
      rawStatus,
    };
  }

  async getOutputs(providerTaskId: string): Promise<ProviderOutputResult> {
    const statusRes = await this.getStatus(providerTaskId);
    if (statusRes.normalizedStatus !== 'COMPLETED') {
      throw new Error(`Nexabot task ${providerTaskId} is not ready (status: ${statusRes.normalizedStatus})`);
    }

    const endpoint = `${this.baseUrl}/videos/${providerTaskId}`;
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    const data = await res.json() as Record<string, unknown>;
    const videoUrl = String(data.video_url || data.output_url || (data.result as Record<string, unknown>)?.video_url || '');

    if (!videoUrl || !videoUrl.startsWith('http')) {
      throw new Error(`Nexabot task ${providerTaskId} returned no valid video URL: ${JSON.stringify(data)}`);
    }

    return {
      providerTaskId,
      videoUrl,
      thumbnailUrl: String(data.thumbnail_url || ''),
      durationSeconds: 10,
      metadata: data,
    };
  }

  async cancel(providerTaskId: string): Promise<{ success: boolean; message?: string }> {
    const endpoint = `${this.baseUrl}/videos/${providerTaskId}/cancel`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    if (!res.ok) {
      return { success: false, message: `Cancel failed with HTTP ${res.status}` };
    }
    return { success: true };
  }

  normalizeError(error: unknown): NormalizedError {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('401') || msg.includes('Unauthorized')) {
      return {
        isRetryable: false,
        category: 'AUTH',
        code: 'NEXABOT_AUTH_INVALID',
        message: 'Nexabot API key invalid',
        wasBilled: false,
      };
    }
    if (msg.includes('429') || msg.includes('rate limit')) {
      return {
        isRetryable: true,
        category: 'RATE_LIMIT',
        code: 'NEXABOT_RATE_LIMIT',
        message: 'Nexabot upstream concurrency rate limit exceeded',
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
