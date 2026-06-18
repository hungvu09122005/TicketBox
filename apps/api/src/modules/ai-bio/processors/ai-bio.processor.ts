import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger, Inject } from '@nestjs/common';
import pdf from 'pdf-parse'; // 1. Thêm import thư viện này
import { AI_TEXT_GENERATION_PORT, AITextGenerationPort } from '../../../common/ports/ai-text-generation.port';
import { OBJECT_STORAGE_PORT, ObjectStoragePort } from '../../../common/ports/object-storage.port';
import { AiBioRepository } from '../ai-bio.repository';
import { AiBioStatus } from '../entities/ai-bio-request.entity';

export const AI_BIO_JOB = 'ai.bio.generate';

@Processor('ai-bio')
export class AiBioProcessor {
  private readonly logger = new Logger(AiBioProcessor.name);

  constructor(
    @Inject(AI_TEXT_GENERATION_PORT) private readonly aiPort: AITextGenerationPort,
    @Inject(OBJECT_STORAGE_PORT) private readonly storage: ObjectStoragePort, // 2. Đã thêm private
    private readonly repo: AiBioRepository,                                   // 3. Đã thêm private
  ) {}

  @Process(AI_BIO_JOB)
  async handle(job: Job<{ requestId: string; fileUrl: string }>): Promise<void> {
    const { requestId, fileUrl } = job.data;
    
    try {
      // Tải PDF từ MinIO
      const buffer = await this.storage.download(fileUrl);
      const data = await pdf(buffer); // 4. Sử dụng pdf-parse
      
      // Gọi AI
      const content = await this.aiPort.generateArtistBio(data.text);
      
      // Lưu kết quả
      await this.repo.updateStatus(requestId, AiBioStatus.DRAFT, content);
    } catch (error) {
      // 5. Xử lý an toàn cho biến error (unknown)
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to process job ${requestId}: ${message}`);
      await this.repo.updateStatus(requestId, AiBioStatus.FAILED, message);
      throw error; 
    }
  }
}