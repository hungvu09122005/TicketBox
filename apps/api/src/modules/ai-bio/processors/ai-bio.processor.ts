import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger, Inject } from '@nestjs/common';
import { AI_TEXT_GENERATION_PORT, AITextGenerationPort } from '../../../common/ports/ai-text-generation.port';

export const AI_BIO_JOB = 'ai.bio.generate';

/**
 * AiBioProcessor — bullMQ worker for AI bio generation. Blueprint §05 §3.5.
 * Circuit breaker (Opossum) wraps the AITextGenerationPort call here.
 * Retry: max 3, exponential backoff. On exhaustion → status=FAILED + failureReason.
 * NEVER auto-publishes the draft.
 */
@Processor('ai-bio')
export class AiBioProcessor {
  private readonly logger = new Logger(AiBioProcessor.name);

  constructor(
    @Inject(AI_TEXT_GENERATION_PORT) private readonly aiPort: AITextGenerationPort,
  ) {}

  @Process(AI_BIO_JOB)
  async handle(job: Job<{ requestId: string }>): Promise<void> {
    // TODO Phase 7: download PDF → extract text → sanitize → aiPort.generateArtistBio() → save DRAFT
    this.logger.log(`[STUB] ai-bio job for requestId=${job.data.requestId}`);
  }
}
