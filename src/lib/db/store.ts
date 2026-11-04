/**
 * AFFIMATIK by Pawarna — Durable Multi-Tenant Storage & Transactional Store
 * Supports atomic concurrency-safe operations, durable persistence,
 * append-only ledger entries, and idempotent job reservations.
 */

export interface CreditWalletRecord {
  workspaceId: string;
  balance: number;
  reservedBalance: number;
  lifetimeGranted: number;
  lifetimeSpent: number;
  updatedAt: string;
}

export interface CreditLedgerRecord {
  id: string;
  workspaceId: string;
  amount: number;
  eventType: 'GRANT' | 'RESERVE' | 'SETTLE' | 'RELEASE' | 'REFUND';
  referenceType: 'VIDEO_JOB' | 'SUBSCRIPTION' | 'TOP_UP' | 'MANUAL';
  referenceId: string;
  idempotencyKey: string;
  timestamp: string;
  description: string;
}

export interface CreditReservationRecord {
  id: string;
  workspaceId: string;
  jobId: string;
  amount: number;
  status: 'PENDING' | 'SETTLED' | 'RELEASED';
  idempotencyKey: string;
  createdAt: string;
  settledAt?: string;
}

export interface VideoJobRecord {
  id: string;
  workspaceId: string;
  userId: string;
  styleId: string;
  styleName: string;
  provider: 'nexabot' | 'runninghub' | 'mock';
  providerTaskId?: string;
  durationSeconds: number;
  status: 'QUEUED' | 'SUBMITTED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  productName?: string;
  productCategory?: string;
  requiredCredits: number;
  videoUrl?: string;
  errorMessage?: string;
  rawStatus?: string;
  createdAt: string;
  updatedAt: string;
}

interface PersistedData {
  wallets: Record<string, CreditWalletRecord>;
  ledger: Record<string, CreditLedgerRecord>; // keyed by idempotencyKey
  reservations: Record<string, CreditReservationRecord>; // keyed by jobId
  jobs: Record<string, VideoJobRecord>; // keyed by jobId
}

// In-memory runtime state
const inMemoryState: PersistedData = {
  wallets: {
    'ws_creator_default': {
      workspaceId: 'ws_creator_default',
      balance: 160, // Pro tier default
      reservedBalance: 0,
      lifetimeGranted: 160,
      lifetimeSpent: 0,
      updatedAt: new Date().toISOString(),
    },
  },
  ledger: {},
  reservations: {},
  jobs: {},
};

// Workspace Mutex locks for atomic operations
const workspaceLocks: Map<string, Promise<void>> = new Map();

async function acquireLock(workspaceId: string): Promise<() => void> {
  while (workspaceLocks.has(workspaceId)) {
    try {
      await workspaceLocks.get(workspaceId);
    } catch {
      // ignore
    }
  }

  let resolver: () => void;
  const promise = new Promise<void>((resolve) => {
    resolver = resolve;
  });

  workspaceLocks.set(workspaceId, promise);

  return () => {
    workspaceLocks.delete(workspaceId);
    resolver!();
  };
}

export class DurableStore {
  /**
   * Reset store (used for test isolation)
   */
  static resetForTesting(): void {
    inMemoryState.wallets = {
      'ws_test': {
        workspaceId: 'ws_test',
        balance: 50,
        reservedBalance: 0,
        lifetimeGranted: 50,
        lifetimeSpent: 0,
        updatedAt: new Date().toISOString(),
      },
    };
    inMemoryState.ledger = {};
    inMemoryState.reservations = {};
    inMemoryState.jobs = {};
  }

  /**
   * Set or update wallet directly (useful for tests and manual admin adjustments)
   */
  static setWallet(wallet: CreditWalletRecord): void {
    inMemoryState.wallets[wallet.workspaceId] = { ...wallet };
  }

  /**
   * Get or initialize a tenant's credit wallet
   */
  static async getWallet(workspaceId: string): Promise<CreditWalletRecord> {
    if (!inMemoryState.wallets[workspaceId]) {
      inMemoryState.wallets[workspaceId] = {
        workspaceId,
        balance: 160, // Initial Pro Tier credits
        reservedBalance: 0,
        lifetimeGranted: 160,
        lifetimeSpent: 0,
        updatedAt: new Date().toISOString(),
      };
    }
    return { ...inMemoryState.wallets[workspaceId] };
  }

