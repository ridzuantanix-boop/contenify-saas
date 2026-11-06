import { JobStatus } from '../providers/types';

export interface StateTransitionEvent {
  jobId: string;
  fromStatus: JobStatus;
  toStatus: JobStatus;
  reason?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export class JobStateMachine {
  // Permitted valid forward and failure transitions
  private static readonly VALID_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
    DRAFT: ['VALIDATING', 'CANCELLED'],
    VALIDATING: ['QUEUED', 'FAILED_FINAL'],
    QUEUED: ['RESEARCHING', 'SUBMITTING', 'CANCELLED', 'FAILED_RETRYABLE'],
    RESEARCHING: ['PROMPT_READY', 'FAILED_RETRYABLE', 'FAILED_FINAL'],
    PROMPT_READY: ['SUBMITTING', 'CANCELLED'],
    SUBMITTING: ['GENERATING', 'FAILED_RETRYABLE', 'FAILED_FINAL'],
    GENERATING: ['PROCESSING', 'FAILED_RETRYABLE', 'FAILED_FINAL'],
    PROCESSING: ['QUALITY_CHECK', 'QA_PENDING', 'FAILED_RETRYABLE', 'FAILED_FINAL'],
    QUALITY_CHECK: ['QA_PENDING', 'FAILED_RETRYABLE', 'FAILED_FINAL'],
    QA_PENDING: ['COMPLETED', 'REJECTED'],
    COMPLETED: [],
    REJECTED: [],
    FAILED_RETRYABLE: ['QUEUED', 'FAILED_FINAL'],
    FAILED_FINAL: [],
    CANCELLED: [],
  };

  static canTransition(current: JobStatus, target: JobStatus): boolean {
    const allowed = this.VALID_TRANSITIONS[current] || [];
    return allowed.includes(target);
  }

  static transition(
    current: JobStatus,
    target: JobStatus,
    context: { jobId: string; reason?: string; metadata?: Record<string, unknown> }
  ): StateTransitionEvent {
    if (!this.canTransition(current, target)) {
      throw new Error(
        `Invalid state transition for job ${context.jobId}: cannot transition from '${current}' to '${target}'`
      );
    }

    return {
      jobId: context.jobId,
      fromStatus: current,
      toStatus: target,
      reason: context.reason,
      timestamp: new Date().toISOString(),
      metadata: context.metadata,
    };
  }

  static isTerminal(status: JobStatus): boolean {
    return status === 'COMPLETED' || status === 'REJECTED' || status === 'FAILED_FINAL' || status === 'CANCELLED';
  }
}
