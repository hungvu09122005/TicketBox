import { Injectable, Inject } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { AiBioRepository } from './ai-bio.repository';
import { OBJECT_STORAGE_PORT, ObjectStoragePort } from '../../common/ports/object-storage.port';
import { AiBioStatus } from './entities/ai-bio-request.entity';
import { AI_BIO_JOB } from './processors/ai-bio.processor';

@Injectable()
export class AiBioService {
  constructor(
    private readonly repo: AiBioRepository,
    @Inject(OBJECT_STORAGE_PORT) private readonly storage: ObjectStoragePort,
    @InjectQueue('ai-bio') private readonly queue: Queue,
  ) {}
  
  async createRequest(pdfFile: Express.Multer.File, artistId: string, userId: string) {
  // 1. Chuẩn bị đúng format UploadParams
  const objectKey = `artist-bios/${artistId}-${Date.now()}.pdf`;

  const fileUrl = await this.storage.upload({
    objectKey: objectKey,
    buffer: pdfFile.buffer,
    contentType: pdfFile.mimetype, // Lấy từ file thực tế
    size: pdfFile.size             // Lấy từ file thực tế
  });

  // 2. Tạo record DRAFT (dùng Enum đúng cách)
  const bio = await this.repo.create({
    artistId,
    pdfObjectKey: objectKey, // Lưu objectKey này vào DB
    status: AiBioStatus.DRAFT,
    requestedBy: userId
  });

  // 3. Đẩy vào Background Job
  await this.queue.add(AI_BIO_JOB, { requestId: bio.id, fileUrl: objectKey });

  return bio;
}

  async findAll(status?: AiBioStatus) {
    return this.repo.findAll(status);
  }

  async findById(id: string) {
    const job = await this.repo.findById(id);
    if (!job) {
      throw new Error(`AI Bio job ${id} not found`);
    }
    return job;
  }

  async retryJob(id: string) {
    const bio = await this.repo.findById(id);
    if (!bio) {
      throw new Error(`AI Bio job ${id} not found`);
    }
    if (bio.status !== AiBioStatus.FAILED) {
      throw new Error(`Cannot retry AI Bio job in state: ${bio.status}`);
    }
    await this.repo.updateStatus(id, AiBioStatus.DRAFT);
    await this.queue.add(AI_BIO_JOB, { requestId: bio.id, fileUrl: bio.pdfObjectKey });
    return { success: true, message: `AI Bio job ${id} is being retried` };
  }
}
