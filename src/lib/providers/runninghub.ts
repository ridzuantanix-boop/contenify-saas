import {
  IProviderAdapter,
  NormalizedError,
  ProviderCapabilities,
  ProviderJobInput,
  ProviderOutputResult,
  ProviderStatusResult,
  ProviderSubmitResult,
} from './types';

export interface RunningHubConfig {
  apiKey: string;
  baseUrl?: string;
  webappId?: string;
}

export class RunningHubAdapter implements IProviderAdapter {
  readonly name = 'runninghub' as const;
  private apiKey: string;
  private baseUrl: string;
  private webappId: string;

  constructor(config: RunningHubConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || process.env.RUNNINGHUB_BASE_URL || 'https://www.runninghub.ai';
    this.webappId = config.webappId || process.env.RUNNINGHUB_WEBAPP_ID || '2103149871766220801';
  }

  getCapabilities(): ProviderCapabilities {
    return {
      providerName: 'runninghub',
      supportedDurations: [15],
      supportsSpokenBM: false, // AffiMatik Motion is visual-only, with ambient audio and no spoken dialogue.
      supportsProductResearch: false,
      maxReferenceImages: 4,
      creditCostPerSecond: 1.0,
      supportsDirectCancellation: false,
      supportsWebhooks: false,
    };
  }

  validateInput(input: ProviderJobInput): { isValid: boolean; error?: string } {
    if (!this.apiKey) {
      return { isValid: false, error: 'RunningHub API key is not configured in server environment' };
    }
    if (input.durationSeconds !== 15) {
      return {
        isValid: false,
        error: `RunningHub native adapter supports 15s duration only. Received: ${input.durationSeconds}s`,
      };
    }
    if (!input.mainImageKeyOrUrl) {
      return { isValid: false, error: 'Main image key or URL is required for RunningHub node 114' };
    }
    if (!input.prompt || input.prompt.trim().length === 0) {
      return { isValid: false, error: 'Prompt is required for RunningHub node 136' };
    }
    return { isValid: true };
  }

  preparePayload(input: ProviderJobInput): Record<string, unknown> {
    const mainImg = input.mainImageKeyOrUrl;
    const refs = input.referenceImageKeysOrUrls || [];
    const r1 = refs[0] || mainImg;
    const r2 = refs[1] || r1;
    const r3 = refs[2] || r1;
    const r4 = refs[3] || r1;

    const nodeInfoList = [
      { nodeId: '114', fieldName: 'image', fieldValue: mainImg, description: 'karakter utama' },
      { nodeId: '168', fieldName: 'image', fieldValue: r1, description: 'gambar 1' },
      { nodeId: '169', fieldName: 'image', fieldValue: r2, description: 'gambar 2' },
      { nodeId: '170', fieldName: 'image', fieldValue: r3, description: 'gambar 3' },
      { nodeId: '171', fieldName: 'image', fieldValue: r4, description: 'gambar 4' },
      { nodeId: '136', fieldName: 'text', fieldValue: input.prompt, description: 'teks' },
      { nodeId: '115', fieldName: 'aspect_ratio', fieldValue: input.aspectRatio === '9:16' ? '9:16 (Portrait Widescreen)' : input.aspectRatio, description: 'aspect_ratio' },
      { nodeId: '135', fieldName: 'value', fieldValue: String(input.durationSeconds), description: 'duration' },
    ];

    return {
      apiKey: this.apiKey,
      webappId: this.webappId,
      nodeInfoList,
      taskType: 'ASYNC',
      instanceType: 'plus',
      usePersonalQueue: 'false',
    };
  }

