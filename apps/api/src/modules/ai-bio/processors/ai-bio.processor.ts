import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger, Inject } from '@nestjs/common';
import pdf from 'pdf-parse'; // 1. Thêm import thư viện này
import { AI_TEXT_GENERATION_PORT, AITextGenerationPort } from '../../../common/ports/ai-text-generation.port';
import { OBJECT_STORAGE_PORT, ObjectStoragePort } from '../../../common/ports/object-storage.port';
import { AiBioRepository } from '../ai-bio.repository';
import { AiBioStatus } from '../entities/ai-bio-request.entity';
import { createCircuitBreaker } from '../../../common/utils/circuit-breaker.factory';
import CircuitBreaker from 'opossum';

export const AI_BIO_JOB = 'ai.bio.generate';

@Processor('ai-bio')
export class AiBioProcessor {
  private readonly logger = new Logger(AiBioProcessor.name);
  private aiBreaker: CircuitBreaker<any[], string>;

  constructor(
    @Inject(AI_TEXT_GENERATION_PORT) private readonly aiPort: AITextGenerationPort,
    @Inject(OBJECT_STORAGE_PORT) private readonly storage: ObjectStoragePort, // 2. Đã thêm private
    private readonly repo: AiBioRepository,                                   // 3. Đã thêm private
  ) {
    this.aiBreaker = createCircuitBreaker(
      (text: string, hint?: string) => this.aiPort.generateArtistBio(text, hint),
      {
        name: 'AIGeneration',
        timeout: 15000,               // AI might take up to 15 seconds
        errorThresholdPercentage: 50, // 50% errors opens circuit
        resetTimeout: 30000,          // Try again after 30 seconds
      }
    );

    // Fallback if AI provider fails or circuit is open
    this.aiBreaker.fallback(() => {
      throw new Error('AI Provider is currently unavailable. Manual biography entry required.');
    });
  }

  @Process(AI_BIO_JOB)
  async handle(job: Job<{ requestId: string; fileUrl: string }>): Promise<void> {
    const { requestId, fileUrl } = job.data;
    
    try {
      await this.repo.updateStatus(requestId, AiBioStatus.PROCESSING);

      // Tải PDF từ MinIO
      const buffer = await this.storage.download(fileUrl);
      const data = await pdf(buffer); // 4. Sử dụng pdf-parse
      
      // Gọi AI thông qua Circuit Breaker
      const content = await this.aiBreaker.fire(data.text, undefined);
      
      // Giữ ở trạng thái draft để organizer review/publish trước khi public
      await this.repo.updateDraft(requestId, content, AiBioStatus.DRAFT);
    } catch (error) {
      // 5. Xử lý an toàn cho biến error (unknown)
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to process job ${requestId}: ${message}`);
      
      // Update as FAILED so Admin can enter manually, then we don't throw to BullMQ to avoid useless retries while Circuit is Open
      await this.repo.updateStatus(requestId, AiBioStatus.FAILED, message);
      
      // We don't re-throw if it's the fallback error, to prevent BullMQ from retrying 100 times during an outage.
      if (!message.includes('Manual biography entry required')) {
        throw error;
      }
    }
  }
}
