import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { AITextGenerationPort } from '../../../common/ports/ai-text-generation.port';

@Injectable()
export class GrokAdapter implements AITextGenerationPort {
  private readonly openai: OpenAI;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly maxTokens: number;
  private readonly temperature: number;
  private readonly quotaPerMinute: number;
  private readonly requestTimestamps: number[] = [];

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('app.ai.grokApiKey');
    this.model = this.configService.get<string>('app.ai.grokModel') ?? 'grok-4.3';
    const baseURL = this.configService.get<string>('app.ai.grokBaseUrl') ?? 'https://api.x.ai/v1';

    this.timeoutMs = this.configService.get<number>('app.ai.timeoutMs') ?? 15000;
    this.maxTokens = this.configService.get<number>('app.ai.maxTokens') ?? 1000;
    this.temperature = this.configService.get<number>('app.ai.temperature') ?? 0.7;
    this.quotaPerMinute = this.configService.get<number>('app.ai.quotaPerMinute') ?? 10;

    if (apiKey) {
      this.openai = new OpenAI({
        apiKey,
        baseURL,
        timeout: this.timeoutMs,
        maxRetries: 1,
      });
    } else {
      console.warn('WARN: GROK_API_KEY is not configured. AI services will fail when called.');
      this.openai = null as any;
    }
  }

  async generateArtistBio(extractedText: string, promptHint?: string): Promise<string> {
    if (!this.openai) {
      throw new Error('GROK_API_KEY is required when AI_PROVIDER=grok.');
    }
    this.enforceQuota();

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a professional music journalist. Write concise, engaging, public-facing copy based on the provided press kit text. Return only the requested content, formatted in markdown.',
          },
          {
            role: 'user',
            content: `Here is the press kit text:\n\n${extractedText}${promptHint ? `\n\nPrompt hint: ${promptHint}` : ''}`,
          },
        ],
        max_tokens: this.maxTokens,
        temperature: this.temperature,
      });

      const content = response.choices[0]?.message?.content?.trim();

      if (!content) {
        throw new Error('No content returned from Grok response.');
      }

      return content;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown Grok API error';
      throw new Error(`Grok text generation failed: ${message}`);
    }
  }

  private enforceQuota() {
    const now = Date.now();
    const windowStart = now - 60_000;

    while (this.requestTimestamps.length > 0 && this.requestTimestamps[0] < windowStart) {
      this.requestTimestamps.shift();
    }

    if (this.requestTimestamps.length >= this.quotaPerMinute) {
      throw new Error(
        `Grok quota exceeded. Limit is ${this.quotaPerMinute} requests per minute.`,
      );
    }

    this.requestTimestamps.push(now);
  }
}
