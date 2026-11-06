/**
 * CONTENIFY SaaS — Provider Adapter Interface & Types
 * Standardized across RunningHub, Nexabot, and Mock testing harness.
 */

export type ProviderName = 'nexabot' | 'runninghub' | 'mock';

export type VideoDuration = 10 | 15 | 20 | 30 | 60;

export type AspectRatio = '9:16' | '16:9' | '1:1';

export type JobStatus =
  | 'DRAFT'
  | 'VALIDATING'
  | 'QUEUED'
  | 'RESEARCHING'
  | 'PROMPT_READY'
  | 'SUBMITTING'
  | 'GENERATING'
  | 'PROCESSING'
  | 'QUALITY_CHECK'
  | 'QA_PENDING'
  | 'COMPLETED'
  | 'REJECTED'
  | 'FAILED_RETRYABLE'
  | 'FAILED_FINAL'
  | 'CANCELLED';

export interface ProviderCapabilities {
  providerName: ProviderName;
  supportedDurations: VideoDuration[];
  supportsSpokenBM: boolean;
  supportsProductResearch: boolean;
  maxReferenceImages: number;
  creditCostPerSecond: number;
  supportsDirectCancellation: boolean;
  supportsWebhooks: boolean;
}

export interface ProviderJobInput {
  jobId: string;
  idempotencyKey: string;
  workspaceId: string;
  prompt: string;
  durationSeconds: VideoDuration;
  aspectRatio: AspectRatio;
  mainImageKeyOrUrl: string;
  referenceImageKeysOrUrls?: string[];
  avatarImageKeyOrUrl?: string;
  voiceStyle?: 'standard' | 'ugc' | 'cinema';
  options?: Record<string, unknown>;
}

export interface ProviderSubmitResult {
  providerTaskId: string;
  rawStatus: string;
  estimatedWaitSeconds?: number;
  metadata?: Record<string, unknown>;
}

export interface ProviderStatusResult {
  providerTaskId: string;
  normalizedStatus: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  progressPercent?: number;
  rawStatus: string;
  errorMessage?: string;
  isRetryable?: boolean;
}

export interface ProviderOutputResult {
  providerTaskId: string;
  videoUrl: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
  fileSizeBytes?: number;
  metadata?: Record<string, unknown>;
}

export interface NormalizedError {
  isRetryable: boolean;
  category: 'NETWORK' | 'AUTH' | 'RATE_LIMIT' | 'VALIDATION' | 'PROVIDER_INTERNAL' | 'TIMEOUT';
  code: string;
  message: string;
  wasBilled: boolean;
}

export interface IProviderAdapter {
  readonly name: ProviderName;
  getCapabilities(): ProviderCapabilities;
  validateInput(input: ProviderJobInput): { isValid: boolean; error?: string };
  preparePayload(input: ProviderJobInput): unknown;
  submit(input: ProviderJobInput): Promise<ProviderSubmitResult>;
  getStatus(providerTaskId: string): Promise<ProviderStatusResult>;
  getOutputs(providerTaskId: string): Promise<ProviderOutputResult>;
  cancel?(providerTaskId: string): Promise<{ success: boolean; message?: string }>;
  normalizeError(error: unknown): NormalizedError;
}
