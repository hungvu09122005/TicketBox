import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Inject, Logger } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import { CsvImportRepository } from '../csv-import.repository';
import { CsvImportJobStatus } from '../entities/csv-import-job.entity';
import { CsvRowStatus } from '../entities/csv-import-row.entity';
import { OBJECT_STORAGE_PORT, ObjectStoragePort } from '../../../common/ports/object-storage.port';

export const CSV_IMPORT_JOB = 'csv.import';

/**
 * CsvImportProcessor — bullmqMQ worker. Blueprint §05 §3.6.
 * Processes CSV row-by-row (streaming), supports partial success.
 * Retry is idempotent via VipGuest dedup_key UNIQUE constraint.
 */
@Processor('csv-import')
export class CsvImportProcessor {
  private readonly logger = new Logger(CsvImportProcessor.name);

  constructor(
    private readonly repo: CsvImportRepository,
    @Inject(OBJECT_STORAGE_PORT) private readonly storage: ObjectStoragePort,
  ) {}

  @Process(CSV_IMPORT_JOB)
  async handle(job: Job<{ jobId: string }>): Promise<void> {
    const csvJob = await this.repo.findById(job.data.jobId);
    if (!csvJob) {
      this.logger.warn(`CSV import job not found: ${job.data.jobId}`);
      return;
    }

    await this.repo.updateJobProgress(csvJob.id, { status: CsvImportJobStatus.PROCESSING });

    try {
      const buffer = await this.storage.download(csvJob.objectKey);
      const records = parse(buffer.toString('utf8'), {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      }) as Array<Record<string, string>>;

      let successRows = 0;
      let errorRows = 0;

      for (let index = 0; index < records.length; index += 1) {
        const rowNumber = index + 2;
        const record = records[index];
        const email = record.email?.trim().toLowerCase();
        const name = record.name?.trim();
        const phone = record.phone?.trim() || undefined;
        const ticketTypeId = record.ticketTypeId?.trim();

        if (!email || !name || !ticketTypeId) {
          errorRows += 1;
          await this.repo.addRow({
            jobId: csvJob.id,
            rowNumber,
            status: CsvRowStatus.ERROR,
            errorReason: 'Missing required fields: email, name, or ticketTypeId',
          });
          continue;
        }

        const dedupKey = email;
        const existing = await this.repo.findVipGuest(csvJob.concertId, dedupKey);
        if (existing) {
          errorRows += 1;
          await this.repo.addRow({
            jobId: csvJob.id,
            rowNumber,
            status: CsvRowStatus.SKIPPED_DUPLICATE,
            errorReason: 'Duplicate guest for this concert',
          });
          continue;
        }

        await this.repo.saveVipGuest({
          concertId: csvJob.concertId,
          ticketTypeId,
          csvImportJobId: csvJob.id,
          email,
          phone,
          name,
          dedupKey,
        });

        successRows += 1;
        await this.repo.addRow({
          jobId: csvJob.id,
          rowNumber,
          status: CsvRowStatus.SUCCESS,
        });
      }

      const status =
        errorRows > 0 && successRows > 0
          ? CsvImportJobStatus.PARTIALLY_COMPLETED
          : errorRows > 0 && successRows === 0
            ? CsvImportJobStatus.FAILED
            : CsvImportJobStatus.COMPLETED;

      await this.repo.updateJobProgress(csvJob.id, {
        status,
        totalRows: records.length,
        successRows,
        errorRows,
      });
    } catch (error) {
      this.logger.error(`[CSV import] job ${csvJob.id} failed`, error instanceof Error ? error.stack : undefined);
      await this.repo.updateJobProgress(csvJob.id, { status: CsvImportJobStatus.FAILED });
      throw error;
    }
  }
}
