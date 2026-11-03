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
    this.useMockOnly = config.useMockOnly || process.env.USE_MOCK_PROVIDERS === 'true';
    this.runningHub = new RunningHubAdapter({
      apiKey: config.runningHubApiKey || process.env.RUNNINGHUB_API_KEY || '',
      webappId: config.runningHubWebappId || process.env.RUNNINGHUB_WEBAPP_ID,
    });
    this.nexabot = new NexabotAdapter({
      apiKey: config.nexabotApiKey || process.env.NEXABOT_API_KEY || '',
    });
    this.mock = new MockProviderAdapter();
  }

  resolveProvider(durationSeconds: VideoDuration, requestedProvider?: ProviderName): IProviderAdapter {
    if (this.useMockOnly || requestedProvider === 'mock') {
      return this.mock;
    }

    if (requestedProvider === 'nexabot') {
      if (!process.env.NEXABOT_API_KEY) {
        console.warn('[ProviderRouter] NEXABOT_API_KEY not configured. Falling back to Mock adapter.');
        return this.mock;
      }
      return this.nexabot;
    }

    if (requestedProvider === 'runninghub') {
      if (!process.env.RUNNINGHUB_API_KEY) {
        console.warn('[ProviderRouter] RUNNINGHUB_API_KEY not configured. Falling back to Mock adapter.');
        return this.mock;
      }
      return this.runningHub;
    }

    // Default intelligent routing as per Blueprint:
    // 10s -> Nexabot priority (natural Malaysian Malay spoken creator videos)
    // 15s -> RunningHub priority
    if (durationSeconds === 10) {
      if (!process.env.NEXABOT_API_KEY) {
        console.warn('[ProviderRouter] NEXABOT_API_KEY not configured. Falling back to Mock adapter.');
        return this.mock;
      }
      return this.nexabot;
    }

    if (durationSeconds === 15) {
      if (!process.env.RUNNINGHUB_API_KEY) {
        console.warn('[ProviderRouter] RUNNINGHUB_API_KEY not configured. Falling back to Mock adapter.');
        return this.mock;
      }
      return this.runningHub;
    }

    throw new Error(
      `No direct single provider supports duration ${durationSeconds}s natively. Use orchestration pipeline.`
    );
  }

  calculateCreditCost(durationSeconds: VideoDuration, providerName: ProviderName): number {
    // 10 credits for 10s Nexabot; 15 credits for 15s RunningHub
    switch (providerName) {
      case 'nexabot':
        return 10;
      case 'runninghub':
        return 15;
      case 'mock':
        return 1;
      default:
        return Math.ceil(durationSeconds);
    }
  }
}
