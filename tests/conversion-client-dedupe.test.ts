import { afterEach, describe, expect, it, vi } from 'vitest';
import { trackConversion } from '../src/lib/analytics/conversion';

afterEach(() => vi.unstubAllGlobals());

describe('client conversion event dedupe', () => {
  it('retries an event that the server accepted but did not record', async () => {
    const values = new Map<string, string>();
    vi.stubGlobal('window', {
      sessionStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      },
    });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ status: 202, ok: true })
      .mockResolvedValueOnce({ status: 201, ok: true });
    vi.stubGlobal('fetch', fetchMock);

    trackConversion('landing_view', 'home');
    await vi.waitFor(() => expect(values.size).toBe(0));
    trackConversion('landing_view', 'home');
    await vi.waitFor(() => expect(values.get('affimatik:event:landing_view:home')).toBe('sent'));
    trackConversion('landing_view', 'home');

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
