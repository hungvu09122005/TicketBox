import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger, Inject } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { parse } from 'csv-parse/sync';
import { OBJECT_STORAGE_PORT, ObjectStoragePort } from '../../../common/ports/object-storage.port';
import { TicketsService } from '../../tickets/tickets.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { CsvImportRepository } from '../csv-import.repository';
import { CsvImportJobStatus } from '../entities/csv-import-job.entity';
import { CsvRowStatus } from '../entities/csv-import-row.entity';
import { CsvImportRow } from '../entities/csv-import-row.entity';
import { VipGuest } from '../entities/vip-guest.entity';
import { TicketType } from '../../ticket-types/entities/ticket-type.entity';
import { Concert } from '../../concerts/entities/concert.entity';
import { User } from '../../users/entities/user.entity';
import { Role as RoleEntity } from '../../users/entities/role.entity';
import { Role } from '../../../common/constants/roles.enum';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

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
    private readonly ticketsService: TicketsService,
    private readonly notificationsService: NotificationsService,
    private readonly manager: EntityManager,
  ) {}

  @Process(CSV_IMPORT_JOB)
  async handle(job: Job<{ jobId: string; fileUrl: string; concertId: string }>): Promise<void> {
    const { jobId, fileUrl, concertId } = job.data;
    this.logger.log(`Processing CSV Import Job: ${jobId}`);

    const importJob = await this.repo.findById(jobId);
    if (!importJob) {
      this.logger.error(`Job ${jobId} not found in database`);
      return;
    }

    let records: any[] = [];
    let successRows = 0;
    let errorRows = 0;

    try {
      await this.repo.updateStatus(jobId, CsvImportJobStatus.PROCESSING);

      // Download file from MinIO
      const buffer = await this.storage.download(fileUrl);

      // Parse CSV
      try {
        records = parse(buffer, {
          columns: true,
          skip_empty_lines: true,
          trim: true,
        });
      } catch (parseError: any) {
        throw new Error(`Failed to parse CSV file: ${parseError.message}`);
      }

      if (records.length === 0) {
        throw new Error('CSV file is empty or has no valid rows');
      }

      // Check required headers
      const firstRecord = records[0];
      const requiredHeaders = ['email', 'name', 'ticketTypeId'];
      const missingHeaders = requiredHeaders.filter((h) => !(h in firstRecord));
      if (missingHeaders.length > 0) {
        throw new Error(`CSV is missing required headers: ${missingHeaders.join(', ')}`);
      }

      // Fetch Concert details to get name for notification
      const concert = await this.manager.findOne(Concert, { where: { id: concertId } });
      if (!concert) {
        throw new Error(`Concert ${concertId} not found`);
      }

      const processedEmails = new Set<string>();
      const processedPhones = new Set<string>();

      for (let i = 0; i < records.length; i++) {
        const record = records[i];
        const rowNumber = i + 2; // Data row starts at row 2 (row 1 is header)

        const email = record.email?.trim();
        const name = record.name?.trim();
        const ticketTypeId = record.ticketTypeId?.trim();
        const phone = record.phone?.trim();

        // 1. Simple column presence validation
        if (!email || !name || !ticketTypeId) {
          errorRows++;
          await this.repo.createRowOutcome(jobId, rowNumber, CsvRowStatus.ERROR, 'Missing email, name, or ticketTypeId');
          continue;
        }

        // 2. Validate email format
        if (!email.includes('@')) {
          errorRows++;
          await this.repo.createRowOutcome(jobId, rowNumber, CsvRowStatus.ERROR, 'Invalid email format');
          continue;
        }

        // 3. Normalize email for dedup checks
        const dedupKey = email.toLowerCase();

        // 4. Check for duplicates in the current CSV file
        if (processedEmails.has(dedupKey)) {
          errorRows++;
          await this.repo.createRowOutcome(jobId, rowNumber, CsvRowStatus.SKIPPED_DUPLICATE, 'Duplicate email in CSV file');
          continue;
        }
        if (phone && processedPhones.has(phone)) {
          errorRows++;
          await this.repo.createRowOutcome(jobId, rowNumber, CsvRowStatus.SKIPPED_DUPLICATE, 'Duplicate phone in CSV file');
          continue;
        }
        processedEmails.add(dedupKey);
        if (phone) {
          processedPhones.add(phone);
        }

        try {
          // Process row in isolated transaction to support partial success
          await this.manager.transaction(async (m) => {
            // Check if ticket type exists and is active for this concert
            const ticketType = await m.findOne(TicketType, { where: { id: ticketTypeId, concertId } });
            if (!ticketType) {
              throw new Error(`Ticket type ${ticketTypeId} not found for this concert`);
            }

            // Check duplicate email or phone scoped to concert in PostgreSQL
            const existingGuest = await m.findOne(VipGuest, {
              where: [
                { concertId, email },
                ...(phone ? [{ concertId, phone }] : []),
              ],
            });
            if (existingGuest) {
              const skipErr = new Error('Duplicate email or phone in database');
              (skipErr as any).isSkip = true;
              throw skipErr;
            }

            // Find or create user
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

            // Save VIP Guest (without ticketId first, then update it)
            const vipGuest = m.create(VipGuest, {
              concertId,
              ticketTypeId,
              csvImportJobId: jobId,
              email,
              name,
              phone: phone || undefined,
              dedupKey,
            });
            await m.save(VipGuest, vipGuest);

            // Issue ticket
            const ticket = await this.ticketsService.issueVipTicket({
              userId: user.id,
              concertId,
              ticketTypeId,
            }, m);

            // Link ticket back to VIP Guest
            vipGuest.ticketId = ticket.id;
            await m.save(VipGuest, vipGuest);

            // Create row outcome (SUCCESS)
            await m.save(CsvImportRow, m.create(CsvImportRow, {
              jobId,
              rowNumber,
              status: CsvRowStatus.SUCCESS,
            }));

            // Enqueue welcome notification
            await this.notificationsService.queueVipWelcome({
              toEmail: email,
              toName: name,
              ticketId: ticket.id,
              userId: user.id,
              concertName: concert.name,
            });

            successRows++;
          });
        } catch (rowError: any) {
          errorRows++;
          const status = rowError.isSkip ? CsvRowStatus.SKIPPED_DUPLICATE : CsvRowStatus.ERROR;
          const reason = rowError.message || 'Unknown processing error';
          await this.repo.createRowOutcome(jobId, rowNumber, status, reason);
        }
      }

      // Update final job statistics and status
      const finalStatus = errorRows === 0 ? CsvImportJobStatus.COMPLETED : 
                          successRows === 0 ? CsvImportJobStatus.FAILED : 
                          CsvImportJobStatus.PARTIALLY_COMPLETED;

      await this.repo.updateJobStats(jobId, {
        totalRows: records.length,
        successRows,
        errorRows,
        status: finalStatus,
      });

      this.logger.log(`CSV Import Job ${jobId} completed. status=${finalStatus}, total=${records.length}, success=${successRows}, error=${errorRows}`);

    } catch (jobError: any) {
      const message = jobError instanceof Error ? jobError.message : 'Unknown error';
      this.logger.error(`Failed to process CSV Import Job ${jobId} (attempt ${job.attemptsMade + 1}): ${message}`);

      const maxAttempts = job.opts?.attempts || 1;
      const isLastAttempt = job.attemptsMade + 1 >= maxAttempts;

      if (isLastAttempt) {
        await this.repo.updateJobStats(jobId, {
          totalRows: records.length || 0,
          successRows,
          errorRows,
          status: CsvImportJobStatus.FAILED,
          failureReason: message,
        });
      } else {
        await this.repo.updateJobStats(jobId, {
          totalRows: records.length || 0,
          successRows,
          errorRows,
          status: CsvImportJobStatus.PROCESSING,
          failureReason: `Attempt ${job.attemptsMade + 1} failed: ${message}`,
        });
      }
      throw jobError;
    }
  }
}
