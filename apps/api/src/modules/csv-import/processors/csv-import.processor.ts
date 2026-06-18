import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';

export const CSV_IMPORT_JOB = 'csv.import';

/**
 * CsvImportProcessor — bullmqMQ worker. Blueprint §05 §3.6.
 * Processes CSV row-by-row (streaming), supports partial success.
 * Retry is idempotent via VipGuest dedup_key UNIQUE constraint.
 */
@Processor('csv-import')
export class CsvImportProcessor {
  private readonly logger = new Logger(CsvImportProcessor.name);

  @Process(CSV_IMPORT_JOB)
  async handle(job: Job<{ jobId: string }>): Promise<void> {
    // TODO Phase 6: download CSV from MinIO → stream parse → validate rows → upsert vip_guests
    this.logger.log(`[STUB] csv-import job received for jobId=${job.data.jobId}`);
  }
}
