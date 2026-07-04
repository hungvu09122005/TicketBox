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
import { readFile } from 'fs/promises';
import { basename, resolve } from 'path';
import { CsvImportRepository } from './csv-import.repository';
import {
  OBJECT_STORAGE_PORT,
  ObjectStoragePort,
} from '../../common/ports/object-storage.port';
import { CsvImportJobStatus } from './entities/csv-import-job.entity';
import { CsvRowStatus } from './entities/csv-import-row.entity';
import { CSV_IMPORT_JOB } from './processors/csv-import.processor';
import { workspaceRoot } from '../../config/load-env';

const MAX_CSV_SIZE_BYTES = 5 * 1024 * 1024;

const ALLOWED_CSV_MIME_TYPES = new Set([
  'text/csv',
  'application/csv',
  'application/vnd.ms-excel',
]);

const REQUIRED_CSV_HEADERS = ['email', 'name'];
const CSV_TEMPLATE_PATH = resolve(workspaceRoot, '../sample/guest-lists/template.csv');
const CSV_TEMPLATE_FILENAME = basename(CSV_TEMPLATE_PATH);

function normalizeCsvHeader(header: string): string {
  const key = header
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');

  const mapping: Record<string, string> = {
    email: 'email',
    mail: 'email',
    fullname: 'name',
    name: 'name',
    hoten: 'name',
    holdername: 'name',
    customername: 'name',
    phone: 'phone',
    phonenumber: 'phone',
    mobile: 'phone',
    tickettypeid: 'ticketTypeId',
    tickettype: 'ticketTypeId',
    tickettypename: 'ticketTypeId',
    tickettypelabel: 'ticketTypeId',
    sponsor: 'sponsor',
    gate: 'gate',
    note: 'note',
    dedupkey: 'dedupKey',
    guestexternalid: 'guestExternalId',
  };

  return mapping[key] ?? key;
}

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

    return this.createJobFromObjectKey(concertId, userId, objectKey);
  }

  async createJobFromObjectKey(
    concertId: string,
    userId: string,
    objectKey: string,
  ) {
    const existingJob = await this.repo.findByConcertAndObjectKey(concertId, objectKey);
    if (existingJob) {
      return {
        job_id: existingJob.id,
        status: existingJob.status,
        object_key: existingJob.objectKey,
        concert_id: existingJob.concertId,
        created_at: existingJob.createdAt,
      };
    }

    const job = await this.repo.createJob(concertId, userId, objectKey);

    await this.queue.add(
      CSV_IMPORT_JOB,
      {
        jobId: job.id,
        objectKey,
        concertId,
        triggeredBy: userId,
      },
      {
        jobId: `csv-import:${job.id}`,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: {
          age: 3600,
          count: 100,
        },
        removeOnFail: false,
      },
    );

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

  async getTemplate() {
    const requiredColumns = ['email', 'full_name', 'ticket_type'];
    const optionalColumns = ['guest_external_id', 'phone', 'sponsor', 'gate', 'note'];
    const fallbackCsv = [
      'guest_external_id,full_name,email,phone,sponsor,ticket_type,gate,note',
      'SPONSOR-001,Nguyen Minh Anh,minh.anh@example.com,+84901234567,Brand A,VIP,VIP-A,Replace this sample row with real guest data',
      'SPONSOR-002,Tran Bao Ngoc,bao.ngoc@example.com,+84901234568,Brand A,VIP,VIP-A,One guest per row',
      'SPONSOR-003,Le Quoc Huy,quoc.huy@example.com,,Brand B,VIP,VIP-B,Phone is optional but email is required',
    ].join('\n');

    let csv = fallbackCsv;

    try {
      csv = await readFile(CSV_TEMPLATE_PATH, 'utf8');
    } catch {
      csv = fallbackCsv;
    }

    return {
      filename: CSV_TEMPLATE_FILENAME,
      delimiter: ',',
      encoding: 'utf-8',
      requiredColumns,
      optionalColumns,
      columns: [
        {
          name: 'guest_external_id',
          required: false,
          description: 'Optional sponsor-side guest reference code',
        },
        {
          name: 'full_name',
          required: true,
          description: 'Guest full name',
        },
        {
          name: 'email',
          required: true,
          description: 'Guest email, used for validation and deduplication',
        },
        {
          name: 'phone',
          required: false,
          description: 'Optional phone number in digits or +digits format',
        },
        {
          name: 'sponsor',
          required: false,
          description: 'Optional sponsor or partner name',
        },
        {
          name: 'ticket_type',
          required: true,
          description: 'Exact ticket type name configured by organizer for the selected concert',
        },
        {
          name: 'gate',
          required: false,
          description: 'Optional gate or check-in area label',
        },
        {
          name: 'note',
          required: false,
          description: 'Optional note for organizer',
        },
      ],
      exampleRows: [
        {
          guest_external_id: 'SPONSOR-001',
          full_name: 'Nguyen Minh Anh',
          email: 'minh.anh@example.com',
          phone: '+84901234567',
          sponsor: 'Brand A',
          ticket_type: 'VIP',
          gate: 'VIP-A',
          note: 'Replace this sample row with real guest data',
        },
      ],
      notes: [
        'Download source: sample/guest-lists/template.csv',
        'Keep the header row unchanged.',
        'ticket_type must exactly match a ticket type name configured for the selected concert.',
        'If needed, read sample/guest-lists/template.md for sponsor-facing instructions.',
      ],
      csv,
    };
  }

  async retryJob(jobId: string) {
  const job = await this.repo.findById(jobId);
  if (!job) {
    throw new NotFoundException(`Job ${jobId} not found`);
  }

  const retryableStatuses = new Set<CsvImportJobStatus>([
    CsvImportJobStatus.FAILED,
    CsvImportJobStatus.PARTIALLY_COMPLETED,
    CsvImportJobStatus.PENDING,
    CsvImportJobStatus.PROCESSING,
  ]);

  if (!retryableStatuses.has(job.status)) {
    throw new ConflictException(`Cannot retry job in state: ${job.status}`);
  }

  const bullJobId = `csv-import:${job.id}`;
  const existingBullJob = await this.queue.getJob(bullJobId);

  if (existingBullJob) {
    const state = await existingBullJob.getState();

    if (state === 'active') {
      throw new ConflictException(`Cannot retry job while Bull job is active`);
    }

    await existingBullJob.remove();
  }

  await this.repo.updateStatus(job.id, CsvImportJobStatus.PENDING);

  await this.queue.add(
    CSV_IMPORT_JOB,
    {
      jobId: job.id,
      objectKey: job.objectKey,
      concertId: job.concertId,
      triggeredBy: job.triggeredBy,
    },
    {
      jobId: bullJobId,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: {
        age: 3600,
        count: 100,
      },
      removeOnFail: false,
    },
  );

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
      .split(',')
      .map((header) => normalizeCsvHeader(header));

    const missingHeaders = REQUIRED_CSV_HEADERS.filter(
      (header) => !actualHeaders.includes(header),
    );
    if (!actualHeaders.includes('ticketTypeId')) {
      missingHeaders.push('ticketTypeId');
    }

    if (missingHeaders.length > 0) {
      throw new BadRequestException(
        `Invalid CSV header. Missing required columns: ${missingHeaders.join(', ')}`,
      );
    }
  }

  private extractFirstLine(buffer: Buffer): string {
    const content = buffer.toString('utf8');
    const [firstLine] = content.split(/\r?\n/);
    return firstLine?.trim() ?? '';
  }

  async getErrorReport(jobId: string) {
    const job = await this.repo.findById(jobId);
    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }

    const rows = await this.repo.findRowsByJobId(jobId);
    const errorRows = rows.filter((row) => row.status === CsvRowStatus.ERROR || row.status === CsvRowStatus.SKIPPED_DUPLICATE);

    const escapeCsv = (value: string | number | null | undefined) => {
      if (value === null || value === undefined) {
        return '';
      }
      const text = String(value);
      if (text.includes('"') || text.includes(',') || text.includes('\n')) {
        return `"${text.replace(/"/g, '""')}"`;
      }
      return text;
    };

    const csvLines = [
      'rowNumber,status,errorReason',
      ...errorRows.map((row) => [
        escapeCsv(row.rowNumber),
        escapeCsv(row.status),
        escapeCsv(row.errorReason ?? ''),
      ].join(',')),
    ];

    return {
      jobId: job.id,
      filename: `csv-error-report-${job.id}.csv`,
      rowCount: errorRows.length,
      csv: csvLines.join('\n'),
    };
  }
}
