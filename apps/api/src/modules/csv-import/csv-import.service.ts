import { Injectable, Inject, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { CsvImportRepository } from './csv-import.repository';
import { OBJECT_STORAGE_PORT } from '../../common/ports/object-storage.port';
import { ObjectStoragePort } from '../../common/ports/object-storage.port';
import { CsvImportJobStatus } from './entities/csv-import-job.entity';
import { CsvRowStatus } from './entities/csv-import-row.entity';
import { CSV_IMPORT_JOB } from './processors/csv-import.processor';

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
    await this.queue.add(CSV_IMPORT_JOB, { jobId: job.id, fileUrl: objectKey, concertId });

    return job;
  }

  async getJobStatus(jobId: string) {
    const job = await this.repo.findById(jobId);
    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }
    return job;
  }

  async listJobs(status?: CsvImportJobStatus) {
    return this.repo.findAll(status);
  }

  async retryJob(jobId: string) {
    const job = await this.repo.findById(jobId);
    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }

    if (job.status !== CsvImportJobStatus.FAILED && job.status !== CsvImportJobStatus.PARTIALLY_COMPLETED) {
      throw new ConflictException(`Cannot retry job in state: ${job.status}`);
    }

    await this.repo.updateStatus(job.id, CsvImportJobStatus.PENDING);
    await this.queue.add(CSV_IMPORT_JOB, { jobId: job.id, fileUrl: job.objectKey, concertId: job.concertId });

    return {
      success: true,
      message: `CSV job ${job.id} is being retried`,
    };
  }

  async getErrorReport(jobId: string) {
    const job = await this.repo.findById(jobId);
    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }

    const rows = await this.repo.findRowsByJobId(jobId);
    const failedOrSkipped = rows.filter((r) => r.status !== CsvRowStatus.SUCCESS);

    let csvContent = 'rowNumber,status,errorReason\n';
    for (const r of failedOrSkipped) {
      const reason = r.errorReason ? `"${r.errorReason.replace(/"/g, '""')}"` : '';
      csvContent += `${r.rowNumber},${r.status},${reason}\n`;
    }

    return {
      jobId,
      filename: `csv-error-report-${jobId}.csv`,
      rowCount: failedOrSkipped.length,
      csv: csvContent,
    };
  }
}
