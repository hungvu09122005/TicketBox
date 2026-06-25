import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Inject, Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { parse } from 'csv-parse/sync';
import { OBJECT_STORAGE_PORT, ObjectStoragePort } from '../../../common/ports/object-storage.port';
import { TicketsService } from '../../tickets/tickets.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { CsvImportRepository } from '../csv-import.repository';
import { CsvImportJobStatus } from '../entities/csv-import-job.entity';
import { CsvImportRow, CsvRowStatus } from '../entities/csv-import-row.entity';
import { VipGuest } from '../entities/vip-guest.entity';
import { TicketType } from '../../ticket-types/entities/ticket-type.entity';
import { Concert } from '../../concerts/entities/concert.entity';
import { User } from '../../users/entities/user.entity';
import { Role as RoleEntity } from '../../users/entities/role.entity';
import { Role } from '../../../common/constants/roles.enum';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

export const CSV_IMPORT_JOB = 'csv.import';

type CsvImportJobPayload = {
  jobId: string;
  objectKey?: string;
  fileUrl?: string;
  concertId?: string;
  triggeredBy?: string;
};

/**
 * CsvImportProcessor — bullmqMQ worker. Blueprint §05 §3.6.
 * Processes CSV row-by-row, supports partial success.
 * Retry is idempotent via VipGuest dedup_key UNIQUE constraint.
 */
@Processor('csv-import')
export class CsvImportProcessor {
  private readonly logger = new Logger(CsvImportProcessor.name);

  constructor(
    private readonly repo: CsvImportRepository,
    @Inject(OBJECT_STORAGE_PORT) private readonly storage: ObjectStoragePort,
    private readonly ticketsService: TicketsService,
    private readonly notificationsService: NotificationsService,
    private readonly manager: EntityManager,
  ) {}

