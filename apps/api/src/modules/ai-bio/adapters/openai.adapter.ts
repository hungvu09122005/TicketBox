import { Injectable } from '@nestjs/common';
import { AITextGenerationPort } from '../../../common/ports/ai-text-generation.port';

/**
 * OpenAIAdapter — calls real OpenAI API. Blueprint No-Mock Policy.
 * Credentials: OPENAI_API_KEY from config.
 * Circuit breaker applied in AiBioProcessor (Opossum), not here.
 */
@Injectable()
export class OpenAIAdapter implements AITextGenerationPort {
  async generateArtistBio(extractedText: string, promptHint?: string): Promise<string> {
    // TODO Phase 7: use openai SDK, real API call, bounded retry
    throw new Error('OpenAIAdapter.generateArtistBio not implemented — Phase 7');
  }
}
