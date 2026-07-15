import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger, Inject } from '@nestjs/common';
const pdf = require('pdf-parse'); 
import { AI_TEXT_GENERATION_PORT, AITextGenerationPort } from '../../../common/ports/ai-text-generation.port';
import { OBJECT_STORAGE_PORT, ObjectStoragePort } from '../../../common/ports/object-storage.port';
import { AiBioRepository } from '../ai-bio.repository';
import { AiBioStatus, AiBioTargetType } from '../entities/ai-bio-request.entity';
import { createCircuitBreaker } from '../../../common/utils/circuit-breaker.factory';
import CircuitBreaker from 'opossum';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';

export const AI_BIO_JOB = 'ai.bio.generate';

const MAX_PDF_BYTES = 10 * 1024 * 1024;

class PdfExtractionFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PdfExtractionFailedError';
  }
}

function sanitizePdfText(rawText: string, maxChars: number): string {
  return rawText
    .normalize('NFC')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
    .replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, '[redacted-phone]')
    .replace(/https?:\/\/\S+/gi, '[redacted-url]')
    .replace(/\b(?:sk|pk|rk|xoxb|ghp|github_pat)_[A-Za-z0-9_-]{16,}\b/g, '[redacted-secret]')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, maxChars);
}

async function streamToBuffer(stream: Readable, maxBytes: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of stream) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.length;

    if (totalBytes > maxBytes) {
      throw new PdfExtractionFailedError(`PDF file exceeds ${maxBytes} bytes limit.`);
    }

    chunks.push(buffer);
  }

  return Buffer.concat(chunks);
}

@Processor('ai-bio')
export class AiBioProcessor {

  private readonly logger = new Logger(AiBioProcessor.name);
  private readonly maxPromptChars: number;
  private aiBreaker: CircuitBreaker<[text: string, hint?: string], string>;


  constructor(
    @Inject(AI_TEXT_GENERATION_PORT) private readonly aiPort: AITextGenerationPort,
    @Inject(OBJECT_STORAGE_PORT) private readonly storage: ObjectStoragePort, 
    private readonly repo: AiBioRepository,   
    private readonly configService: ConfigService,                                
  ) {

    this.maxPromptChars =
      this.configService.get<number>('app.ai.textMaxChars') ?? 8000;

    const timeoutMs =
      this.configService.get<number>('app.ai.openaiTimeoutMs') ?? 15000;

    this.aiBreaker = createCircuitBreaker(
      (text: string, hint?: string) => this.aiPort.generateArtistBio(text, hint),
      {
        name: 'AIGeneration',
        timeout: timeoutMs,               // AI might take up to 15 seconds
        errorThresholdPercentage: 50, // 50% errors opens circuit
        resetTimeout: 30000,          // Try again after 30 seconds
      },
    )as unknown as CircuitBreaker<[text: string, hint?: string], string>;


    
    
  }

  @Process(AI_BIO_JOB)
  async handle(
    job: Job<{ requestId: string; fileUrl?: string; objectKey?: string }>,
  ): Promise<void> {
    const { requestId } = job.data;
    const objectKey = job.data.objectKey ?? job.data.fileUrl;
    const request = await this.repo.findById(requestId);

    if (!objectKey) {
      await this.repo.updateStatus(
        requestId,
        AiBioStatus.FAILED,
        'PDF object key is missing from AI bio job payload.',
      );
      return;
    }

    if (!request) {
      throw new Error(`AI bio job ${requestId} not found in database`);
    }

    try {
      await this.repo.updateStatus(requestId, AiBioStatus.PROCESSING);

      const pdfText = await this.extractAndSanitizePdfText(objectKey);
      const promptHint = request?.targetType === AiBioTargetType.CONCERT
        ? 'Write a concise, engaging concert introduction for a concert detail page. Focus on the event concept, lineup, atmosphere, and public-facing promo copy. Return only the introduction content, formatted in markdown.'
        : 'Write a concise, engaging artist biography based on the provided press kit text. Return only the biography content, formatted in markdown.';
      const content = await this.aiBreaker.fire(pdfText, promptHint);

      await this.repo.updateStatus(requestId, AiBioStatus.DRAFT, content);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const friendlyMessage = this.getFriendlyErrorMessage(message);

      this.logger.error(
        `Failed to process AI bio job ${requestId} (attempt ${job.attemptsMade + 1}): ${message}`,
      );

      if (error instanceof PdfExtractionFailedError) {
        await this.repo.updateStatus(requestId, AiBioStatus.FAILED, message);
        return;
      }

      const maxAttempts = job.opts?.attempts || 1;
      const isLastAttempt = job.attemptsMade + 1 >= maxAttempts;

      if (isLastAttempt) {
        await this.repo.updateStatus(requestId, AiBioStatus.FAILED, friendlyMessage);
      } else {
        await this.repo.updateStatus(requestId, AiBioStatus.PROCESSING, {
          failureReason: `Attempt ${job.attemptsMade + 1} failed: ${friendlyMessage}`,
        });
      }

      throw error;
    }
  }

  private async extractAndSanitizePdfText(objectKey: string): Promise<string> {
    let buffer: Buffer;

    try {
      const stream = await this.storage.downloadStream(objectKey);
      buffer = await streamToBuffer(stream as Readable, MAX_PDF_BYTES);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown storage error';
      throw new PdfExtractionFailedError(`Unable to read PDF from object storage: ${message}`);
    }

    let parsedText = '';

    try {
      const parsed = await pdf(buffer);
      parsedText = typeof parsed?.text === 'string' ? parsed.text : '';
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown PDF parser error';
      throw new PdfExtractionFailedError(`Unable to extract text from PDF: ${message}`);
    }

    const sanitizedText = sanitizePdfText(parsedText, this.maxPromptChars);

    if (!sanitizedText) {
      throw new PdfExtractionFailedError('PDF does not contain readable text.');
    }

    return sanitizedText;

  }

  private getFriendlyErrorMessage(message: string): string {
    const normalizedMessage = message.toLowerCase();

    if (normalizedMessage.includes('credits or licenses')) {
      return 'xAI API is not enabled for this team. Please add credits/licenses in the xAI console before retrying.';
    }

    if (normalizedMessage.includes('model not found')) {
      return 'The configured xAI model is not available. Please verify GROK_MODEL.';
    }

    if (normalizedMessage.includes('api key')) {
      return 'xAI API key is missing or invalid. Please verify GROK_API_KEY.';
    }

    if (normalizedMessage.includes('provider unavailable')) {
      return 'AI Provider is currently unavailable. Manual biography entry required.';
    }

    return message;
  }
}