  @Process(CSV_IMPORT_JOB)
  async handle(job: Job<CsvImportJobPayload>): Promise<void> {
    const { jobId } = job.data;
    this.logger.log(`Processing CSV Import Job: ${jobId}`);

    const importJob = await this.repo.findById(jobId);
    if (!importJob) {
      this.logger.error(`Job ${jobId} not found in database`);
      return;
    }

    const objectKey = job.data.objectKey ?? job.data.fileUrl ?? importJob.objectKey;
    const concertId = job.data.concertId ?? importJob.concertId;
    let records: Array<Record<string, string | undefined>> = [];
    let successRows = 0;
    let errorRows = 0;

    try {
      await this.repo.updateStatus(jobId, CsvImportJobStatus.PROCESSING);

      const buffer = await this.storage.download(objectKey);

      try {
        records = parse(buffer.toString('utf8'), {
          columns: true,
          skip_empty_lines: true,
          trim: true,
        }) as Array<Record<string, string | undefined>>;
      } catch (parseError) {
        const message = parseError instanceof Error ? parseError.message : 'Unknown parse error';
        throw new Error(`Failed to parse CSV file: ${message}`);
      }

      if (records.length === 0) {
        throw new Error('CSV file is empty or has no valid rows');
      }

      const firstRecord = records[0];
      const missingHeaders = ['email', 'name'].filter((header) => !(header in firstRecord));
      if (!('ticketTypeId' in firstRecord) && !('ticket_type_id' in firstRecord)) {
        missingHeaders.push('ticketTypeId');
      }
      if (missingHeaders.length > 0) {
        throw new Error(`CSV is missing required headers: ${missingHeaders.join(', ')}`);
      }

      const concert = await this.manager.findOne(Concert, { where: { id: concertId } });
      if (!concert) {
        throw new Error(`Concert ${concertId} not found`);
      }

      const processedEmails = new Set<string>();
      const processedPhones = new Set<string>();

      for (let index = 0; index < records.length; index += 1) {
        const record = records[index];
        const rowNumber = index + 2;
        const email = record.email?.trim().toLowerCase();
        const name = record.name?.trim();
        const ticketTypeId = (record.ticketTypeId ?? record.ticket_type_id)?.trim();
        const phone = record.phone?.trim() || undefined;

        if (!email || !name || !ticketTypeId) {
          errorRows += 1;
          await this.repo.createRowOutcome(jobId, rowNumber, CsvRowStatus.ERROR, 'Missing email, name, or ticketTypeId');
          continue;
        }

        if (!email.includes('@')) {
          errorRows += 1;
          await this.repo.createRowOutcome(jobId, rowNumber, CsvRowStatus.ERROR, 'Invalid email format');
          continue;
        }

        if (processedEmails.has(email)) {
          errorRows += 1;
          await this.repo.createRowOutcome(jobId, rowNumber, CsvRowStatus.SKIPPED_DUPLICATE, 'Duplicate email in CSV file');
          continue;
        }

        if (phone && processedPhones.has(phone)) {
          errorRows += 1;
          await this.repo.createRowOutcome(jobId, rowNumber, CsvRowStatus.SKIPPED_DUPLICATE, 'Duplicate phone in CSV file');
          continue;
        }

        processedEmails.add(email);
        if (phone) {
          processedPhones.add(phone);
        }

        try {
          await this.manager.transaction(async (m) => {
            const ticketType = await m.findOne(TicketType, { where: { id: ticketTypeId, concertId } });
            if (!ticketType) {
              throw new Error(`Ticket type ${ticketTypeId} not found for this concert`);
            }

            const existingGuest = await m.findOne(VipGuest, {
              where: [
                { concertId, email },
                ...(phone ? [{ concertId, phone }] : []),
              ],
            });
            if (existingGuest) {
              const skipError = new Error('Duplicate email or phone in database');
              (skipError as Error & { isSkip?: boolean }).isSkip = true;
              throw skipError;
            }

            let user = await m.findOne(User, { where: { email } });
            if (!user) {
              const passwordHash = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 12);
              const audienceRole = await m.findOne(RoleEntity, { where: { name: Role.AUDIENCE } });
              if (!audienceRole) {
                throw new Error('AUDIENCE role not found in database');
              }

              user = m.create(User, {
                email,
                name,
                passwordHash,
                isActive: true,
                roles: [audienceRole],
              });
              await m.save(User, user);
            }

            const vipGuest = m.create(VipGuest, {
              concertId,
              ticketTypeId,
              csvImportJobId: jobId,
              email,
              name,
              phone,
              dedupKey: email,
            });
            await m.save(VipGuest, vipGuest);

            const ticket = await this.ticketsService.issueVipTicket(
              {
                userId: user.id,
                concertId,
                ticketTypeId,
              },
              m,
            );

            vipGuest.ticketId = ticket.id;
            await m.save(VipGuest, vipGuest);

            await m.save(
              CsvImportRow,
              m.create(CsvImportRow, {
                jobId,
                rowNumber,
                status: CsvRowStatus.SUCCESS,
              }),
            );

            await this.notificationsService.queueVipWelcome({
              toEmail: email,
              toName: name,
              ticketId: ticket.id,
              userId: user.id,
              concertName: concert.name,
            });

            successRows += 1;
          });
        } catch (rowError) {
          errorRows += 1;
          const rowErrorWithSkip = rowError as Error & { isSkip?: boolean };
          const status = rowErrorWithSkip.isSkip ? CsvRowStatus.SKIPPED_DUPLICATE : CsvRowStatus.ERROR;
          const reason = rowError instanceof Error ? rowError.message : 'Unknown processing error';
          await this.repo.createRowOutcome(jobId, rowNumber, status, reason);
        }
      }

      const finalStatus =
        errorRows === 0
          ? CsvImportJobStatus.COMPLETED
          : successRows === 0
            ? CsvImportJobStatus.FAILED
            : CsvImportJobStatus.PARTIALLY_COMPLETED;

      await this.repo.updateJobStats(jobId, {
        totalRows: records.length,
        successRows,
        errorRows,
        status: finalStatus,
      });

      this.logger.log(
        `CSV Import Job ${jobId} completed. status=${finalStatus}, total=${records.length}, success=${successRows}, error=${errorRows}`,
      );
    } catch (jobError) {
      const message = jobError instanceof Error ? jobError.message : 'Unknown error';
      const attemptNumber = (job.attemptsMade ?? 0) + 1;
      this.logger.error(`Failed to process CSV Import Job ${jobId} (attempt ${attemptNumber}): ${message}`);

      const maxAttempts = job.opts?.attempts || 1;
      const isLastAttempt = attemptNumber >= maxAttempts;

      await this.repo.updateJobStats(jobId, {
        totalRows: records.length || 0,
        successRows,
        errorRows,
        status: isLastAttempt ? CsvImportJobStatus.FAILED : CsvImportJobStatus.PROCESSING,
        failureReason: isLastAttempt ? message : `Attempt ${attemptNumber} failed: ${message}`,
      });

      throw jobError;
    }
  }
}
