import { describe, it, expect } from 'vitest';
import { JobStateMachine } from '../src/lib/orchestration/state-machine';
import { CreditManager } from '../src/lib/orchestration/credit-manager';

describe('Job State Machine', () => {
  it('allows valid progressive pipeline transitions', () => {
    const t1 = JobStateMachine.transition('DRAFT', 'VALIDATING', { jobId: 'job_1' });
    expect(t1.toStatus).toBe('VALIDATING');

    const t2 = JobStateMachine.transition('VALIDATING', 'QUEUED', { jobId: 'job_1' });
    expect(t2.toStatus).toBe('QUEUED');

    const t3 = JobStateMachine.transition('QUEUED', 'SUBMITTING', { jobId: 'job_1' });
    expect(t3.toStatus).toBe('SUBMITTING');

    const t4 = JobStateMachine.transition('SUBMITTING', 'GENERATING', { jobId: 'job_1' });
    expect(t4.toStatus).toBe('GENERATING');

    const t5 = JobStateMachine.transition('GENERATING', 'PROCESSING', { jobId: 'job_1' });
    expect(t5.toStatus).toBe('PROCESSING');

    const t6 = JobStateMachine.transition('PROCESSING', 'QUALITY_CHECK', { jobId: 'job_1' });
    expect(t6.toStatus).toBe('QUALITY_CHECK');

    const t7 = JobStateMachine.transition('QUALITY_CHECK', 'QA_PENDING', { jobId: 'job_1' });
    expect(t7.toStatus).toBe('QA_PENDING');
    expect(JobStateMachine.transition('QA_PENDING', 'COMPLETED', { jobId: 'job_1' }).toStatus).toBe('COMPLETED');
    expect(JobStateMachine.transition('QA_PENDING', 'REJECTED', { jobId: 'job_2' }).toStatus).toBe('REJECTED');
  });

  it('rejects invalid or backwards transitions', () => {
    expect(() => {
      JobStateMachine.transition('DRAFT', 'COMPLETED', { jobId: 'job_2' });
    }).toThrow(/Invalid state transition/);

    expect(() => {
      JobStateMachine.transition('COMPLETED', 'QUEUED', { jobId: 'job_2' });
    }).toThrow(/Invalid state transition/);
  });
});

describe('Credit Manager & Ledger', () => {
  it('manages reservations, settlements, and idempotency', () => {
    const cm = new CreditManager([{ workspaceId: 'ws_test', balance: 50, reservedBalance: 0 }]);

    // 1. Reserve 10 credits
    const res1 = cm.reserveCredits('ws_test', 'job_1', 10, 'idem_res_1');
    expect(res1.success).toBe(true);

    const walletAfterRes = cm.getWallet('ws_test');
    expect(walletAfterRes.balance).toBe(50);
    expect(walletAfterRes.reservedBalance).toBe(10);

    // 2. Idempotent re-request
    const resDuplicate = cm.reserveCredits('ws_test', 'job_1', 10, 'idem_res_1');
    expect(resDuplicate.success).toBe(true);
    expect(cm.getWallet('ws_test').reservedBalance).toBe(10); // unchanged

    // 3. Settle on completion
    const settleRes = cm.settleCredits('ws_test', 'job_1', 10, 'idem_settle_1');
    expect(settleRes.success).toBe(true);

    const walletAfterSettle = cm.getWallet('ws_test');
    expect(walletAfterSettle.balance).toBe(40);
    expect(walletAfterSettle.reservedBalance).toBe(0);

    // 4. Ledger history
    const history = cm.getLedgerHistory('ws_test');
    expect(history.length).toBe(2);
  });

  it('rejects reservation when balance is insufficient', () => {
    const cm = new CreditManager([{ workspaceId: 'ws_broke', balance: 5, reservedBalance: 0 }]);
    const res = cm.reserveCredits('ws_broke', 'job_too_expensive', 15, 'idem_fail');
    expect(res.success).toBe(false);
    expect(res.error).toContain('Insufficient available credits');
  });
});
