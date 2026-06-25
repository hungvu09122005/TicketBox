import {
  BadRequestException,
  ConflictException,
  Injectable,
  Inject,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { randomUUID } from 'crypto';
import { CsvImportRepository } from './csv-import.repository';
import {
  OBJECT_STORAGE_PORT,
  ObjectStoragePort,
} from '../../common/ports/object-storage.port';
import { CsvImportJobStatus } from './entities/csv-import-job.entity';
import { CSV_IMPORT_JOB } from './processors/csv-import.processor';

const MAX_CSV_SIZE_BYTES = 5 * 1024 * 1024;

const ALLOWED_CSV_MIME_TYPES = new Set([
  'text/csv',
  'application/csv',
  'application/vnd.ms-excel',
]);

const EXPECTED_HEADERS = ['name', 'email', 'phone', 'ticket_type_id'];

@Injectable()
export class CsvImportService {
  constructor(
    private readonly repo: CsvImportRepository,
    @Inject(OBJECT_STORAGE_PORT) private readonly storage: ObjectStoragePort,
    @InjectQueue('csv-import') private readonly queue: Queue,
  ) {}

  async createJob(file: Express.Multer.File, concertId: string, userId: string) {
    this.validateCsvFile(file);

    const objectKey = `csv-imports/${concertId}/${Date.now()}-${randomUUID()}.csv`;

    await this.storage.upload({
      objectKey,
      buffer: file.buffer,
      contentType: file.mimetype,
      size: file.size,
    });

    const job = await this.repo.createJob(concertId, userId, objectKey);

    await this.queue.add(CSV_IMPORT_JOB, {
      jobId: job.id,
      objectKey,
      concertId,
      triggeredBy: userId,
    });

    return {
      job_id: job.id,
      status: job.status,
      object_key: job.objectKey,
      concert_id: job.concertId,
      created_at: job.createdAt,
    };
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

    if (
      job.status !== CsvImportJobStatus.FAILED &&
      job.status !== CsvImportJobStatus.PARTIALLY_COMPLETED
    ) {
      throw new ConflictException(`Cannot retry job in state: ${job.status}`);
    }

    await this.repo.updateStatus(job.id, CsvImportJobStatus.PENDING);

    await this.queue.add(CSV_IMPORT_JOB, {
      jobId: job.id,
      objectKey: job.objectKey,
      concertId: job.concertId,
      triggeredBy: job.triggeredBy,
    });

    return {
      success: true,
      message: `CSV job ${job.id} is being retried`,
      job_id: job.id,
    };
  }

  private validateCsvFile(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('file is required');
    }

    if (!file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('CSV file is empty.');
    }

    if (file.size > MAX_CSV_SIZE_BYTES) {
      throw new BadRequestException(
        `CSV file is too large. Maximum size is ${MAX_CSV_SIZE_BYTES} bytes.`,
      );
    }

    const hasCsvExtension = file.originalname.toLowerCase().endsWith('.csv');
    const hasAllowedMime = ALLOWED_CSV_MIME_TYPES.has(file.mimetype);

    if (!hasCsvExtension || !hasAllowedMime) {
      throw new BadRequestException(
        'Invalid file type. Only CSV files with a valid CSV MIME type are allowed.',
      );
    }

    const firstLine = this.extractFirstLine(file.buffer);

    if (!firstLine) {
      throw new BadRequestException('CSV header is required.');
    }

    const actualHeaders = firstLine
      .replace(/^\uFEFF/, '')
      .split(',')
      .map((header) => header.trim().toLowerCase());

    const isValidHeader =
      actualHeaders.length === EXPECTED_HEADERS.length &&
      EXPECTED_HEADERS.every((header, index) => actualHeaders[index] === header);

    if (!isValidHeader) {
      throw new BadRequestException(
        `Invalid CSV header. Expected: ${EXPECTED_HEADERS.join(',')}`,
      );
    }
  }

  private extractFirstLine(buffer: Buffer): string {
    const content = buffer.toString('utf8');
    const [firstLine] = content.split(/\r?\n/);
    return firstLine?.trim() ?? '';
  }
}
