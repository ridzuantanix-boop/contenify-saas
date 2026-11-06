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
    const isMock = this.useMockOnly || (process.env.USE_MOCK_PROVIDERS === 'true');
    if (isMock || (allowMockForTesting && requestedProvider === 'mock')) {
      return this.mock;
    }

    if (requestedProvider === 'mock' && !this.useMockOnly && !allowMockForTesting) {
      throw new Error('Pembekal Mock tidak dibenarkan dalam persekitaran produksi.');
    }

    if (requestedProvider === 'nexabot') {
      const key = process.env.NEXABOT_API_KEY;
      if (!key || key.trim().length === 0) {
        throw new Error('Ralat Konfigurasi Pelayan: Kunci API Nexabot (AffiMatik Voice / NEXABOT_API_KEY) tidak dikonfigurasi di pelayan. Sila hubungi pentadbir sistem.');
      }
      return this.nexabot;
    }

    if (requestedProvider === 'runninghub') {
      const key = process.env.RUNNINGHUB_API_KEY;
      if (!key || key.trim().length === 0) {
        throw new Error('Ralat Konfigurasi Pelayan: Kunci API RunningHub (AffiMatik Motion / RUNNINGHUB_API_KEY) tidak dikonfigurasi di pelayan. Sila hubungi pentadbir sistem.');
      }
      return this.runningHub;
    }

    // New 15s jobs must specify a style/provider: duration alone is ambiguous
    // because historical Motion jobs also last 15 seconds.
    if (durationSeconds === 10) {
      const key = process.env.NEXABOT_API_KEY;
      if (!key || key.trim().length === 0) {
        throw new Error('Ralat Konfigurasi Pelayan: Kunci API Nexabot (AffiMatik Voice / NEXABOT_API_KEY) tidak dikonfigurasi untuk video 10 saat.');
      }
      return this.nexabot;
    }

    if (durationSeconds === 15) throw new Error('Gaya atau pembekal mesti dinyatakan untuk video 15 saat.');

    throw new Error(
      `Tiada enjin AI menyokong durasi ${durationSeconds}s secara terus.`
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
