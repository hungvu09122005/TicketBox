import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { AITextGenerationPort } from '../../../common/ports/ai-text-generation.port';

/**
 * OpenAIAdapter — calls real OpenAI API. Blueprint No-Mock Policy.
 * Credentials: OPENAI_API_KEY from config.
 * Circuit breaker applied in AiBioProcessor (Opossum), not here.
 */
@Injectable()
export class OpenAIAdapter implements AITextGenerationPort {
  private readonly openai: OpenAI;
  private readonly model: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('app.ai.openaiApiKey');

    if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required for real AI integration.');
  }

  this.model = this.configService.get<string>('app.ai.openaiModel') || 'gpt-4o-mini';
  this.openai = new OpenAI({ apiKey });
  }

  async generateArtistBio(extractedText: string, promptHint?: string): Promise<string> {
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
        max_tokens: 1000,
        temperature: 0.7,
      });

      const choice = response.choices[0]?.message?.content;
      if (!choice) {
        throw new Error('No content returned from OpenAI response.');
      }
      return choice;
    } catch (error: any) {
      const message = error?.message || 'Unknown OpenAI API error';
      throw new Error(`AI text generation failed: ${message}`);
    }
  }
}

