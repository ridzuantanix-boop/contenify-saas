import {
  IProviderAdapter,
  NormalizedError,
  ProviderCapabilities,
  ProviderJobInput,
  ProviderOutputResult,
  ProviderStatusResult,
  ProviderSubmitResult,
} from './types';

export class MockProviderAdapter implements IProviderAdapter {
  readonly name = 'mock' as const;
  private tasks: Map<
    string,
    {
      input: ProviderJobInput;
      status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
      pollCount: number;
      simulateFailure?: boolean;
    }
  > = new Map();

  constructor(private simulateFailure = false) {}

  getCapabilities(): ProviderCapabilities {
    return {
      providerName: 'mock',
      supportedDurations: [10, 15, 20, 30, 60],
      supportsSpokenBM: true,
      supportsProductResearch: true,
      maxReferenceImages: 10,
      creditCostPerSecond: 0.1,
      supportsDirectCancellation: true,
      supportsWebhooks: true,
    };
  }

  validateInput(input: ProviderJobInput): { isValid: boolean; error?: string } {
    if (!input.prompt) return { isValid: false, error: 'Prompt is required' };
    if (!input.mainImageKeyOrUrl) return { isValid: false, error: 'Main image is required' };
    return { isValid: true };
  }

  preparePayload(input: ProviderJobInput): unknown {
    return { mockPayload: true, ...input };
  }

  async submit(input: ProviderJobInput): Promise<ProviderSubmitResult> {
    const taskId = `mock_task_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    this.tasks.set(taskId, {
      input,
      status: 'PENDING',
      pollCount: 0,
      simulateFailure: this.simulateFailure,
    });

    return {
      providerTaskId: taskId,
      rawStatus: 'SUBMITTED',
      estimatedWaitSeconds: 2,
    };
  }

  async getStatus(providerTaskId: string): Promise<ProviderStatusResult> {
    const task = this.tasks.get(providerTaskId);
    if (!task) {
      return {
        providerTaskId,
        normalizedStatus: 'FAILED',
        rawStatus: 'NOT_FOUND',
        errorMessage: `Task ${providerTaskId} not found`,
        isRetryable: false,
      };
    }

    task.pollCount += 1;

    if (task.simulateFailure) {
      task.status = 'FAILED';
      return {
        providerTaskId,
        normalizedStatus: 'FAILED',
        rawStatus: 'ERROR',
        errorMessage: 'Simulated downstream failure',
        isRetryable: true,
      };
    }

    if (task.pollCount >= 2) {
      task.status = 'COMPLETED';
      return {
        providerTaskId,
        normalizedStatus: 'COMPLETED',
        progressPercent: 100,
        rawStatus: 'SUCCESS',
      };
    }

    task.status = 'RUNNING';
    return {
      providerTaskId,
      normalizedStatus: 'RUNNING',
      progressPercent: 50,
      rawStatus: 'IN_PROGRESS',
    };
  }

  async getOutputs(providerTaskId: string): Promise<ProviderOutputResult> {
    const task = this.tasks.get(providerTaskId);
    if (!task || task.status !== 'COMPLETED') {
      throw new Error(`Mock task ${providerTaskId} is not completed`);
    }

    return {
      providerTaskId,
      videoUrl: `https://storage.contenify.mock/videos/${providerTaskId}.mp4`,
      thumbnailUrl: `https://storage.contenify.mock/thumbnails/${providerTaskId}.jpg`,
      durationSeconds: task.input.durationSeconds,
      fileSizeBytes: 4194304,
    };
  }

  async cancel(providerTaskId: string): Promise<{ success: boolean }> {
    this.tasks.delete(providerTaskId);
    return { success: true };
  }

  normalizeError(error: unknown): NormalizedError {
    return {
      isRetryable: true,
      category: 'PROVIDER_INTERNAL',
      code: 'MOCK_ERROR',
      message: String(error),
      wasBilled: false,
    };
  }
}
