import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GrokAdapter } from './grok.adapter';
import OpenAI from 'openai';

jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => {
      return {
        responses: {
          create: (jest.fn() as any).mockResolvedValue({
            output_text: 'Grok Biography Content',
          }),
        },
      };
    }),
  };
});

describe('GrokAdapter', () => {
  let adapter: GrokAdapter;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'app.ai.provider') return 'grok';
        if (key === 'app.ai.grokApiKey') return 'mock-grok-key';
        if (key === 'app.ai.grokModel') return 'grok-4.3';
        if (key === 'app.ai.grokBaseUrl') return 'https://api.x.ai/v1';
        if (key === 'app.ai.timeoutMs') return 5000;
        if (key === 'app.ai.maxTokens') return 500;
        if (key === 'app.ai.temperature') return 0.5;
        if (key === 'app.ai.quotaPerMinute') return 2;
        return undefined;
      }),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GrokAdapter,
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    adapter = module.get<GrokAdapter>(GrokAdapter);
  });

  it('should be defined', () => {
    expect(adapter).toBeDefined();
  });

  it('should initialize OpenAI client with grok options', () => {
    expect(OpenAI).toHaveBeenCalledWith({
      apiKey: 'mock-grok-key',
      baseURL: 'https://api.x.ai/v1',
      timeout: 5000,
      maxRetries: 1,
    });
  });

  it('should generate biography text', async () => {
    const result = await adapter.generateArtistBio('Extracted biography text');
    expect(result).toBe('Grok Biography Content');
  });

  it('should enforce quota limit and throw when exceeded', async () => {
    // quota is set to 2 per minute
    await adapter.generateArtistBio('Text 1');
    await adapter.generateArtistBio('Text 2');

    await expect(adapter.generateArtistBio('Text 3')).rejects.toThrow(
      'Grok quota exceeded. Limit is 2 requests per minute.',
    );
  });
});
