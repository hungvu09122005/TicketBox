/**
 * AITextGenerationPort — dependency inversion interface for LLM providers.
 * Blueprint §01-system-design §7.2, ADR-13, §05-business-flows §3.5
 *
 * Concrete adapters:
 *   - OpenAITextGenerationAdapter (apps/api/src/modules/ai-bio/adapters/openai.adapter.ts)
 *   - GeminiTextGenerationAdapter (future)
 *
 * RULE: AiBioWorker depends ONLY on this interface.
 * Circuit breaker is applied at the adapter call site in AiBioWorker.
 */
export interface AITextGenerationPort {
  /**
   * Generate a structured artist biography from raw PDF text.
   *
   * @param extractedText - Sanitized, size-limited text extracted from the PDF.
   * @param promptHint   - Optional system prompt override.
   * @returns Generated biography text (markdown or plain text).
   */
  generateArtistBio(extractedText: string, promptHint?: string): Promise<string>;
}

/** DI injection token */
export const AI_TEXT_GENERATION_PORT = 'AI_TEXT_GENERATION_PORT';
