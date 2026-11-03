export interface CreditWallet {
  workspaceId: string;
  balance: number;
  reservedBalance: number;
}

export interface CreditLedgerEntry {
  id: string;
  workspaceId: string;
  amount: number;
  eventType: 'GRANT' | 'RESERVE' | 'SETTLE' | 'RELEASE' | 'REFUND' | 'MANUAL_ADJUSTMENT';
  referenceType: 'BATCH' | 'VIDEO_JOB' | 'SUBSCRIPTION' | 'TOP_UP';
  referenceId: string;
  idempotencyKey: string;
  timestamp: string;
  description: string;
}

export class CreditManager {
  private ledger: Map<string, CreditLedgerEntry> = new Map();
  private wallets: Map<string, CreditWallet> = new Map();

  constructor(initialWallets: CreditWallet[] = []) {
    for (const w of initialWallets) {
      this.wallets.set(w.workspaceId, { ...w });
    }
  }

  getWallet(workspaceId: string): CreditWallet {
    if (!this.wallets.has(workspaceId)) {
      this.wallets.set(workspaceId, {
        workspaceId,
        balance: 10, // Initial free tier credits
        reservedBalance: 0,
      });
    }
    return this.wallets.get(workspaceId)!;
  }

  reserveCredits(
    workspaceId: string,
    jobId: string,
    amount: number,
    idempotencyKey: string
  ): { success: boolean; error?: string } {
    if (this.ledger.has(idempotencyKey)) {
      return { success: true }; // Idempotent success
    }

    const wallet = this.getWallet(workspaceId);
    const available = wallet.balance - wallet.reservedBalance;

    if (available < amount) {
      return {
        success: false,
        error: `Insufficient available credits. Required: ${amount}, Available: ${available}`,
      };
    }

    wallet.reservedBalance += amount;

    const entry: CreditLedgerEntry = {
      id: `ledger_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      workspaceId,
      amount: -amount,
      eventType: 'RESERVE',
      referenceType: 'VIDEO_JOB',
      referenceId: jobId,
      idempotencyKey,
      timestamp: new Date().toISOString(),
      description: `Reserved ${amount} credits for job ${jobId}`,
    };

    this.ledger.set(idempotencyKey, entry);
    return { success: true };
  }

  settleCredits(
    workspaceId: string,
    jobId: string,
    amount: number,
    idempotencyKey: string
  ): { success: boolean; error?: string } {
    if (this.ledger.has(idempotencyKey)) {
      return { success: true };
    }

    const wallet = this.getWallet(workspaceId);
    if (wallet.reservedBalance < amount) {
      return { success: false, error: 'Cannot settle more credits than reserved' };
    }

    wallet.reservedBalance -= amount;
    wallet.balance -= amount;

    const entry: CreditLedgerEntry = {
      id: `ledger_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      workspaceId,
      amount: -amount,
      eventType: 'SETTLE',
      referenceType: 'VIDEO_JOB',
      referenceId: jobId,
      idempotencyKey,
      timestamp: new Date().toISOString(),
      description: `Settled ${amount} credits on verified video completion`,
    };

    this.ledger.set(idempotencyKey, entry);
    return { success: true };
  }

  releaseCredits(
    workspaceId: string,
    jobId: string,
    amount: number,
    idempotencyKey: string,
    reason: string
  ): { success: boolean } {
    if (this.ledger.has(idempotencyKey)) {
      return { success: true };
    }

    const wallet = this.getWallet(workspaceId);
    const releaseAmount = Math.min(wallet.reservedBalance, amount);
    wallet.reservedBalance -= releaseAmount;

    const entry: CreditLedgerEntry = {
      id: `ledger_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      workspaceId,
      amount: releaseAmount,
      eventType: 'RELEASE',
      referenceType: 'VIDEO_JOB',
      referenceId: jobId,
      idempotencyKey,
      timestamp: new Date().toISOString(),
      description: `Released ${releaseAmount} reserved credits: ${reason}`,
    };

    this.ledger.set(idempotencyKey, entry);
    return { success: true };
  }

  getLedgerHistory(workspaceId: string): CreditLedgerEntry[] {
    return Array.from(this.ledger.values()).filter(e => e.workspaceId === workspaceId);
  }
}
