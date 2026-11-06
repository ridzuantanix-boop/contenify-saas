import { afterEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../src/app/api/styles/route';
import { publicProviderAvailability } from '../src/lib/providers/public-availability';

describe('public generation release gates', () => {
  const oldVoice = process.env.AFFIMATIK_VOICE_PUBLIC_ENABLED;
  const oldMotion = process.env.AFFIMATIK_MOTION_PUBLIC_ENABLED;
  const oldQa = process.env.AFFIMATIK_MANUAL_QA_ENABLED;
  afterEach(() => {
    if (oldVoice === undefined) delete process.env.AFFIMATIK_VOICE_PUBLIC_ENABLED;
    else process.env.AFFIMATIK_VOICE_PUBLIC_ENABLED = oldVoice;
    if (oldMotion === undefined) delete process.env.AFFIMATIK_MOTION_PUBLIC_ENABLED;
    else process.env.AFFIMATIK_MOTION_PUBLIC_ENABLED = oldMotion;
    if (oldQa === undefined) delete process.env.AFFIMATIK_MANUAL_QA_ENABLED;
    else process.env.AFFIMATIK_MANUAL_QA_ENABLED = oldQa;
  });

  it('fails closed and reports unavailable engines to the Factory', async () => {
    delete process.env.AFFIMATIK_VOICE_PUBLIC_ENABLED;
    delete process.env.AFFIMATIK_MOTION_PUBLIC_ENABLED;
    expect(publicProviderAvailability()).toEqual({ nexabot: false, runninghub: false });
    const response = await GET(new NextRequest('http://localhost/api/styles'));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.availability).toEqual({ nexabot: false, runninghub: false });
    expect(data.styles.length).toBeGreaterThanOrEqual(13);
  });

  it('requires an explicit release switch for each engine', () => {
    process.env.AFFIMATIK_VOICE_PUBLIC_ENABLED = 'true';
    process.env.AFFIMATIK_MOTION_PUBLIC_ENABLED = 'false';
    process.env.AFFIMATIK_MANUAL_QA_ENABLED = 'true';
    expect(publicProviderAvailability()).toEqual({ nexabot: true, runninghub: false });
  });

  it('requires the manual QA gate before exposing Voice', () => {
    process.env.AFFIMATIK_VOICE_PUBLIC_ENABLED = 'true';
    delete process.env.AFFIMATIK_MANUAL_QA_ENABLED;
    expect(publicProviderAvailability().nexabot).toBe(false);
  });

  it('keeps RunningHub unavailable even if its old public flag is set', () => {
    process.env.AFFIMATIK_MOTION_PUBLIC_ENABLED = 'true';
    expect(publicProviderAvailability().runninghub).toBe(false);
  });
});
