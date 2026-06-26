import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { AITextGenerationPort } from '../../../common/ports/ai-text-generation.port';

@Injectable()
export class OpenAIAdapter implements AITextGenerationPort {
  private readonly openai: OpenAI;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly maxTokens: number;
  private readonly temperature: number;
  private readonly quotaPerMinute: number;
  private readonly requestTimestamps: number[] = [];

  constructor(private readonly configService: ConfigService) {
    const provider = this.configService.get<string>('app.ai.provider') ?? 'openai';

    if (provider !== 'openai') {
      throw new Error(`Unsupported AI provider: ${provider}`);
    }

    const apiKey = this.configService.get<string>('app.ai.openaiApiKey');

    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required when AI_PROVIDER=openai.');
    }

    this.model = this.configService.get<string>('app.ai.openaiModel') ?? 'gpt-4o-mini';
    this.timeoutMs = this.configService.get<number>('app.ai.openaiTimeoutMs') ?? 15000;
    this.maxTokens = this.configService.get<number>('app.ai.openaiMaxTokens') ?? 1000;
    this.temperature = this.configService.get<number>('app.ai.openaiTemperature') ?? 0.7;
    this.quotaPerMinute = this.configService.get<number>('app.ai.quotaPerMinute') ?? 10;

    this.openai = new OpenAI({
      apiKey,
      timeout: this.timeoutMs,
      maxRetries: 1,
    });
  }

  async generateArtistBio(extractedText: string, promptHint?: string): Promise<string> {
    this.enforceQuota();

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a professional music journalist. Write a concise, engaging, and structured artist biography based on the provided press kit text. Return only the biography content, formatted in markdown.',
          },
          {
            role: 'user',
            content: `Here is the artist press kit text:\n\n${extractedText}${promptHint ? `\n\nPrompt hint: ${promptHint}` : ''}`,
          },
        ],
        max_tokens: this.maxTokens,
        temperature: this.temperature,
      });

      const content = response.choices[0]?.message?.content?.trim();

if (!content) {
        throw new Error('No content returned from OpenAI response.');
      }

      return content;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown OpenAI API error';
      throw new Error(`AI text generation failed: ${message}`);
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
        `OpenAI quota exceeded. Limit is ${this.quotaPerMinute} requests per minute.`,
      );
    }

    this.requestTimestamps.push(now);
  }
}

