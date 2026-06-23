import { Injectable, Inject } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { CsvImportRepository } from './csv-import.repository';
import { OBJECT_STORAGE_PORT } from '../../common/ports/object-storage.port';
import { ObjectStoragePort } from '../../common/ports/object-storage.port';

@Injectable()
export class CsvImportService {
  constructor(
    private readonly repo: CsvImportRepository,
    @Inject(OBJECT_STORAGE_PORT) private readonly storage: ObjectStoragePort,
    @InjectQueue('csv-import') private readonly queue: Queue,
  ) {}
  async createJob(file: Express.Multer.File, concertId: string, userId: string) {
    if (file.mimetype !== 'text/csv' && !file.originalname.endsWith('.csv')) {
      throw new Error('Invalid file type. Only CSV files are allowed.');
    }

    const objectKey = `csv-imports/${concertId}-${Date.now()}.csv`;
    await this.storage.upload({
      objectKey,
      buffer: file.buffer,
      contentType: file.mimetype,
      size: file.size,
    });

    const job = await this.repo.createJob(concertId, userId, objectKey);
    await this.queue.add('process-csv', { jobId: job.id, fileUrl: objectKey, concertId });

    return job;
  }

  async getJobStatus(jobId: string) {
    const job = await this.repo.findById(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }
    return job;
  }
}
