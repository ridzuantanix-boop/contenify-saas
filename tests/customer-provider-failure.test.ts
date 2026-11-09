import { describe, expect, it } from 'vitest';
import { customerFailureMessage, describeCustomerFailure } from '@/lib/jobs/customer-failure';

describe('customer-safe provider failure messaging', () => {
  it('explains a provider outage without exposing the vendor name', () => {
    const failure = describeCustomerFailure('Nexabot query failed (HTTP 504): gateway timeout');
    expect(failure.category).toBe('provider_unavailable');
    expect(failure.headline).toBe('Pelayan AI Sedang Terganggu');
    expect(JSON.stringify(failure)).not.toContain('Nexabot');
    expect(failure.creditNotice).toContain('dipulangkan secara automatik');
  });

  it('does not falsely call a generic failed result a confirmed server outage', () => {
    const failure = describeCustomerFailure('failed');
    expect(failure.category).toBe('generation_failed');
    expect(failure.message).toContain('boleh berlaku');
    expect(failure.message).not.toContain('pasti');
  });

  it('preserves the outage category when reading a stored customer-safe message', () => {
    const stored = customerFailureMessage('HTTP 503 upstream unavailable');
    expect(describeCustomerFailure(stored).category).toBe('provider_unavailable');
  });

  it('gives a clear credit-safe media validation result', () => {
    const message = customerFailureMessage('Video tersimpan tidak lengkap.');
    expect(message).toContain('Video Diterima Tetapi Tidak Lengkap');
    expect(message).toContain('tidak akan mengenakan kredit');
  });
});