  async submit(input: ProviderJobInput): Promise<ProviderSubmitResult> {
    const validation = this.validateInput(input);
    if (!validation.isValid) {
      throw new Error(`RunningHub validation failed: ${validation.error}`);
    }

    const payload = this.preparePayload(input);
    const endpoint = `${this.baseUrl}/openapi/v2/run/ai-app/${this.webappId}`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`RunningHub HTTP error ${res.status}: ${text}`);
    }

    const data = await res.json() as Record<string, unknown>;
    const taskId = (data.taskId || (data.data as Record<string, unknown>)?.taskId) as string;

    if (!taskId) {
      throw new Error(`RunningHub failed to return taskId: ${JSON.stringify(data)}`);
    }

    return {
      providerTaskId: taskId,
      rawStatus: (data.status || 'SUBMITTED') as string,
      metadata: { webappId: this.webappId },
    };
  }

  async getStatus(providerTaskId: string): Promise<ProviderStatusResult> {
    const endpoint = `${this.baseUrl}/openapi/v2/query`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        apiKey: this.apiKey,
        taskId: providerTaskId,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`RunningHub query failed ${res.status}: ${text}`);
    }

    const data = await res.json() as Record<string, unknown>;
    const rawStatus = ((data.status || (data.data as Record<string, unknown>)?.status) as string) || 'UNKNOWN';

    if (rawStatus === 'SUCCESS' || rawStatus === 'COMPLETED') {
      return {
        providerTaskId,
        normalizedStatus: 'COMPLETED',
        progressPercent: 100,
        rawStatus,
      };
    }

    if (rawStatus === 'FAILED' || rawStatus === 'ERROR') {
      const errorMsg = (data.errorMessage || (data.data as Record<string, unknown>)?.errorMessage || 'Task failed on RunningHub') as string;
      return {
        providerTaskId,
        normalizedStatus: 'FAILED',
        rawStatus,
        errorMessage: errorMsg,
        isRetryable: !errorMsg.includes('insufficient balance'),
      };
    }

    return {
      providerTaskId,
      normalizedStatus: rawStatus === 'RUNNING' ? 'RUNNING' : 'PENDING',
      progressPercent: rawStatus === 'RUNNING' ? 50 : 10,
      rawStatus,
    };
  }

  async getOutputs(providerTaskId: string): Promise<ProviderOutputResult> {
    const statusRes = await this.getStatus(providerTaskId);
    if (statusRes.normalizedStatus !== 'COMPLETED') {
      throw new Error(`RunningHub task ${providerTaskId} is not completed (status: ${statusRes.normalizedStatus})`);
    }

    // Query for results payload
    const endpoint = `${this.baseUrl}/openapi/v2/query`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        apiKey: this.apiKey,
        taskId: providerTaskId,
      }),
    });

    const data = await res.json() as Record<string, unknown>;
    const results = ((data.results || (data.data as Record<string, unknown>)?.results) as Array<Record<string, unknown>>) || [];
    
    // Find valid mp4 file URL
    const videoItem = results.find(r => {
      const url = String(r.fileUrl || r.url || '');
      return url.toLowerCase().includes('.mp4') || r.outputType === 'mp4';
    }) || results[0];

    const videoUrl = String(videoItem?.fileUrl || videoItem?.url || '');
    if (!videoUrl || !videoUrl.startsWith('http')) {
      throw new Error(`RunningHub task ${providerTaskId} returned no valid video URL in output: ${JSON.stringify(results)}`);
    }

    return {
      providerTaskId,
      videoUrl,
      durationSeconds: 15,
      metadata: { resultsCount: results.length },
    };
  }

  normalizeError(error: unknown): NormalizedError {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('401') || msg.includes('API key') || msg.includes('Unauthorized')) {
      return {
        isRetryable: false,
        category: 'AUTH',
        code: 'RUNNINGHUB_AUTH_INVALID',
        message: 'RunningHub credentials invalid or expired',
        wasBilled: false,
      };
    }
    if (msg.includes('insufficient balance') || msg.includes('credits')) {
      return {
        isRetryable: false,
        category: 'RATE_LIMIT',
        code: 'RUNNINGHUB_BALANCE_EXHAUSTED',
        message: 'RunningHub account balance exhausted',
        wasBilled: false,
      };
    }
    if (msg.includes('timeout') || msg.includes('ETIMEDOUT') || msg.includes('ECONNRESET')) {
      return {
        isRetryable: true,
        category: 'NETWORK',
        code: 'RUNNINGHUB_NETWORK_TIMEOUT',
        message: 'Network timeout contacting RunningHub',
        wasBilled: false,
      };
    }
    return {
      isRetryable: true,
      category: 'PROVIDER_INTERNAL',
      code: 'RUNNINGHUB_EXECUTION_ERROR',
      message: msg,
      wasBilled: true,
    };
  }
}