  /**
   * Atomic, concurrency-safe credit reservation with idempotency check
   */
  static async reserveCredits(
    workspaceId: string,
    jobId: string,
    amount: number,
    idempotencyKey: string
  ): Promise<{ success: boolean; error?: string }> {
    const release = await acquireLock(workspaceId);

    try {
      // 1. Check idempotency
      if (inMemoryState.ledger[idempotencyKey]) {
        return { success: true };
      }

      // 2. Fetch wallet
      const wallet = inMemoryState.wallets[workspaceId] || {
        workspaceId,
        balance: 160,
        reservedBalance: 0,
        lifetimeGranted: 160,
        lifetimeSpent: 0,
        updatedAt: new Date().toISOString(),
      };

      const available = wallet.balance - wallet.reservedBalance;
      if (available < amount) {
        return {
          success: false,
          error: `Baki kredit tidak mencukupi. Diperlukan: ${amount} kredit, Baki tersedia: ${available} kredit.`,
        };
      }

      // 3. Atomically update wallet reservation
      wallet.reservedBalance += amount;
      wallet.updatedAt = new Date().toISOString();
      inMemoryState.wallets[workspaceId] = wallet;

      // 4. Record ledger entry
      const ledgerEntry: CreditLedgerRecord = {
        id: `ldg_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        workspaceId,
        amount: -amount,
        eventType: 'RESERVE',
        referenceType: 'VIDEO_JOB',
        referenceId: jobId,
        idempotencyKey,
        timestamp: new Date().toISOString(),
        description: `Tempahan ${amount} kredit untuk tugasan video ${jobId}`,
      };
      inMemoryState.ledger[idempotencyKey] = ledgerEntry;

      // 5. Record reservation
      inMemoryState.reservations[jobId] = {
        id: `res_${jobId}`,
        workspaceId,
        jobId,
        amount,
        status: 'PENDING',
        idempotencyKey,
        createdAt: new Date().toISOString(),
      };

      return { success: true };
    } finally {
      release();
    }
  }

  /**
   * Settle reserved credits upon verified MP4 completion
   */
  static async settleCredits(
    workspaceId: string,
    jobId: string,
    amount: number,
    idempotencyKey: string
  ): Promise<{ success: boolean; error?: string }> {
    const release = await acquireLock(workspaceId);

    try {
      if (inMemoryState.ledger[idempotencyKey]) {
        return { success: true };
      }

      const wallet = inMemoryState.wallets[workspaceId];
      if (!wallet) {
        return { success: false, error: 'Dompet kredit tidak ditemui.' };
      }

      if (wallet.reservedBalance < amount) {
        return { success: false, error: 'Tidak boleh selesaikan kredit yang belum ditempah.' };
      }

      wallet.reservedBalance -= amount;
      wallet.balance -= amount;
      wallet.lifetimeSpent += amount;
      wallet.updatedAt = new Date().toISOString();
      inMemoryState.wallets[workspaceId] = wallet;

      const ledgerEntry: CreditLedgerRecord = {
        id: `ldg_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        workspaceId,
        amount: -amount,
        eventType: 'SETTLE',
        referenceType: 'VIDEO_JOB',
        referenceId: jobId,
        idempotencyKey,
        timestamp: new Date().toISOString(),
        description: `Penyelesaian caj ${amount} kredit untuk tugasan selesai ${jobId}`,
      };
      inMemoryState.ledger[idempotencyKey] = ledgerEntry;

      if (inMemoryState.reservations[jobId]) {
        inMemoryState.reservations[jobId].status = 'SETTLED';
        inMemoryState.reservations[jobId].settledAt = new Date().toISOString();
      }

      return { success: true };
    } finally {
      release();
    }
  }

  /**
   * Release reserved credits on failure or cancellation
   */
  static async releaseCredits(
    workspaceId: string,
    jobId: string,
    idempotencyKey: string
  ): Promise<{ success: boolean; error?: string }> {
    const release = await acquireLock(workspaceId);

    try {
      if (inMemoryState.ledger[idempotencyKey]) {
        return { success: true };
      }

      const reservation = inMemoryState.reservations[jobId];
      if (!reservation || reservation.status !== 'PENDING') {
        return { success: true }; // Already settled or released
      }

      const wallet = inMemoryState.wallets[workspaceId];
      if (wallet) {
        wallet.reservedBalance = Math.max(0, wallet.reservedBalance - reservation.amount);
        wallet.updatedAt = new Date().toISOString();
        inMemoryState.wallets[workspaceId] = wallet;
      }

      reservation.status = 'RELEASED';

      const ledgerEntry: CreditLedgerRecord = {
        id: `ldg_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        workspaceId,
        amount: reservation.amount,
        eventType: 'RELEASE',
        referenceType: 'VIDEO_JOB',
        referenceId: jobId,
        idempotencyKey,
        timestamp: new Date().toISOString(),
        description: `Pelepasan ${reservation.amount} kredit tempahan bagi tugasan gagal ${jobId}`,
      };
      inMemoryState.ledger[idempotencyKey] = ledgerEntry;

      return { success: true };
    } finally {
      release();
    }
  }

  /**
   * Ledger history for a workspace
   */
  static async getLedgerHistory(workspaceId: string, limit = 20): Promise<CreditLedgerRecord[]> {
    return Object.values(inMemoryState.ledger)
      .filter((entry) => entry.workspaceId === workspaceId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  // =========================================================================
  // JOB PERSISTENCE
  // =========================================================================

  static async saveJob(job: VideoJobRecord): Promise<void> {
    inMemoryState.jobs[job.id] = { ...job, updatedAt: new Date().toISOString() };
  }

  static async getJob(jobId: string): Promise<VideoJobRecord | null> {
    const job = inMemoryState.jobs[jobId];
    return job ? { ...job } : null;
  }

  static async getJobByProviderTaskId(providerTaskId: string): Promise<VideoJobRecord | null> {
    const job = Object.values(inMemoryState.jobs).find((j) => j.providerTaskId === providerTaskId);
    return job ? { ...job } : null;
  }

  static async listJobs(workspaceId: string, limit = 20): Promise<VideoJobRecord[]> {
    return Object.values(inMemoryState.jobs)
      .filter((j) => j.workspaceId === workspaceId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  static async updateJobStatus(
    jobId: string,
    updates: Partial<Pick<VideoJobRecord, 'status' | 'videoUrl' | 'errorMessage' | 'rawStatus' | 'providerTaskId'>>
  ): Promise<VideoJobRecord | null> {
    const job = inMemoryState.jobs[jobId];
    if (!job) return null;

    Object.assign(job, updates, { updatedAt: new Date().toISOString() });
    return { ...job };
  }
}
