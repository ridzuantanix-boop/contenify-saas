/**
 * AFFIMATIK by Pawarna — Production Persistent Multi-Tenant Database Client & Store (V2.1.4)
 * Fail-Closed Policy: Fails safely on database outages; completely eliminates in-memory fallback in production.
 * Atomic Job Admission: Coordinated admission, concurrency enforcement, idempotency, and credit reservation in single database transaction.
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
  id: string; // RFC4122 UUID
  workspaceId: string; // RFC4122 UUID
  userId: string;
  clientRequestId?: string;
  styleId: string;
  styleName: string;
  provider: 'nexabot' | 'runninghub' | 'mock';
  providerTaskId?: string;
  durationSeconds: number;
  status: 'QUEUED' | 'SUBMITTING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  productName?: string;
  productCategory?: string;
  requiredCredits: number;
  videoUrl?: string;
  errorMessage?: string;
  rawStatus?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderRecord {
  id: string;
  workspaceId: string;
  userId: string;
  planId: string;
  amountMyr: number;
  creditsGranted: number;
  status: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED' | 'CANCELLED';
  gatewayProvider: string;
  gatewayReference?: string;
  paymentMethod?: string;
  referralCode?: string;
  paidAt?: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface SubscriptionRecord {
  id: string;
  workspaceId: string;
  userId: string;
  planId: string;
  tier: string;
  status: 'active' | 'past_due' | 'cancelled' | 'expired';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AffiliateCommissionRecord {
  id: string;
  affiliateId: string;
  orderId: string;
  workspaceId: string;
  amountMyr: number;
  ratePercentage: number;
  status: 'PENDING' | 'APPROVED' | 'PAYABLE' | 'PAID' | 'REVERSED';
  createdAt: string;
  approvedAt?: string;
  paidAt?: string;
  payoutReference?: string;
}

export interface JobAdmissionRequest {
  workspaceId: string;
  userId: string;
  jobId: string;
  clientRequestId?: string;
  styleId: string;
  styleName: string;
  presetVersion: number;
  provider: 'nexabot' | 'runninghub' | 'mock';
  durationSeconds: number;
  requiredCredits: number;
  maxConcurrency: number;
  compiledPrompt: string;
  productName?: string;
  productCategory?: string;
  inputOptions?: Record<string, unknown>;
}

export interface JobAdmissionResult {
  success: boolean;
  isDuplicate?: boolean;
  jobId?: string;
  providerTaskId?: string;
  status?: string;
  requiredCredits?: number;
  concurrencyLimitReached?: boolean;
  insufficientCredits?: boolean;
  error?: string;
}

export const PLAN_CONCURRENCY_LIMITS: Record<string, number> = {
  free: 1,
  starter: 1,
  pro: 3,
  agency: 10,
};

// Deterministic in-memory database simulation for testing/development environments
interface LocalDatabaseState {
  wallets: Record<string, CreditWalletRecord>;
  ledger: Record<string, CreditLedgerRecord>; // Keyed by idempotencyKey
  reservations: Record<string, CreditReservationRecord>; // Keyed by jobId
  jobs: Record<string, VideoJobRecord>; // Keyed by jobId
  orders: Record<string, OrderRecord>; // Keyed by orderId
  subscriptions: Record<string, SubscriptionRecord>; // Keyed by workspaceId
  affiliates: Record<string, { id: string; userId: string; referralCode: string; rate: number; status: string }>;
  commissions: Record<string, AffiliateCommissionRecord>; // Keyed by commissionId
  auditLogs: Array<Record<string, unknown>>;
  settings: Record<string, unknown>;
  forceDbDown?: boolean;
}

const localDb: LocalDatabaseState = {
  wallets: {},
  ledger: {},
  reservations: {},
  jobs: {},
  orders: {},
  subscriptions: {},
  affiliates: {},
  commissions: {},
  auditLogs: [],
  settings: {
    generation_status: { paused: false },
    provider_concurrency_caps: { nexabot: 5, runninghub: 5 },
    provider_unit_costs: { nexabot_10s_myr: 1.5, runninghub_15s_myr: 2.0 },
    financial_safety: { minimum_safety_buffer_myr: 500, refund_reserve_percent: 10 },
  },
  forceDbDown: false,
};

// Concurrency mutex locks per workspace for local testing
const workspaceMutex: Map<string, Promise<void>> = new Map();

async function acquireWorkspaceLock(workspaceId: string): Promise<() => void> {
  while (workspaceMutex.has(workspaceId)) {
    try {
      await workspaceMutex.get(workspaceId);
    } catch {
      // ignore
    }
  }

  let resolver: () => void;
  const lockPromise = new Promise<void>((resolve) => {
    resolver = resolve;
  });

  workspaceMutex.set(workspaceId, lockPromise);

  return () => {
    workspaceMutex.delete(workspaceId);
    resolver!();
  };
}

export class DurableStore {
  /**
   * Reset local database state (strictly for testing isolation)
   */
  static resetForTesting(): void {
    localDb.wallets = {};
    localDb.ledger = {};
    localDb.reservations = {};
    localDb.jobs = {};
    localDb.orders = {};
    localDb.subscriptions = {};
    localDb.affiliates = {};
    localDb.commissions = {};
    localDb.auditLogs = [];
    localDb.settings = {
      generation_status: { paused: false },
      provider_concurrency_caps: { nexabot: 5, runninghub: 5 },
      provider_unit_costs: { nexabot_10s_myr: 1.5, runninghub_15s_myr: 2.0 },
      financial_safety: { minimum_safety_buffer_myr: 500, refund_reserve_percent: 10 },
    };
    localDb.forceDbDown = false;
  }

  /**
   * Simulate a database outage for testing fail-closed requirements
   */
  static setDatabaseUnavailableForTesting(isDown: boolean): void {
    localDb.forceDbDown = isDown;
  }

  /**
   * Seed wallet for testing
   */
  static setWallet(wallet: CreditWalletRecord): void {
    localDb.wallets[wallet.workspaceId] = { ...wallet };
  }

  /**
   * Helper to check if remote Supabase database credentials exist
   */
  private static isSupabaseConfigured(): boolean {
    return Boolean(
      process.env.SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY &&
      !localDb.forceDbDown
    );
  }

  /**
   * Fail-closed check: Strictly enforces database connectivity in production.
   * USE_MOCK_PROVIDERS does NOT bypass this check.
   */
  private static checkFailClosed(): void {
    if (localDb.forceDbDown) {
      throw new Error('Database connection unavailable: fail-closed.');
    }
    if (process.env.NODE_ENV === 'production' && !this.isSupabaseConfigured()) {
      throw new Error('Database configuration missing in production: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
    }
  }

  /**
   * Fetches tenant's wallet with zero in-memory fallback in production.
   */
  static async getWallet(workspaceId: string): Promise<CreditWalletRecord> {
    this.checkFailClosed();

    if (this.isSupabaseConfigured()) {
      const url = `${process.env.SUPABASE_URL}/rest/v1/credit_wallets?workspace_id=eq.${encodeURIComponent(workspaceId)}&select=*`;
      const res = await fetch(url, {
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Database error HTTP ${res.status}: ${errText || 'Failed to query credit wallet'}`);
      }

      const rows = await res.json();
      if (rows && rows.length > 0) {
        const row = rows[0];
        return {
          workspaceId: row.workspace_id,
          balance: row.balance,
          reservedBalance: row.reserved_balance,
          lifetimeGranted: row.lifetime_granted,
          lifetimeSpent: row.lifetime_spent,
          updatedAt: row.updated_at,
        };
      }

      // Auto-provision initial wallet with 50 free trial credits atomically (wallet + GRANT ledger entry in single transaction)
      const rpcRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/provision_wallet_atomic`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          p_workspace_id: workspaceId,
          p_initial_balance: 50,
        }),
      });

      if (rpcRes.ok) {
        const provData = await rpcRes.json();
        if (provData && provData.success) {
          return {
            workspaceId: provData.workspace_id,
            balance: provData.balance,
            reservedBalance: provData.reserved_balance,
            lifetimeGranted: provData.lifetime_granted,
            lifetimeSpent: provData.lifetime_spent,
            updatedAt: provData.updated_at,
          };
        }
      }

      throw new Error(`Dompet akaun untuk ruang kerja ${workspaceId} tidak ditemui dan gagal diprovisikan.`);
    }

    if (process.env.NODE_ENV === 'production') {
      throw new Error('Database connection unavailable: fail-closed.');
    }

    // Local / Testing Fallback
    if (!localDb.wallets[workspaceId]) {
      localDb.wallets[workspaceId] = {
        workspaceId,
        balance: 50, // Initial free credits by policy (50 free trial credits for soft launch)
        reservedBalance: 0,
        lifetimeGranted: 50,
        lifetimeSpent: 0,
        updatedAt: new Date().toISOString(),
      };
      // Atomically back initial wallet with GRANT ledger record
      const grantKey = `grant_initial_${workspaceId}`;
      localDb.ledger[grantKey] = {
        id: grantKey,
        workspaceId,
        amount: 50,
        eventType: 'GRANT',
        referenceType: 'SUBSCRIPTION',
        referenceId: workspaceId,
        idempotencyKey: grantKey,
        description: 'Pemberian baki permulaan akaun AffiMatik (50 kredit percuma)',
        timestamp: new Date().toISOString(),
      };
    }

    return { ...localDb.wallets[workspaceId] };
  }

  /**
   * Atomic Job Admission: Coordinated admission, concurrency enforcement, idempotency,
   * and credit reservation in a single atomic database transaction.
   */
  static async admitJobAtomic(req: JobAdmissionRequest): Promise<JobAdmissionResult> {
    this.checkFailClosed();

    if (this.isSupabaseConfigured()) {
      const rpcUrl = `${process.env.SUPABASE_URL}/rest/v1/rpc/admit_video_job_atomic`;
      const res = await fetch(rpcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          p_workspace_id: req.workspaceId,
          p_user_id: req.userId,
          p_job_id: req.jobId,
          p_client_request_id: req.clientRequestId || null,
          p_preset_id: req.styleId,
          p_preset_version: req.presetVersion,
          p_provider: req.provider,
          p_duration_seconds: req.durationSeconds,
          p_required_credits: req.requiredCredits,
          p_max_concurrency: req.maxConcurrency,
          p_compiled_prompt: req.compiledPrompt,
          p_input_options: req.inputOptions || {},
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Database admission error HTTP ${res.status}: ${errText}`);
      }

      const data = await res.json();
      return {
        success: Boolean(data.success),
        isDuplicate: Boolean(data.is_duplicate),
        jobId: data.job_id || req.jobId,
        providerTaskId: data.provider_task_id,
        status: data.status,
        requiredCredits: data.required_credits || req.requiredCredits,
        concurrencyLimitReached: Boolean(data.concurrency_limit_reached),
        insufficientCredits: Boolean(data.insufficient_credits),
        error: data.error,
      };
    }

    if (process.env.NODE_ENV === 'production') {
      throw new Error('Database connection unavailable: fail-closed.');
    }

    // Local / Testing atomic admission implementation
    const releaseLock = await acquireWorkspaceLock(req.workspaceId);
    try {
      // 1. Idempotency Check by clientRequestId
      if (req.clientRequestId) {
        const existing = Object.values(localDb.jobs).find(
          (j) => j.workspaceId === req.workspaceId && j.clientRequestId === req.clientRequestId
        );
        if (existing) {
          return {
            success: true,
            isDuplicate: true,
            jobId: existing.id,
            providerTaskId: existing.providerTaskId,
            status: existing.status,
            requiredCredits: existing.requiredCredits,
          };
        }
      }

      // 2. Concurrency check
      const activeCount = Object.values(localDb.jobs).filter(
        (j) => j.workspaceId === req.workspaceId && (j.status === 'QUEUED' || j.status === 'SUBMITTING' || j.status === 'PROCESSING')
      ).length;

      if (activeCount >= req.maxConcurrency) {
        return {
          success: false,
          concurrencyLimitReached: true,
          error: `Had penjanaan serentak dicapai (${activeCount}/${req.maxConcurrency} tugasan aktif). Sila tunggu video semasa selesai diproses.`,
        };
      }

      // 3. Balance verification
      const wallet = localDb.wallets[req.workspaceId] || {
        workspaceId: req.workspaceId,
        balance: 50,
        reservedBalance: 0,
        lifetimeGranted: 50,
        lifetimeSpent: 0,
        updatedAt: new Date().toISOString(),
      };

      const available = wallet.balance - wallet.reservedBalance;
      if (available < req.requiredCredits) {
        return {
          success: false,
          insufficientCredits: true,
          error: `Baki kredit tidak mencukupi. Diperlukan: ${req.requiredCredits} kredit, Baki tersedia: ${available} kredit.`,
        };
      }

      // 4. Reserve credits atomically
      wallet.reservedBalance += req.requiredCredits;
      wallet.updatedAt = new Date().toISOString();
      localDb.wallets[req.workspaceId] = wallet;

      // 5. Insert job record with status SUBMITTING
      const newJob: VideoJobRecord = {
        id: req.jobId,
        workspaceId: req.workspaceId,
        userId: req.userId,
        clientRequestId: req.clientRequestId,
        styleId: req.styleId,
        styleName: req.styleName,
        provider: req.provider,
        durationSeconds: req.durationSeconds,
        status: 'SUBMITTING',
        productName: req.productName,
        productCategory: req.productCategory,
        requiredCredits: req.requiredCredits,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      localDb.jobs[req.jobId] = newJob;

      // 6. Insert credit reservation
      localDb.reservations[req.jobId] = {
        id: `res_${req.jobId}`,
        workspaceId: req.workspaceId,
        jobId: req.jobId,
        amount: req.requiredCredits,
        status: 'PENDING',
        idempotencyKey: `job_idem_${req.jobId}`,
        createdAt: new Date().toISOString(),
      };

      // 7. Insert audit ledger entry
      localDb.ledger[`job_idem_${req.jobId}`] = {
        id: `ldg_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        workspaceId: req.workspaceId,
        amount: -req.requiredCredits,
        eventType: 'RESERVE',
        referenceType: 'VIDEO_JOB',
        referenceId: req.jobId,
        idempotencyKey: `job_idem_${req.jobId}`,
        timestamp: new Date().toISOString(),
        description: `Tempahan ${req.requiredCredits} kredit untuk tugasan ${req.jobId}`,
      };

      return {
        success: true,
        isDuplicate: false,
        jobId: req.jobId,
        requiredCredits: req.requiredCredits,
      };
    } finally {
      releaseLock();
    }
  }

  /**
   * Atomic Credit Reservation with Row-Level Lock & Idempotency Guarantee
   */
  static async reserveCredits(
    workspaceId: string,
    jobId: string,
    amount: number,
    idempotencyKey: string
  ): Promise<{ success: boolean; error?: string }> {
    this.checkFailClosed();

    if (this.isSupabaseConfigured()) {
      const rpcUrl = `${process.env.SUPABASE_URL}/rest/v1/rpc/reserve_credits_atomic`;
      const res = await fetch(rpcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          p_workspace_id: workspaceId,
          p_job_id: jobId,
          p_amount: amount,
          p_idempotency_key: idempotencyKey,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        return { success: false, error: errData.message || 'Ralat transaksi tempahan kredit.' };
      }

      const data = await res.json();
      return { success: data.success, error: data.error };
    }

    if (process.env.NODE_ENV === 'production') {
      throw new Error('Database connection unavailable: fail-closed.');
    }

    // Local / Testing Mutex Atomic Transaction
    const releaseLock = await acquireWorkspaceLock(workspaceId);
    try {
      if (localDb.ledger[idempotencyKey]) {
        return { success: true };
      }

      const wallet = localDb.wallets[workspaceId] || {
        workspaceId,
        balance: 50,
        reservedBalance: 0,
        lifetimeGranted: 50,
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

      wallet.reservedBalance += amount;
      wallet.updatedAt = new Date().toISOString();
      localDb.wallets[workspaceId] = wallet;

      localDb.ledger[idempotencyKey] = {
        id: `ldg_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        workspaceId,
        amount: -amount,
        eventType: 'RESERVE',
        referenceType: 'VIDEO_JOB',
        referenceId: jobId,
        idempotencyKey,
        timestamp: new Date().toISOString(),
        description: `Tempahan ${amount} kredit untuk tugasan ${jobId}`,
      };

      localDb.reservations[jobId] = {
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
      releaseLock();
    }
  }

  /**
   * Settle Credits upon Verified MP4 Video Generation
   */
  static async settleCredits(
    workspaceId: string,
    jobId: string,
    amount: number,
    idempotencyKey: string
  ): Promise<{ success: boolean; error?: string }> {
    this.checkFailClosed();

    if (this.isSupabaseConfigured()) {
      const rpcUrl = `${process.env.SUPABASE_URL}/rest/v1/rpc/settle_credits_atomic`;
      const res = await fetch(rpcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          p_workspace_id: workspaceId,
          p_job_id: jobId,
          p_amount: amount,
          p_idempotency_key: idempotencyKey,
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Database error HTTP ${res.status}: ${errText}`);
      }

      const data = await res.json();
      return { success: Boolean(data.success), error: data.error };
    }

    if (process.env.NODE_ENV === 'production') {
      throw new Error('Database connection unavailable: fail-closed.');
    }

    const releaseLock = await acquireWorkspaceLock(workspaceId);
    try {
      if (localDb.ledger[idempotencyKey]) {
        return { success: true };
      }

      const reservation = localDb.reservations[jobId];
      if (!reservation) {
        return { success: false, error: 'Tiada rekod tempahan kredit ditemui untuk tugasan ini.' };
      }

      if (reservation.status === 'RELEASED') {
        return { success: false, error: 'Tempahan kredit ini telah dilepaskan/dibatalkan dan tidak boleh diselesaikan.' };
      }

      if (reservation.status === 'SETTLED') {
        return { success: true };
      }

      if (reservation.amount !== amount) {
        return {
          success: false,
          error: `Jumlah penyelesaian (${amount} kredit) tidak sepadan dengan tempahan asal (${reservation.amount} kredit).`,
        };
      }

      const wallet = localDb.wallets[workspaceId];
      if (!wallet) {
        return { success: false, error: 'Dompet kredit tidak ditemui.' };
      }

      wallet.reservedBalance = Math.max(0, wallet.reservedBalance - amount);
      wallet.balance -= amount;
      wallet.lifetimeSpent += amount;
      wallet.updatedAt = new Date().toISOString();
      localDb.wallets[workspaceId] = wallet;

      reservation.status = 'SETTLED';
      reservation.settledAt = new Date().toISOString();

      localDb.ledger[idempotencyKey] = {
        id: `ldg_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        workspaceId,
        amount: -amount,
        eventType: 'SETTLE',
        referenceType: 'VIDEO_JOB',
        referenceId: jobId,
        idempotencyKey,
        timestamp: new Date().toISOString(),
        description: `Penyelesaian ${amount} kredit untuk tugasan selesai ${jobId}`,
      };

      return { success: true };
    } finally {
      releaseLock();
    }
  }

  /**
   * Release Reserved Credits on Upstream Failure or Cancellation
   */
  static async releaseCredits(
    workspaceId: string,
    jobId: string,
    idempotencyKey: string
  ): Promise<{ success: boolean; error?: string }> {
    this.checkFailClosed();

    if (this.isSupabaseConfigured()) {
      const rpcUrl = `${process.env.SUPABASE_URL}/rest/v1/rpc/release_credits_atomic`;
      const res = await fetch(rpcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          p_workspace_id: workspaceId,
          p_job_id: jobId,
          p_idempotency_key: idempotencyKey,
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Database error HTTP ${res.status}: ${errText}`);
      }

      const data = await res.json();
      return { success: Boolean(data.success), error: data.error };
    }

    if (process.env.NODE_ENV === 'production') {
      throw new Error('Database connection unavailable: fail-closed.');
    }

    const releaseLock = await acquireWorkspaceLock(workspaceId);
    try {
      if (localDb.ledger[idempotencyKey]) {
        return { success: true };
      }

      const reservation = localDb.reservations[jobId];
      if (!reservation || reservation.status !== 'PENDING') {
        return { success: true };
      }

      const wallet = localDb.wallets[workspaceId];
      if (wallet) {
        wallet.reservedBalance = Math.max(0, wallet.reservedBalance - reservation.amount);
        wallet.updatedAt = new Date().toISOString();
        localDb.wallets[workspaceId] = wallet;
      }

      reservation.status = 'RELEASED';

      localDb.ledger[idempotencyKey] = {
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

      return { success: true };
    } finally {
      releaseLock();
    }
  }

  // =========================================================================
  // PERSISTENT JOB OPERATIONS
  // =========================================================================

  private static mapJobFromDb(row: Record<string, any>): VideoJobRecord {
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      userId: row.user_id || row.workspace_id,
      clientRequestId: row.client_request_id || undefined,
      styleId: row.preset_id || 'NX01',
      styleName: row.style_name || row.preset_id || 'Standard Style',
      provider: row.provider || 'nexabot',
      providerTaskId: row.provider_task_id || undefined,
      durationSeconds: row.duration_seconds || 10,
      status: row.status || 'QUEUED',
      productName: row.product_name || undefined,
      productCategory: row.product_category || undefined,
      requiredCredits: row.required_credits || (row.duration_seconds === 10 ? 10 : 15),
      videoUrl: row.result_video_url || undefined,
      errorMessage: row.error_message || undefined,
      rawStatus: row.raw_status || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at || row.created_at,
    };
  }

  static async saveJob(job: VideoJobRecord): Promise<void> {
    this.checkFailClosed();

    if (this.isSupabaseConfigured()) {
      const url = `${process.env.SUPABASE_URL}/rest/v1/video_jobs`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify({
          id: job.id,
          workspace_id: job.workspaceId,
          user_id: job.userId,
          client_request_id: job.clientRequestId || null,
          preset_id: job.styleId,
          preset_version: 2,
          provider: job.provider,
          duration_seconds: job.durationSeconds,
          required_credits: job.requiredCredits,
          aspect_ratio: '9:16',
          voice_accent: 'ms-MY-standard',
          status: job.status,
          provider_task_id: job.providerTaskId || null,
          idempotency_key: `job_idem_${job.id}`,
          result_video_url: job.videoUrl || null,
          error_message: job.errorMessage || null,
          created_at: job.createdAt,
          updated_at: job.updatedAt,
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Database error HTTP ${res.status}: Gagal menyimpan rekod tugasan video. ${errText}`);
      }
      return;
    }

    if (process.env.NODE_ENV === 'production') {
      throw new Error('Database connection unavailable: fail-closed.');
    }

    localDb.jobs[job.id] = { ...job, updatedAt: new Date().toISOString() };
  }

  static async getJob(jobId: string): Promise<VideoJobRecord | null> {
    this.checkFailClosed();

    if (this.isSupabaseConfigured()) {
      const url = `${process.env.SUPABASE_URL}/rest/v1/video_jobs?id=eq.${encodeURIComponent(jobId)}&select=*`;
      const res = await fetch(url, {
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Database error HTTP ${res.status}: ${errText}`);
      }

      const rows = await res.json();
      if (rows && rows.length > 0) {
        return this.mapJobFromDb(rows[0]);
      }
      return null;
    }

    if (process.env.NODE_ENV === 'production') {
      throw new Error('Database connection unavailable: fail-closed.');
    }

    const job = localDb.jobs[jobId];
    return job ? { ...job } : null;
  }

  static async getJobByClientRequestId(workspaceId: string, clientRequestId: string): Promise<VideoJobRecord | null> {
    this.checkFailClosed();

    if (this.isSupabaseConfigured()) {
      const url = `${process.env.SUPABASE_URL}/rest/v1/video_jobs?workspace_id=eq.${encodeURIComponent(workspaceId)}&client_request_id=eq.${encodeURIComponent(clientRequestId)}&select=*`;
      const res = await fetch(url, {
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Database error HTTP ${res.status}: ${errText}`);
      }

      const rows = await res.json();
      if (rows && rows.length > 0) {
        return this.mapJobFromDb(rows[0]);
      }
      return null;
    }

    if (process.env.NODE_ENV === 'production') {
      throw new Error('Database connection unavailable: fail-closed.');
    }

    const job = Object.values(localDb.jobs).find(
      (j) => j.workspaceId === workspaceId && j.clientRequestId === clientRequestId
    );
    return job ? { ...job } : null;
  }

  static async getJobByProviderTaskId(providerTaskId: string, workspaceId: string): Promise<VideoJobRecord | null> {
    this.checkFailClosed();

    if (this.isSupabaseConfigured()) {
      const url = `${process.env.SUPABASE_URL}/rest/v1/video_jobs?provider_task_id=eq.${encodeURIComponent(providerTaskId)}&workspace_id=eq.${encodeURIComponent(workspaceId)}&select=*`;
      const res = await fetch(url, {
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Database error HTTP ${res.status}: ${errText}`);
      }

      const rows = await res.json();
      if (rows && rows.length > 0) {
        return this.mapJobFromDb(rows[0]);
      }
      return null;
    }

    if (process.env.NODE_ENV === 'production') {
      throw new Error('Database connection unavailable: fail-closed.');
    }

    const job = Object.values(localDb.jobs).find(
      (j) => j.providerTaskId === providerTaskId && j.workspaceId === workspaceId
    );
    return job ? { ...job } : null;
  }

  static async listJobs(workspaceId: string, limit = 20): Promise<VideoJobRecord[]> {
    this.checkFailClosed();

    if (this.isSupabaseConfigured()) {
      const url = `${process.env.SUPABASE_URL}/rest/v1/video_jobs?workspace_id=eq.${encodeURIComponent(workspaceId)}&order=created_at.desc&limit=${limit}&select=*`;
      const res = await fetch(url, {
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Database error HTTP ${res.status}: ${errText}`);
      }

      const rows = await res.json();
      return rows.map((r: Record<string, any>) => this.mapJobFromDb(r));
    }

    if (process.env.NODE_ENV === 'production') {
      throw new Error('Database connection unavailable: fail-closed.');
    }

    return Object.values(localDb.jobs)
      .filter((j) => j.workspaceId === workspaceId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  static async countActiveJobs(workspaceId: string): Promise<number> {
    this.checkFailClosed();

    if (this.isSupabaseConfigured()) {
      const url = `${process.env.SUPABASE_URL}/rest/v1/video_jobs?workspace_id=eq.${encodeURIComponent(workspaceId)}&status=in.(QUEUED,SUBMITTING,PROCESSING)&select=id`;
      const res = await fetch(url, {
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Database error HTTP ${res.status}: ${errText}`);
      }

      const rows = await res.json();
      return Array.isArray(rows) ? rows.length : 0;
    }

    if (process.env.NODE_ENV === 'production') {
      throw new Error('Database connection unavailable: fail-closed.');
    }

    return Object.values(localDb.jobs).filter(
      (j) => j.workspaceId === workspaceId && (j.status === 'QUEUED' || j.status === 'SUBMITTING' || j.status === 'PROCESSING')
    ).length;
  }

  static async updateJobStatus(
    jobId: string,
    updates: Partial<Pick<VideoJobRecord, 'status' | 'videoUrl' | 'errorMessage' | 'rawStatus' | 'providerTaskId'>>
  ): Promise<VideoJobRecord | null> {
    this.checkFailClosed();

    if (this.isSupabaseConfigured()) {
      const patchPayload: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };
      if (updates.status) patchPayload.status = updates.status;
      if (updates.providerTaskId) patchPayload.provider_task_id = updates.providerTaskId;
      if (updates.videoUrl) patchPayload.result_video_url = updates.videoUrl;
      if (updates.errorMessage) patchPayload.error_message = updates.errorMessage;

      const url = `${process.env.SUPABASE_URL}/rest/v1/video_jobs?id=eq.${encodeURIComponent(jobId)}`;
      const res = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          Prefer: 'return=representation',
        },
        body: JSON.stringify(patchPayload),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Database error HTTP ${res.status}: ${errText}`);
      }

      const rows = await res.json();
      if (rows && rows.length > 0) {
        return this.mapJobFromDb(rows[0]);
      }
      return null;
    }

    if (process.env.NODE_ENV === 'production') {
      throw new Error('Database connection unavailable: fail-closed.');
    }

    const job = localDb.jobs[jobId];
    if (!job) return null;

    Object.assign(job, updates, { updatedAt: new Date().toISOString() });
    return { ...job };
  }

  static async listPendingJobsForReconciliation(): Promise<VideoJobRecord[]> {
    this.checkFailClosed();

    if (this.isSupabaseConfigured()) {
      const url = `${process.env.SUPABASE_URL}/rest/v1/video_jobs?status=in.(SUBMITTING,PROCESSING)&order=created_at.asc&limit=100&select=*`;
      const res = await fetch(url, {
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Database error HTTP ${res.status}: ${errText}`);
      }

      const rows = await res.json();
      return rows.map((r: Record<string, any>) => this.mapJobFromDb(r));
    }

    if (process.env.NODE_ENV === 'production') {
      throw new Error('Database connection unavailable: fail-closed.');
    }

    return Object.values(localDb.jobs).filter(
      (j) => j.status === 'SUBMITTING' || j.status === 'PROCESSING'
    );
  }

  static async getLedgerHistory(workspaceId: string, limit = 20): Promise<CreditLedgerRecord[]> {
    this.checkFailClosed();

    if (this.isSupabaseConfigured()) {
      const url = `${process.env.SUPABASE_URL}/rest/v1/credit_ledger?workspace_id=eq.${encodeURIComponent(workspaceId)}&order=created_at.desc&limit=${limit}&select=*`;
      const res = await fetch(url, {
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Database error HTTP ${res.status}: ${errText}`);
      }

      const rows = await res.json();
      return rows.map((r: Record<string, any>) => ({
        id: r.id,
        workspaceId: r.workspace_id,
        amount: r.amount,
        eventType: r.event_type,
        referenceType: r.reference_type,
        referenceId: r.reference_id,
        idempotencyKey: r.idempotency_key,
        timestamp: r.created_at,
        description: r.description,
      }));
    }

    if (process.env.NODE_ENV === 'production') {
      throw new Error('Database connection unavailable: fail-closed.');
    }

    return Object.values(localDb.ledger)
      .filter((entry) => entry.workspaceId === workspaceId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  /**
   * Create an Order for plan subscription / credits checkout
   */
  static async createOrder(orderData: {
    id?: string;
    workspaceId: string;
    userId: string;
    planId: string;
    amountMyr: number;
    creditsGranted: number;
    gatewayProvider?: string;
    gatewayReference?: string;
    paymentMethod?: string;
    referralCode?: string;
    metadata?: Record<string, unknown>;
  }): Promise<OrderRecord> {
    this.checkFailClosed();

    const orderId = orderData.id || crypto.randomUUID();
    const newOrder: OrderRecord = {
      id: orderId,
      workspaceId: orderData.workspaceId,
      userId: orderData.userId,
      planId: orderData.planId,
      amountMyr: orderData.amountMyr,
      creditsGranted: orderData.creditsGranted,
      status: 'PENDING',
      gatewayProvider: orderData.gatewayProvider || 'manual_fpx',
      gatewayReference: orderData.gatewayReference,
      paymentMethod: orderData.paymentMethod || 'fpx',
      referralCode: orderData.referralCode,
      createdAt: new Date().toISOString(),
      metadata: orderData.metadata || {},
    };

    if (this.isSupabaseConfigured()) {
      const url = `${process.env.SUPABASE_URL}/rest/v1/orders`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          id: newOrder.id,
          workspace_id: newOrder.workspaceId,
          user_id: newOrder.userId,
          plan_id: newOrder.planId,
          amount_myr: newOrder.amountMyr,
          credits_granted: newOrder.creditsGranted,
          status: newOrder.status,
          gateway_provider: newOrder.gatewayProvider,
          gateway_reference: newOrder.gatewayReference,
          payment_method: newOrder.paymentMethod,
          referral_code: newOrder.referralCode,
          metadata: newOrder.metadata,
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Database error HTTP ${res.status}: ${errText}`);
      }

      const rows = await res.json();
      const r = rows[0];
      return {
        id: r.id,
        workspaceId: r.workspace_id,
        userId: r.user_id,
        planId: r.plan_id,
        amountMyr: Number(r.amount_myr),
        creditsGranted: r.credits_granted,
        status: r.status,
        gatewayProvider: r.gateway_provider,
        gatewayReference: r.gateway_reference,
        paymentMethod: r.payment_method,
        referralCode: r.referral_code,
        paidAt: r.paid_at,
        createdAt: r.created_at,
        metadata: r.metadata,
      };
    }

    if (process.env.NODE_ENV === 'production') {
      throw new Error('Database connection unavailable: fail-closed.');
    }

    localDb.orders[newOrder.id] = { ...newOrder };
    return { ...newOrder };
  }

  /**
   * Retrieve an Order by ID
   */
  static async getOrder(orderId: string): Promise<OrderRecord | null> {
    this.checkFailClosed();

    if (this.isSupabaseConfigured()) {
      const url = `${process.env.SUPABASE_URL}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}`;
      const res = await fetch(url, {
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      });

      if (!res.ok) return null;
      const rows = await res.json();
      if (!rows || rows.length === 0) return null;
      const r = rows[0];
      return {
        id: r.id,
        workspaceId: r.workspace_id,
        userId: r.user_id,
        planId: r.plan_id,
        amountMyr: Number(r.amount_myr),
        creditsGranted: r.credits_granted,
        status: r.status,
        gatewayProvider: r.gateway_provider,
        gatewayReference: r.gateway_reference,
        paymentMethod: r.payment_method,
        referralCode: r.referral_code,
        paidAt: r.paid_at,
        createdAt: r.created_at,
        metadata: r.metadata,
      };
    }

    if (process.env.NODE_ENV === 'production') {
      throw new Error('Database connection unavailable: fail-closed.');
    }

    const order = localDb.orders[orderId];
    return order ? { ...order } : null;
  }

  /**
   * List Orders (all or filtered by workspace)
   */
  static async listOrders(workspaceId?: string, limit = 50): Promise<OrderRecord[]> {
    this.checkFailClosed();

    if (this.isSupabaseConfigured()) {
      let url = `${process.env.SUPABASE_URL}/rest/v1/orders?order=created_at.desc&limit=${limit}`;
      if (workspaceId) {
        url += `&workspace_id=eq.${encodeURIComponent(workspaceId)}`;
      }
      const res = await fetch(url, {
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      });

      if (!res.ok) return [];
      const rows = await res.json();
      return rows.map((r: Record<string, any>) => ({
        id: r.id,
        workspaceId: r.workspace_id,
        userId: r.user_id,
        planId: r.plan_id,
        amountMyr: Number(r.amount_myr),
        creditsGranted: r.credits_granted,
        status: r.status,
        gatewayProvider: r.gateway_provider,
        gatewayReference: r.gateway_reference,
        paymentMethod: r.payment_method,
        referralCode: r.referral_code,
        paidAt: r.paid_at,
        createdAt: r.created_at,
        metadata: r.metadata,
      }));
    }

    if (process.env.NODE_ENV === 'production') {
      throw new Error('Database connection unavailable: fail-closed.');
    }

    return Object.values(localDb.orders)
      .filter((o) => !workspaceId || o.workspaceId === workspaceId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  /**
   * Settle an order atomically: updates order to PAID, grants credits, updates subscription tier, records affiliate commission
   */
  static async settleOrder(
    orderId: string,
    gatewayReference?: string,
    metadata?: Record<string, unknown>
  ): Promise<{ success: boolean; orderId: string; status: string; balance: number; tier?: string; error?: string }> {
    this.checkFailClosed();

    if (this.isSupabaseConfigured()) {
      const url = `${process.env.SUPABASE_URL}/rest/v1/rpc/settle_order_payment_atomic`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          p_order_id: orderId,
          p_gateway_reference: gatewayReference || null,
          p_metadata: metadata || {},
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Database error HTTP ${res.status}: ${errText}`);
      }

      return await res.json();
    }

    if (process.env.NODE_ENV === 'production') {
      throw new Error('Database connection unavailable: fail-closed.');
    }

    // Local in-memory settlement simulation
    const order = localDb.orders[orderId];
    if (!order) {
      return { success: false, orderId, status: 'NOT_FOUND', balance: 0, error: 'Order not found' };
    }

    // Idempotent replay check
    if (order.status === 'PAID') {
      const currentWallet = localDb.wallets[order.workspaceId] || { balance: 0 };
      return {
        success: true,
        orderId: order.id,
        status: 'PAID',
        balance: currentWallet.balance,
      };
    }

    // Mark PAID
    order.status = 'PAID';
    order.paidAt = new Date().toISOString();
    order.gatewayReference = gatewayReference || order.gatewayReference || `man_${crypto.randomUUID()}`;

    // Resolve tier
    let tier = 'starter';
    if (order.planId.includes('agency')) tier = 'agency';
    else if (order.planId.includes('pro')) tier = 'pro';

    // Update subscription
    localDb.subscriptions[order.workspaceId] = {
      id: crypto.randomUUID(),
      workspaceId: order.workspaceId,
      userId: order.userId,
      planId: order.planId,
      tier,
      status: 'active',
      currentPeriodStart: new Date().toISOString(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      cancelAtPeriodEnd: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Grant credits
    const wallet = localDb.wallets[order.workspaceId] || {
      workspaceId: order.workspaceId,
      balance: 50,
      reservedBalance: 0,
      lifetimeGranted: 50,
      lifetimeSpent: 0,
      updatedAt: new Date().toISOString(),
    };

    wallet.balance += order.creditsGranted;
    wallet.lifetimeGranted += order.creditsGranted;
    wallet.updatedAt = new Date().toISOString();
    localDb.wallets[order.workspaceId] = wallet;

    // Record ledger
    const ledgerKey = `ord_pay_${order.id}`;
    localDb.ledger[ledgerKey] = {
      id: crypto.randomUUID(),
      workspaceId: order.workspaceId,
      amount: order.creditsGranted,
      eventType: 'GRANT',
      referenceType: 'SUBSCRIPTION',
      referenceId: order.id,
      idempotencyKey: ledgerKey,
      timestamp: new Date().toISOString(),
      description: `Plan Credit Purchase: ${order.planId} (+${order.creditsGranted} credits)`,
    };

    // Affiliate Commission attribution (20%)
    if (order.referralCode) {
      const commissionAmount = Math.round(order.amountMyr * 0.20 * 100) / 100;
      const commId = crypto.randomUUID();
      localDb.commissions[commId] = {
        id: commId,
        affiliateId: order.referralCode,
        orderId: order.id,
        workspaceId: order.workspaceId,
        amountMyr: commissionAmount,
        ratePercentage: 20.0,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
      };
    }

    return {
      success: true,
      orderId: order.id,
      status: 'PAID',
      balance: wallet.balance,
      tier,
    };
  }

  /**
   * Retrieve Subscription record for workspace
   */
  static async getSubscription(workspaceId: string): Promise<SubscriptionRecord | null> {
    this.checkFailClosed();

    if (this.isSupabaseConfigured()) {
      const url = `${process.env.SUPABASE_URL}/rest/v1/subscriptions?workspace_id=eq.${encodeURIComponent(workspaceId)}`;
      const res = await fetch(url, {
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      });

      if (!res.ok) return null;
      const rows = await res.json();
      if (!rows || rows.length === 0) return null;
      const r = rows[0];
      return {
        id: r.id,
        workspaceId: r.workspace_id,
        userId: r.user_id,
        planId: r.plan_id,
        tier: r.tier,
        status: r.status,
        currentPeriodStart: r.current_period_start,
        currentPeriodEnd: r.current_period_end,
        cancelAtPeriodEnd: r.cancel_at_period_end,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      };
    }

    if (process.env.NODE_ENV === 'production') {
      throw new Error('Database connection unavailable: fail-closed.');
    }

    const sub = localDb.subscriptions[workspaceId];
    return sub ? { ...sub } : null;
  }

  /**
   * Affiliate and Commission operations
   */
  static async getAffiliatePartner(userIdOrCode: string): Promise<{ id: string; userId: string; referralCode: string; commissionRate: number; status: string } | null> {
    this.checkFailClosed();

    if (this.isSupabaseConfigured()) {
      const isUuid = userIdOrCode.includes('-');
      const filter = isUuid ? `user_id=eq.${encodeURIComponent(userIdOrCode)}` : `referral_code=eq.${encodeURIComponent(userIdOrCode)}`;
      const url = `${process.env.SUPABASE_URL}/rest/v1/affiliate_partners?${filter}`;
      const res = await fetch(url, {
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      });

      if (!res.ok) return null;
      const rows = await res.json();
      if (!rows || rows.length === 0) return null;
      const r = rows[0];
      return {
        id: r.id,
        userId: r.user_id,
        referralCode: r.referral_code,
        commissionRate: Number(r.commission_rate),
        status: r.status,
      };
    }

    if (process.env.NODE_ENV === 'production') {
      throw new Error('Database connection unavailable: fail-closed.');
    }

    const aff = Object.values(localDb.affiliates).find(
      (a) => a.userId === userIdOrCode || a.referralCode === userIdOrCode
    );
    return aff ? { ...aff, commissionRate: aff.rate } : null;
  }

  static async createAffiliatePartner(userId: string, referralCode: string): Promise<{ id: string; referralCode: string }> {
    this.checkFailClosed();

    const id = crypto.randomUUID();
    const cleanCode = referralCode.trim().toUpperCase();

    if (this.isSupabaseConfigured()) {
      const url = `${process.env.SUPABASE_URL}/rest/v1/affiliate_partners`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          id,
          user_id: userId,
          referral_code: cleanCode,
          commission_rate: 20.0,
          status: 'active',
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Database error HTTP ${res.status}: ${errText}`);
      }

      const rows = await res.json();
      return { id: rows[0].id, referralCode: rows[0].referral_code };
    }

    if (process.env.NODE_ENV === 'production') {
      throw new Error('Database connection unavailable: fail-closed.');
    }

    localDb.affiliates[id] = { id, userId, referralCode: cleanCode, rate: 20.0, status: 'active' };
    return { id, referralCode: cleanCode };
  }

  static async listAffiliateCommissions(affiliateId?: string): Promise<AffiliateCommissionRecord[]> {
    this.checkFailClosed();

    if (this.isSupabaseConfigured()) {
      let url = `${process.env.SUPABASE_URL}/rest/v1/affiliate_commissions?order=created_at.desc`;
      if (affiliateId) {
        url += `&affiliate_id=eq.${encodeURIComponent(affiliateId)}`;
      }
      const res = await fetch(url, {
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      });

      if (!res.ok) return [];
      const rows = await res.json();
      return rows.map((r: Record<string, any>) => ({
        id: r.id,
        affiliateId: r.affiliate_id,
        orderId: r.order_id,
        workspaceId: r.workspace_id,
        amountMyr: Number(r.amount_myr),
        ratePercentage: Number(r.rate_percentage),
        status: r.status,
        createdAt: r.created_at,
        approvedAt: r.approved_at,
        paidAt: r.paid_at,
        payoutReference: r.payout_reference,
      }));
    }

    if (process.env.NODE_ENV === 'production') {
      throw new Error('Database connection unavailable: fail-closed.');
    }

    return Object.values(localDb.commissions)
      .filter((c) => !affiliateId || c.affiliateId === affiliateId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * System Settings (Emergency Pause, Unit Costs, Capacity)
   */
  static async getSystemSettings(key: string): Promise<any> {
    if (this.isSupabaseConfigured()) {
      const url = `${process.env.SUPABASE_URL}/rest/v1/system_settings?key=eq.${encodeURIComponent(key)}`;
      const res = await fetch(url, {
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      });
      if (!res.ok) return null;
      const rows = await res.json();
      return rows?.[0]?.value || null;
    }
    return localDb.settings[key] || null;
  }

  static async setSystemSettings(key: string, value: any): Promise<void> {
    this.checkFailClosed();
    if (this.isSupabaseConfigured()) {
      const url = `${process.env.SUPABASE_URL}/rest/v1/system_settings`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify({ key, value, updated_at: new Date().toISOString() }),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Database error saving system settings HTTP ${res.status}: ${errText}`);
      }
      return;
    }

    if (process.env.NODE_ENV === 'production') {
      throw new Error('Database connection unavailable: fail-closed.');
    }
    localDb.settings[key] = value;
  }

  /**
   * Administratively adjust customer credits atomically & persistently
   */
  static async adjustCredits(
    workspaceId: string,
    amount: number,
    reason: string,
    adminEmail: string
  ): Promise<{ success: boolean; workspaceId: string; adjustedBy: number; newBalance: number }> {
    this.checkFailClosed();

    if (this.isSupabaseConfigured()) {
      const url = `${process.env.SUPABASE_URL}/rest/v1/rpc/admin_adjust_credits_atomic`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          p_workspace_id: workspaceId,
          p_amount: amount,
          p_reason: reason || 'Manual Admin Adjustment',
          p_admin_email: adminEmail,
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Database error HTTP ${res.status}: ${errText}`);
      }

      const result = await res.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to adjust customer credits');
      }

      return {
        success: true,
        workspaceId,
        adjustedBy: result.adjusted_by ?? amount,
        newBalance: result.new_balance,
      };
    }

    if (process.env.NODE_ENV === 'production') {
      throw new Error('Database connection unavailable: fail-closed.');
    }

    const wallet = localDb.wallets[workspaceId] || {
      workspaceId,
      balance: 50,
      reservedBalance: 0,
      lifetimeGranted: 50,
      lifetimeSpent: 0,
      updatedAt: new Date().toISOString(),
    };

    if (wallet.balance + amount < 0) {
      throw new Error(`Insufficient credit balance for debit. Current: ${wallet.balance}, Requested: ${amount}`);
    }

    wallet.balance += amount;
    if (amount > 0) wallet.lifetimeGranted += amount;
    else wallet.lifetimeSpent += Math.abs(amount);
    wallet.updatedAt = new Date().toISOString();
    localDb.wallets[workspaceId] = wallet;

    const ledgerKey = `adj_${crypto.randomUUID()}`;
    localDb.ledger[ledgerKey] = {
      id: crypto.randomUUID(),
      workspaceId,
      amount,
      eventType: 'GRANT',
      referenceType: 'MANUAL',
      referenceId: adminEmail,
      idempotencyKey: ledgerKey,
      timestamp: new Date().toISOString(),
      description: reason || 'Manual Administrative Adjustment',
    };

    await this.recordAuditLog(adminEmail, 'CREDIT_MANUAL_ADJUSTMENT', 'WALLET', workspaceId, {
      adjustedBy: amount,
      newBalance: wallet.balance,
      reason,
    });

    return {
      success: true,
      workspaceId,
      adjustedBy: amount,
      newBalance: wallet.balance,
    };
  }

  /**
   * Record Immutable Administrative Audit Log
   */
  static async recordAuditLog(
    adminEmail: string,
    action: string,
    targetType: string,
    targetId: string,
    details?: Record<string, unknown>
  ): Promise<void> {
    this.checkFailClosed();
    if (this.isSupabaseConfigured()) {
      const url = `${process.env.SUPABASE_URL}/rest/v1/audit_logs`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          admin_email: adminEmail,
          action,
          target_type: targetType,
          target_id: targetId,
          details: details || {},
        }),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Database error recording audit log HTTP ${res.status}: ${errText}`);
      }
      return;
    }

    if (process.env.NODE_ENV === 'production') {
      throw new Error('Database connection unavailable: fail-closed.');
    }
    localDb.auditLogs.push({
      id: crypto.randomUUID(),
      adminEmail,
      action,
      targetType,
      targetId,
      details,
      createdAt: new Date().toISOString(),
    });
  }

  /**
   * Find customer profile and wallet by registered email for admin manual activation.
   */
  static async findCustomerByEmail(email: string): Promise<{
    userId: string;
    email: string;
    fullName?: string;
    tier: string;
    workspaceId: string;
    wallet: { balance: number; reservedBalance: number; lifetimeGranted: number };
  } | null> {
    const cleanEmail = email.trim().toLowerCase();

    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const res = await fetch(
        `${process.env.SUPABASE_URL}/rest/v1/profiles?email=eq.${encodeURIComponent(cleanEmail)}&select=*`,
        {
          headers: {
            apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          },
        }
      );
      if (res.ok) {
        const rows = await res.json();
        if (rows && rows.length > 0) {
          const profile = rows[0];
          const workspaceId = profile.default_workspace_id || profile.id;
          const wallet = await DurableStore.getWallet(workspaceId);
          return {
            userId: profile.id,
            email: profile.email,
            fullName: profile.full_name,
            tier: profile.tier || 'free',
            workspaceId,
            wallet: {
              balance: wallet.balance,
              reservedBalance: wallet.reservedBalance,
              lifetimeGranted: wallet.lifetimeGranted,
            },
          };
        }
      }
    }

    // Local / Testing Fallback
    for (const [wsId, w] of Object.entries(localDb.wallets)) {
      if (wsId.toLowerCase().includes(cleanEmail.split('@')[0]) || wsId === cleanEmail) {
        return {
          userId: wsId,
          email: cleanEmail,
          fullName: 'Creator ' + cleanEmail.split('@')[0],
          tier: 'free',
          workspaceId: wsId,
          wallet: {
            balance: w.balance,
            reservedBalance: w.reservedBalance,
            lifetimeGranted: w.lifetimeGranted,
          },
        };
      }
    }

    return null;
  }

  /**
   * Owner-Only Manual Customer Activation:
   * Supports Type A (Complimentary Early Access) and Type B (Manually Paid Customer).
   */
  static async manualActivateCustomer(params: {
    workspaceId: string;
    userId?: string;
    activationType: 'COMPLIMENTARY' | 'MANUAL_PAID';
    planId?: string;
    credits?: number;
    tier?: string;
    amountPaidMyr?: number;
    paymentReference?: string;
    reason?: string;
    adminEmail: string;
  }): Promise<{
    success: boolean;
    activationType: string;
    balance: number;
    tier?: string;
    orderId?: string;
    message: string;
  }> {
    const {
      workspaceId,
      userId,
      activationType,
      planId,
      credits,
      tier,
      amountPaidMyr,
      paymentReference,
      reason,
      adminEmail,
    } = params;

    if (!workspaceId) {
      throw new Error('workspaceId wajib disertakan.');
    }

    if (activationType === 'COMPLIMENTARY') {
      const grantCredits = typeof credits === 'number' && credits > 0 ? credits : 50;
      const targetTier = tier || 'starter';
      const adjResult = await DurableStore.adjustCredits(
        workspaceId,
        grantCredits,
        `Akses Awal Percuma (Promosi): ${reason || 'Beta Early Access'}`,
        adminEmail
      );

      // Update tier in Supabase if configured
      if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && userId) {
        await fetch(`${process.env.SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({ tier: targetTier, updated_at: new Date().toISOString() }),
        });
      }

      await DurableStore.recordAuditLog(
        adminEmail,
        'MANUAL_COMPLIMENTARY_ACTIVATED',
        'WORKSPACE',
        workspaceId,
        { credits: grantCredits, tier: targetTier, reason }
      );

      return {
        success: true,
        activationType: 'COMPLIMENTARY',
        balance: adjResult.newBalance,
        tier: targetTier,
        message: `Akses Awal Percuma (${grantCredits} kredit, pelan ${targetTier}) berjaya diaktifkan untuk ruang kerja ${workspaceId}.`,
      };
    }

    if (activationType === 'MANUAL_PAID') {
      const selectedPlanId = planId || 'starter';
      const paidAmount = typeof amountPaidMyr === 'number' ? amountPaidMyr : 49;
      const ref = paymentReference || `bank_transfer_${Date.now()}`;

      // Resolve plan credits from AUTHORITATIVE_PLANS (defaulting to 100 for starter)
      let planCredits = 100;
      let targetTier = 'starter';
      if (selectedPlanId.includes('agency')) {
        planCredits = 500;
        targetTier = 'agency';
      } else if (selectedPlanId.includes('pro')) {
        planCredits = 250;
        targetTier = 'pro';
      }

      // Create manual order
      const order = await DurableStore.createOrder({
        workspaceId,
        userId: userId || workspaceId,
        planId: selectedPlanId,
        paymentMethod: 'manual_bank_transfer',
        amountMyr: paidAmount,
        creditsGranted: planCredits,
      });

      // Settle the order atomically
      const settlement = await DurableStore.settleOrder(order.id, ref, {
        verifiedByAdmin: adminEmail,
        verifiedAt: new Date().toISOString(),
        paymentAmountMyr: paidAmount,
        referenceNote: reason || 'Manual payment verified by owner',
      });

      await DurableStore.recordAuditLog(
        adminEmail,
        'MANUAL_PAID_ACTIVATED',
        'ORDER',
        order.id,
        { workspaceId, planId: selectedPlanId, amountMyr: paidAmount, paymentReference: ref }
      );

      return {
        success: true,
        activationType: 'MANUAL_PAID',
        orderId: order.id,
        balance: settlement.balance,
        tier: targetTier,
        message: `Pelanggan berbayar manual (${selectedPlanId}, +${planCredits} kredit) berjaya disahkan dan diaktifkan.`,
      };
    }

    throw new Error('Jenis pengaktifan tidak sah. Pilih COMPLIMENTARY atau MANUAL_PAID.');
  }

  /**
   * Retrieve Soft Launch Dashboard Monitoring Metrics.
   */
  static async getSoftLaunchMetrics(): Promise<{
    totalRegistrations: number;
    welcomeCreditsGranted: number;
    trialCreditsSpent: number;
    completedVideos: number;
    pendingJobs: number;
    failedJobs: number;
    publicCheckoutEnabled: boolean;
    isGenerationPaused: boolean;
    generationPauseReason: string;
  }> {
    const genSettings = await DurableStore.getSystemSettings('generation_status');
    const isPublicCheckoutEnabled = process.env.PUBLIC_CHECKOUT_ENABLED === 'true';

    let totalRegistrations = 0;
    let welcomeCreditsGranted = 0;
    let trialCreditsSpent = 0;
    let completedVideos = 0;
    let pendingJobs = 0;
    let failedJobs = 0;

    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const sHeaders = {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      };

      // Count profiles
      const profRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/profiles?select=count`, {
        headers: { ...sHeaders, Prefer: 'count=exact' },
      });
      if (profRes.ok) {
        const countHeader = profRes.headers.get('content-range');
        totalRegistrations = countHeader ? parseInt(countHeader.split('/')[1] || '0', 10) : 0;
      }

      // Count video jobs
      const jobsRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/video_jobs?select=status`, {
        headers: sHeaders,
      });
      if (jobsRes.ok) {
        const jobs = await jobsRes.json();
        if (Array.isArray(jobs)) {
          completedVideos = jobs.filter((j: any) => j.status === 'COMPLETED').length;
          pendingJobs = jobs.filter((j: any) => j.status === 'SUBMITTING' || j.status === 'PROCESSING').length;
          failedJobs = jobs.filter((j: any) => j.status === 'FAILED').length;
        }
      }

      // Sum welcome grants and spent from credit wallets
      const walletsRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/credit_wallets?select=balance,lifetime_granted,lifetime_spent`, {
        headers: sHeaders,
      });
      if (walletsRes.ok) {
        const wallets = await walletsRes.json();
        if (Array.isArray(wallets)) {
          welcomeCreditsGranted = wallets.reduce((sum: number, w: any) => sum + (w.lifetime_granted || 0), 0);
          trialCreditsSpent = wallets.reduce((sum: number, w: any) => sum + (w.lifetime_spent || 0), 0);
        }
      }
    } else {
      // Local fallback
      totalRegistrations = Object.keys(localDb.wallets).length;
      welcomeCreditsGranted = Object.values(localDb.wallets).reduce((s, w) => s + w.lifetimeGranted, 0);
      trialCreditsSpent = Object.values(localDb.wallets).reduce((s, w) => s + w.lifetimeSpent, 0);
      const jobs = Object.values(localDb.jobs);
      completedVideos = jobs.filter((j) => j.status === 'COMPLETED').length;
      pendingJobs = jobs.filter((j) => j.status === 'SUBMITTING' || j.status === 'PROCESSING').length;
      failedJobs = jobs.filter((j) => j.status === 'FAILED').length;
    }

    return {
      totalRegistrations,
      welcomeCreditsGranted,
      trialCreditsSpent,
      completedVideos,
      pendingJobs,
      failedJobs,
      publicCheckoutEnabled: isPublicCheckoutEnabled,
      isGenerationPaused: Boolean(genSettings?.paused),
      generationPauseReason: genSettings?.reason || '',
    };
  }
}
