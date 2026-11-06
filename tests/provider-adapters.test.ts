import { describe, it, expect, vi } from 'vitest';
import { RunningHubAdapter } from '../src/lib/providers/runninghub';
import { NexabotAdapter } from '../src/lib/providers/nexabot';
import { MockProviderAdapter } from '../src/lib/providers/mock';
import { ProviderRouter } from '../src/lib/providers/router';
import { ProviderJobInput } from '../src/lib/providers/types';

describe('RunningHub Adapter', () => {
  const adapter = new RunningHubAdapter({
    apiKey: 'test_rh_key_mock',
    webappId: '2103149871766220801',
  });

  const valid15sInput: ProviderJobInput = {
    jobId: 'job_123',
    idempotencyKey: 'idemp_123',
    workspaceId: 'ws_abc',
    prompt: 'A natural Malaysian creator holding product in clean studio',
    durationSeconds: 15,
    aspectRatio: '9:16',
    mainImageKeyOrUrl: 'https://storage.contenify.mock/main.png',
    referenceImageKeysOrUrls: ['https://storage.contenify.mock/ref1.png'],
  };

  it('validates duration strictly for 15s', () => {
    const valid = adapter.validateInput(valid15sInput);
    expect(valid.isValid).toBe(true);

    const invalid = adapter.validateInput({ ...valid15sInput, durationSeconds: 10 });
    expect(invalid.isValid).toBe(false);
    expect(invalid.error).toContain('15s duration only');
  });

  it('correctly maps webapp nodes for nodeInfoList', () => {
    const payload = adapter.preparePayload(valid15sInput) as {
      webappId: string;
      nodeInfoList: Array<{ nodeId: string; fieldName: string; fieldValue: string }>;
    };

    expect(payload.webappId).toBe('2103149871766220801');
    const node114 = payload.nodeInfoList.find(n => n.nodeId === '114');
    expect(node114?.fieldValue).toBe('https://storage.contenify.mock/main.png');

    const node136 = payload.nodeInfoList.find(n => n.nodeId === '136');
    expect(node136?.fieldValue).toBe(valid15sInput.prompt);

    const node135 = payload.nodeInfoList.find(n => n.nodeId === '135');
    expect(node135?.fieldValue).toBe('15');
  });

  it('uploads the actual image once and gives RunningHub LoadImage nodes its returned fileName', async () => {
    const image = 'data:image/png;base64,iVBORw0KGgo=';
    const request = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: 0, data: { fileName: 'api/verified.png' } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ taskId: 'rh-task-1' }), { status: 200 }));
    vi.stubGlobal('fetch', request);
    try {
      const result = await adapter.submit({ ...valid15sInput, mainImageKeyOrUrl: image, referenceImageKeysOrUrls: [] });
      expect(result.providerTaskId).toBe('rh-task-1');
      expect(request).toHaveBeenCalledTimes(2);
      const upload = request.mock.calls[0][1];
      expect(String(request.mock.calls[0][0])).toContain('/task/openapi/upload');
      expect(upload.body).toBeInstanceOf(FormData);
      expect(upload.body.get('file')).toBeInstanceOf(Blob);
      const sent = JSON.parse(request.mock.calls[1][1].body);
      expect(sent.nodeInfoList.filter((node: { fieldName: string }) => node.fieldName === 'image').every((node: { fieldValue: string }) => node.fieldValue === 'api/verified.png')).toBe(true);
    } finally { vi.unstubAllGlobals(); }
  });

  it('classifies a live-style 605 balance rejection without charging the customer', async () => {
    const image = 'data:image/png;base64,iVBORw0KGgo=';
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: 0, data: { fileName: 'api/verified.png' } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ errorCode: '605', errorMessage: 'Your balance is insufficient' }), { status: 200 })));
    try {
      let thrown: unknown;
      try { await adapter.submit({ ...valid15sInput, mainImageKeyOrUrl: image, referenceImageKeysOrUrls: [] }); }
      catch (error) { thrown = error; }
      expect(thrown).toBeInstanceOf(Error);
      expect(adapter.normalizeError(thrown)).toMatchObject({ code: 'RUNNINGHUB_BALANCE_EXHAUSTED', isRetryable: false, wasBilled: false });
    } finally { vi.unstubAllGlobals(); }
  });
});

describe('Nexabot Adapter', () => {
  const adapter = new NexabotAdapter({
    apiKey: 'test_nexa_key_mock',
  });

  const valid10sInput: ProviderJobInput = {
    jobId: 'job_456',
    idempotencyKey: 'idemp_456',
    workspaceId: 'ws_abc',
    prompt: 'Malaysian creator sharing product in authentic BM',
    durationSeconds: 10,
    aspectRatio: '9:16',
    mainImageKeyOrUrl: 'https://storage.contenify.mock/prod.png',
  };

  it('prioritizes 10s Malaysian Malay spoken content', () => {
    const valid = adapter.validateInput(valid10sInput);
    expect(valid.isValid).toBe(true);

    const caps = adapter.getCapabilities();
    expect(caps.supportsSpokenBM).toBe(true);
    expect(caps.supportsProductResearch).toBe(true);
    const payload = adapter.preparePayload({ ...valid10sInput, mainImageKeyOrUrl: 'data:image/png;base64,iVBORw0KGgo=' });
    expect(payload).toMatchObject({ mode: 'i2v', duration: 10, resolution: 720 });
  });

  it('rejects unpermitted durations', () => {
    const invalid = adapter.validateInput({ ...valid10sInput, durationSeconds: 15 });
    expect(invalid.isValid).toBe(false);
    expect(invalid.error).toContain('10s duration');
  });
});

describe('Mock Provider Adapter & Lifecycle', () => {
  const mockAdapter = new MockProviderAdapter();

  it('submits and transitions through deterministic lifecycle', async () => {
    const input: ProviderJobInput = {
      jobId: 'job_mock_1',
      idempotencyKey: 'idemp_mock_1',
      workspaceId: 'ws_mock',
      prompt: 'Test prompt',
      durationSeconds: 10,
      aspectRatio: '9:16',
      mainImageKeyOrUrl: 'https://storage.contenify.mock/test.jpg',
    };

    const submitRes = await mockAdapter.submit(input);
    expect(submitRes.providerTaskId).toBeDefined();

    // Poll 1 -> RUNNING
    const poll1 = await mockAdapter.getStatus(submitRes.providerTaskId);
    expect(poll1.normalizedStatus).toBe('RUNNING');

    // Poll 2 -> COMPLETED
    const poll2 = await mockAdapter.getStatus(submitRes.providerTaskId);
    expect(poll2.normalizedStatus).toBe('COMPLETED');

    // Outputs
    const outputs = await mockAdapter.getOutputs(submitRes.providerTaskId);
    expect(outputs.videoUrl).toContain('.mp4');
    expect(outputs.durationSeconds).toBe(10);
  });
});

describe('Provider Router', () => {
  const router = new ProviderRouter({ useMockOnly: true });

  it('routes correctly based on duration', () => {
    const adapter10s = router.resolveProvider(10);
    expect(adapter10s.name).toBe('mock');

    const cost10 = router.calculateCreditCost(10, 'nexabot');
    expect(cost10).toBe(10);

    const cost15 = router.calculateCreditCost(15, 'runninghub');
    expect(cost15).toBe(15);
  });
});
