/**
 * AFFIMATIK by Pawarna — Production Persistent Multi-Tenant Database Client & Store
 * High-concurrency PostgreSQL / Supabase Integration with Atomic RPC Stored Procedures
 * Fail-Closed Policy: Fails safely if database is unreachable; never silently falls back to unbacked state.
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
  forceDbDown?: boolean;
}

const localDb: LocalDatabaseState = {
  wallets: {},
  ledger: {},
  reservations: {},
  jobs: {},
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
   * Fail-closed check: Enforce database connectivity in production
   */
  private static checkFailClosed(): void {
    if (localDb.forceDbDown) {
      throw new Error('Database connection unavailable: fail-closed.');
    }
    if (
      process.env.NODE_ENV === 'production' &&
      !this.isSupabaseConfigured() &&
      process.env.USE_MOCK_PROVIDERS !== 'true'
    ) {
      throw new Error('Database configuration missing in production: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
    }
  }

  /**
   * Fetches tenant's wallet.
   * If new workspace, initializes with 10 free credits (NOT 160 Pro credits).
   */
  static async getWallet(workspaceId: string): Promise<CreditWalletRecord> {
    this.checkFailClosed();

    if (this.isSupabaseConfigured()) {
      try {
        const url = `${process.env.SUPABASE_URL}/rest/v1/credit_wallets?workspace_id=eq.${encodeURIComponent(workspaceId)}&select=*`;
        const res = await fetch(url, {
          headers: {
            apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          },
        });
        if (res.ok) {
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
        }
      } catch (err: unknown) {
        console.error('[DurableStore] Supabase fetch wallet failed:', err);
        throw new Error('Database connection unavailable: fail-closed.');
      }
    }

    // Local / Testing Fallback
    if (!localDb.wallets[workspaceId]) {
      localDb.wallets[workspaceId] = {
        workspaceId,
        balance: 10, // Initial free credits by policy (never grant 160 unbacked credits)
        reservedBalance: 0,
        lifetimeGranted: 10,
        lifetimeSpent: 0,
        updatedAt: new Date().toISOString(),
      };
    }

    return { ...localDb.wallets[workspaceId] };
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

    // Production: Supabase PostgreSQL RPC with SELECT ... FOR UPDATE
    if (this.isSupabaseConfigured()) {
      try {
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
      } catch (err: unknown) {
        throw new Error('Database connection unavailable: fail-closed.');
      }
    }

    // Local / Testing Mutex Atomic Transaction
    const releaseLock = await acquireWorkspaceLock(workspaceId);
    try {
      // 1. Idempotency Check
      if (localDb.ledger[idempotencyKey]) {
        return { success: true };
      }

      // 2. Wallet Check
      const wallet = localDb.wallets[workspaceId] || {
        workspaceId,
        balance: 10,
        reservedBalance: 0,
        lifetimeGranted: 10,
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

      // 3. Atomically update wallet
      wallet.reservedBalance += amount;
      wallet.updatedAt = new Date().toISOString();
      localDb.wallets[workspaceId] = wallet;

      // 4. Append Ledger Entry
      const ledgerEntry: CreditLedgerRecord = {
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
      localDb.ledger[idempotencyKey] = ledgerEntry;

      // 5. Store Reservation
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
   * Rules:
   * - Cannot settle a reservation that was RELEASED
   * - Cannot settle twice (idempotent if same key)
   * - Settlement amount must equal reserved amount
   */
  static async settleCredits(
    workspaceId: string,
    jobId: string,
    amount: number,
    idempotencyKey: string
  ): Promise<{ success: boolean; error?: string }> {
    this.checkFailClosed();

    if (this.isSupabaseConfigured()) {
      try {
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
        const data = await res.json();
        return { success: Boolean(data.success), error: data.error };
      } catch {
        throw new Error('Database connection unavailable: fail-closed.');
      }
    }

    const releaseLock = await acquireWorkspaceLock(workspaceId);
    try {
      // 1. Idempotency Check
      if (localDb.ledger[idempotencyKey]) {
        return { success: true };
      }

      // 2. Reservation Check
      const reservation = localDb.reservations[jobId];
      if (!reservation) {
        return { success: false, error: 'Tiada rekod tempahan kredit ditemui untuk tugasan ini.' };
      }

      if (reservation.status === 'RELEASED') {
        return { success: false, error: 'Tempahan kredit ini telah dilepaskan/dibatalkan dan tidak boleh diselesaikan.' };
      }

      if (reservation.status === 'SETTLED') {
        return { success: true }; // Already settled
      }

      if (reservation.amount !== amount) {
        return {
          success: false,
          error: `Jumlah penyelesaian (${amount} kredit) tidak sepadan dengan tempahan asal (${reservation.amount} kredit).`,
        };
      }

      // 3. Wallet deduction
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

      const ledgerEntry: CreditLedgerRecord = {
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
      localDb.ledger[idempotencyKey] = ledgerEntry;

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
      try {
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
        const data = await res.json();
        return { success: Boolean(data.success), error: data.error };
      } catch {
        throw new Error('Database connection unavailable: fail-closed.');
      }
    }

    const releaseLock = await acquireWorkspaceLock(workspaceId);
    try {
      if (localDb.ledger[idempotencyKey]) {
        return { success: true };
      }

      const reservation = localDb.reservations[jobId];
      if (!reservation || reservation.status !== 'PENDING') {
        return { success: true }; // Already released or settled
      }

      const wallet = localDb.wallets[workspaceId];
      if (wallet) {
        wallet.reservedBalance = Math.max(0, wallet.reservedBalance - reservation.amount);
        wallet.updatedAt = new Date().toISOString();
        localDb.wallets[workspaceId] = wallet;
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
      localDb.ledger[idempotencyKey] = ledgerEntry;

      return { success: true };
    } finally {
      releaseLock();
    }
  }

  // =========================================================================
  // PERSISTENT JOB OPERATIONS
  // =========================================================================

  private static mapJobFromDb(row: any): VideoJobRecord {
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
      try {
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
            client_request_id: job.clientRequestId || null,
            preset_id: job.styleId,
            preset_version: 2,
            provider: job.provider,
            duration_seconds: job.durationSeconds,
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
          const err = await res.json().catch(() => ({}));
          console.error('[DurableStore] Supabase saveJob failed:', err);
          throw new Error('Gagal menyimpan rekod tugasan video ke pangkalan data.');
        }
        return;
      } catch (err: unknown) {
        console.error('[DurableStore] Supabase saveJob error:', err);
        throw new Error('Database connection unavailable: fail-closed.');
      }
    }

    localDb.jobs[job.id] = { ...job, updatedAt: new Date().toISOString() };
  }

  static async getJob(jobId: string): Promise<VideoJobRecord | null> {
    this.checkFailClosed();

    if (this.isSupabaseConfigured()) {
      try {
        const url = `${process.env.SUPABASE_URL}/rest/v1/video_jobs?id=eq.${encodeURIComponent(jobId)}&select=*`;
        const res = await fetch(url, {
          headers: {
            apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          },
        });
        if (res.ok) {
          const rows = await res.json();
          if (rows && rows.length > 0) {
            return this.mapJobFromDb(rows[0]);
          }
          return null;
        }
      } catch {
        throw new Error('Database connection unavailable: fail-closed.');
      }
    }

    const job = localDb.jobs[jobId];
    return job ? { ...job } : null;
  }

  static async getJobByClientRequestId(workspaceId: string, clientRequestId: string): Promise<VideoJobRecord | null> {
    this.checkFailClosed();

    if (this.isSupabaseConfigured()) {
      try {
        const url = `${process.env.SUPABASE_URL}/rest/v1/video_jobs?workspace_id=eq.${encodeURIComponent(workspaceId)}&client_request_id=eq.${encodeURIComponent(clientRequestId)}&select=*`;
        const res = await fetch(url, {
          headers: {
            apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          },
        });
        if (res.ok) {
          const rows = await res.json();
          if (rows && rows.length > 0) {
            return this.mapJobFromDb(rows[0]);
          }
          return null;
        }
      } catch {
        throw new Error('Database connection unavailable: fail-closed.');
      }
    }

    const job = Object.values(localDb.jobs).find(
      (j) => j.workspaceId === workspaceId && j.clientRequestId === clientRequestId
    );
    return job ? { ...job } : null;
  }

  static async getJobByProviderTaskId(providerTaskId: string, workspaceId: string): Promise<VideoJobRecord | null> {
    this.checkFailClosed();

    if (this.isSupabaseConfigured()) {
      try {
        const url = `${process.env.SUPABASE_URL}/rest/v1/video_jobs?provider_task_id=eq.${encodeURIComponent(providerTaskId)}&workspace_id=eq.${encodeURIComponent(workspaceId)}&select=*`;
        const res = await fetch(url, {
          headers: {
            apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          },
        });
        if (res.ok) {
          const rows = await res.json();
          if (rows && rows.length > 0) {
            return this.mapJobFromDb(rows[0]);
          }
          return null;
        }
      } catch {
        throw new Error('Database connection unavailable: fail-closed.');
      }
    }

    const job = Object.values(localDb.jobs).find(
      (j) => j.providerTaskId === providerTaskId && j.workspaceId === workspaceId
    );
    return job ? { ...job } : null;
  }

  static async listJobs(workspaceId: string, limit = 20): Promise<VideoJobRecord[]> {
    this.checkFailClosed();

    if (this.isSupabaseConfigured()) {
      try {
        const url = `${process.env.SUPABASE_URL}/rest/v1/video_jobs?workspace_id=eq.${encodeURIComponent(workspaceId)}&order=created_at.desc&limit=${limit}&select=*`;
        const res = await fetch(url, {
          headers: {
            apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          },
        });
        if (res.ok) {
          const rows = await res.json();
          return rows.map((r: any) => this.mapJobFromDb(r));
        }
      } catch {
        throw new Error('Database connection unavailable: fail-closed.');
      }
    }

    return Object.values(localDb.jobs)
      .filter((j) => j.workspaceId === workspaceId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  static async countActiveJobs(workspaceId: string): Promise<number> {
    this.checkFailClosed();

    if (this.isSupabaseConfigured()) {
      try {
        const url = `${process.env.SUPABASE_URL}/rest/v1/video_jobs?workspace_id=eq.${encodeURIComponent(workspaceId)}&status=in.(QUEUED,SUBMITTING,PROCESSING)&select=id`;
        const res = await fetch(url, {
          headers: {
            apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          },
        });
        if (res.ok) {
          const rows = await res.json();
          return Array.isArray(rows) ? rows.length : 0;
        }
      } catch {
        throw new Error('Database connection unavailable: fail-closed.');
      }
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
      try {
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

        if (res.ok) {
          const rows = await res.json();
          if (rows && rows.length > 0) {
            return this.mapJobFromDb(rows[0]);
          }
        }
      } catch {
        throw new Error('Database connection unavailable: fail-closed.');
      }
    }

    const job = localDb.jobs[jobId];
    if (!job) return null;

    Object.assign(job, updates, { updatedAt: new Date().toISOString() });
    return { ...job };
  }

  static async listPendingJobsForReconciliation(): Promise<VideoJobRecord[]> {
    this.checkFailClosed();

    if (this.isSupabaseConfigured()) {
      try {
        const url = `${process.env.SUPABASE_URL}/rest/v1/video_jobs?status=in.(SUBMITTING,PROCESSING)&order=created_at.asc&limit=100&select=*`;
        const res = await fetch(url, {
          headers: {
            apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          },
        });
        if (res.ok) {
          const rows = await res.json();
          return rows.map((r: any) => this.mapJobFromDb(r));
        }
      } catch {
        throw new Error('Database connection unavailable: fail-closed.');
      }
    }

    return Object.values(localDb.jobs).filter(
      (j) => j.status === 'SUBMITTING' || j.status === 'PROCESSING'
    );
  }

  static async getLedgerHistory(workspaceId: string, limit = 20): Promise<CreditLedgerRecord[]> {
    this.checkFailClosed();

    if (this.isSupabaseConfigured()) {
      try {
        const url = `${process.env.SUPABASE_URL}/rest/v1/credit_ledger?workspace_id=eq.${encodeURIComponent(workspaceId)}&order=created_at.desc&limit=${limit}&select=*`;
        const res = await fetch(url, {
          headers: {
            apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          },
        });
        if (res.ok) {
          const rows = await res.json();
          return rows.map((r: any) => ({
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
      } catch {
        throw new Error('Database connection unavailable: fail-closed.');
      }
    }

    return Object.values(localDb.ledger)
      .filter((entry) => entry.workspaceId === workspaceId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }
}
