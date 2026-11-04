import { IProviderAdapter, ProviderJobInput, ProviderName, VideoDuration } from './types';
import { RunningHubAdapter } from './runninghub';
import { NexabotAdapter } from './nexabot';
import { MockProviderAdapter } from './mock';

export interface RouterConfig {
  runningHubApiKey?: string;
  runningHubWebappId?: string;
  nexabotApiKey?: string;
  useMockOnly?: boolean;
}

export class ProviderRouter {
  private runningHub: RunningHubAdapter;
  private nexabot: NexabotAdapter;
  private mock: MockProviderAdapter;
  private useMockOnly: boolean;

  constructor(config: RouterConfig = {}) {
    this.useMockOnly = config.useMockOnly ?? (process.env.USE_MOCK_PROVIDERS === 'true');
    this.runningHub = new RunningHubAdapter({
      apiKey: config.runningHubApiKey || process.env.RUNNINGHUB_API_KEY || '',
      webappId: config.runningHubWebappId || process.env.RUNNINGHUB_WEBAPP_ID,
    });
    this.nexabot = new NexabotAdapter({
      apiKey: config.nexabotApiKey || process.env.NEXABOT_API_KEY || '',
    });
    this.mock = new MockProviderAdapter();
  }

  resolveProvider(
    durationSeconds: VideoDuration,
    requestedProvider?: ProviderName,
    allowMockForTesting = false
  ): IProviderAdapter {
    // Only permit mock adapter if explicitly configured for tests/mock mode
    if (this.useMockOnly || (allowMockForTesting && requestedProvider === 'mock')) {
      return this.mock;
    }

    if (requestedProvider === 'mock' && !this.useMockOnly && !allowMockForTesting) {
      throw new Error('Pembekal Mock tidak dibenarkan dalam persekitaran produksi.');
    }

    if (requestedProvider === 'nexabot') {
      const key = process.env.NEXABOT_API_KEY;
      if (!key || key.trim().length === 0) {
        throw new Error('Ralat Konfigurasi Pelayan: Kunci API Nexabot (NEXABOT_API_KEY) tidak dikonfigurasi di pelayan. Sila hubungi pentadbir sistem.');
      }
      return this.nexabot;
    }

    if (requestedProvider === 'runninghub') {
      const key = process.env.RUNNINGHUB_API_KEY;
      if (!key || key.trim().length === 0) {
        throw new Error('Ralat Konfigurasi Pelayan: Kunci API RunningHub (RUNNINGHUB_API_KEY) tidak dikonfigurasi di pelayan. Sila hubungi pentadbir sistem.');
      }
      return this.runningHub;
    }

    // Default intelligent routing as per Blueprint:
    // 10s -> Nexabot priority (natural Malaysian Malay spoken creator videos)
    // 15s -> RunningHub priority
    if (durationSeconds === 10) {
      const key = process.env.NEXABOT_API_KEY;
      if (!key || key.trim().length === 0) {
        throw new Error('Ralat Konfigurasi Pelayan: Kunci API Nexabot (NEXABOT_API_KEY) tidak dikonfigurasi untuk video 10 saat.');
      }
      return this.nexabot;
    }

    if (durationSeconds === 15) {
      const key = process.env.RUNNINGHUB_API_KEY;
      if (!key || key.trim().length === 0) {
        throw new Error('Ralat Konfigurasi Pelayan: Kunci API RunningHub (RUNNINGHUB_API_KEY) tidak dikonfigurasi untuk video 15 saat.');
      }
      return this.runningHub;
    }

    throw new Error(
      `Tiada pembekal AI menyokong durasi ${durationSeconds}s secara terus. Sila pilih gaya 10s (Nexabot) atau 15s (RunningHub).`
    );
  }

  calculateCreditCost(durationSeconds: VideoDuration, providerName: ProviderName): number {
    switch (providerName) {
      case 'nexabot':
        return 10;
      case 'runninghub':
        return 15;
      case 'mock':
        return 10; // Treat mock identically to standard cost in testing
      default:
        return Math.ceil(durationSeconds);
    }
  }
}
