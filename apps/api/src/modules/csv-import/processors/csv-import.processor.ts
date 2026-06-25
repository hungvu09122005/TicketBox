import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger, Inject } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { parse } from 'csv-parse';
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
import { InjectEntityManager } from '@nestjs/typeorm';

export const CSV_IMPORT_JOB = 'csv.import';

type NormalizedCsvRecord = {
  email?: string;
  name?: string;
  phone?: string;
  ticketTypeId?: string;
  [key: string]: string | undefined;
};

type CsvParserData = {
  record: NormalizedCsvRecord;
  info?: {
    lines?: number;
  };
};

function compactWhitespace(value: unknown): string {
  return String(value ?? '')
    .normalize('NFC')
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeEmail(value: unknown): string {
  return compactWhitespace(value).toLowerCase();
}

function normalizePhone(value: unknown): string {
  const raw = compactWhitespace(value);

  if (!raw) return '';

  const hasPlus = raw.startsWith('+');
  const digits = raw.replace(/[^\d]/g, '');

  return hasPlus ? `+${digits}` : digits;
}

function normalizeHeader(header: string): string {
  const key = compactWhitespace(header)
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
  };

  return mapping[key] ?? key;
}

function normalizeRecord(record: NormalizedCsvRecord): NormalizedCsvRecord {
  return {
    ...record,
    email: normalizeEmail(record.email),
    name: compactWhitespace(record.name),
    phone: normalizePhone(record.phone),
    ticketTypeId: compactWhitespace(record.ticketTypeId),
  };
}

function validateRecord(record: NormalizedCsvRecord): string | null {
  if (!record.email) return 'Missing email';
  if (!record.name) return 'Missing name';
  if (!record.ticketTypeId) return 'Missing ticket type';

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(record.email)) {
    return 'Invalid email format';
  }

  if (record.phone && !/^\+?\d{8,15}$/.test(record.phone)) {
    return 'Invalid phone format';
  }

  return null;
}

@Processor('csv-import')
export class CsvImportProcessor {
  private readonly logger = new Logger(CsvImportProcessor.name);

  constructor(
    private readonly repo: CsvImportRepository,
    @Inject(OBJECT_STORAGE_PORT) private readonly storage: ObjectStoragePort,
    private readonly ticketsService: TicketsService,
    private readonly notificationsService: NotificationsService,
     @InjectEntityManager()
    private readonly manager: EntityManager,
  ) {}

@Process(CSV_IMPORT_JOB)
  async handle(
  job: Job<{ jobId: string; fileUrl?: string; objectKey?: string; concertId: string }>,
): Promise<void> {
  const { jobId, concertId } = job.data;
  const objectKey = job.data.objectKey ?? job.data.fileUrl;

  if (!objectKey) {
    throw new Error(`CSV import job ${jobId} has no objectKey/fileUrl in payload`);
  };
    this.logger.log(`Processing CSV Import Job: ${jobId}`);

    const importJob = await this.repo.findById(jobId);
if (!importJob) {
  throw new Error(`CSV import job ${jobId} not found in database`);
}

    let totalRows = 0;
    let successRows = 0;
    let errorRows = 0;

    try {
      await this.repo.updateStatus(jobId, CsvImportJobStatus.PROCESSING);

      const concert = await this.manager.findOne(Concert, { where: { id: concertId } });
      if (!concert) {
        throw new Error(`Concert ${concertId} not found`);
      }

      const processedEmails = new Set<string>();
      const processedPhones = new Set<string>();

      const stream = await this.storage.downloadStream(objectKey);

      let requiredHeadersChecked = false;

      const parser = stream.pipe(
        parse({
          bom: true,
          columns: (headers: string[]) => {
            const normalizedHeaders = headers.map(normalizeHeader);
            const requiredHeaders = ['email', 'name', 'ticketTypeId'];
            const missingHeaders = requiredHeaders.filter(
              (header) => !normalizedHeaders.includes(header),
            );

            if (missingHeaders.length > 0) {
              throw new Error(`CSV is missing required headers: ${missingHeaders.join(', ')}`);
            }

            requiredHeadersChecked = true;
            return normalizedHeaders;
          },
          info: true,
          skip_empty_lines: true,
          trim: true,
        }),
      );

      for await (const parserData of parser as AsyncIterable<CsvParserData>) {
        totalRows += 1;

        const rowNumber = parserData.info?.lines ?? totalRows + 1;
        const record = normalizeRecord(parserData.record);

        const validationError = validateRecord(record);
        if (validationError) {
          errorRows += 1;
          await this.repo.createRowOutcome(
            jobId,
            rowNumber,
            CsvRowStatus.ERROR,
            validationError,
          );
          continue;
        }

        const email = record.email!;
        const name = record.name!;
        const ticketTypeId = record.ticketTypeId!;
        const phone = record.phone || '';

        const dedupKey = email;

        if (processedEmails.has(dedupKey)) {
          errorRows += 1;
          await this.repo.createRowOutcome(
            jobId,
            rowNumber,
            CsvRowStatus.SKIPPED_DUPLICATE,
            'Duplicate email in CSV file',
          );
          continue;
        }

        if (phone && processedPhones.has(phone)) {
          errorRows += 1;
          await this.repo.createRowOutcome(
            jobId,
            rowNumber,
            CsvRowStatus.SKIPPED_DUPLICATE,
            'Duplicate phone in CSV file',
          );
          continue;
        }

        processedEmails.add(dedupKey);
        if (phone) {
          processedPhones.add(phone);
        }

        try {
  const notificationPayload = await this.manager.transaction(async (m) => {
    const ticketType = await m.findOne(TicketType, {
      where: { id: ticketTypeId, concertId },
    });

    if (!ticketType) {
      throw new Error(`Ticket type ${ticketTypeId} not found for this concert`);
    }

    let user = await m.findOne(User, { where: { email } });

    if (!user) {
      const passwordHash = await bcrypt.hash(
        crypto.randomBytes(16).toString('hex'),
        12,
      );

      const audienceRole = await m.findOne(RoleEntity, {
        where: { name: Role.AUDIENCE },
      });

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

    const existingGuest = await m.findOne(VipGuest, {
      where: [
        { concertId, email },
        ...(phone ? [{ concertId, phone }] : []),
      ],
    });

    if (existingGuest && existingGuest.csvImportJobId !== jobId) {
      const skipErr = new Error('Duplicate email or phone in database');
      (skipErr as any).isSkip = true;
      throw skipErr;
    }

    let vipGuest = existingGuest;
    let ticketId = existingGuest?.ticketId;

    if (!vipGuest) {
      vipGuest = m.create(VipGuest, {
        concertId,
        ticketTypeId,
        csvImportJobId: jobId,
        email,
        name,
        phone: phone || undefined,
        dedupKey,
      });

      await m.save(VipGuest, vipGuest);
    }

    if (!ticketId) {
      const ticket = await this.ticketsService.issueVipTicket(
        {
          userId: user.id,
          concertId,
          ticketTypeId,
        },
        m,
      );

      ticketId = ticket.id;
      vipGuest.ticketId = ticket.id;
      await m.save(VipGuest, vipGuest);
    }

    if (!ticketId) {
      throw new Error('VIP ticket was not issued');
    }

    const existingRow = await m.findOne(CsvImportRow, {
      where: { jobId, rowNumber },
    });

    if (existingRow) {
      existingRow.status = CsvRowStatus.SUCCESS;
      existingRow.errorReason = undefined;
      await m.save(CsvImportRow, existingRow);
    } else {
      await m.save(
        CsvImportRow,
        m.create(CsvImportRow, {
          jobId,
          rowNumber,
          status: CsvRowStatus.SUCCESS,
        }),
      );
    }

    return {
      toEmail: email,
      toName: name,
      ticketId,
      userId: user.id,
      concertName: concert.name,
    };
  });

  await this.notificationsService.queueVipWelcome(notificationPayload);

  successRows += 1;
} catch (rowError: any) {
  errorRows += 1;

  const status = rowError.isSkip
    ? CsvRowStatus.SKIPPED_DUPLICATE
    : CsvRowStatus.ERROR;

  const reason = rowError.message || 'Unknown processing error';

  await this.repo.createRowOutcome(jobId, rowNumber, status, reason);
}

      }


      if (!requiredHeadersChecked) {
        throw new Error('CSV file is empty or has no header row');
      }

      const finalStatus =
        errorRows === 0
          ? CsvImportJobStatus.COMPLETED
          : successRows === 0
            ? CsvImportJobStatus.FAILED
            : CsvImportJobStatus.PARTIALLY_COMPLETED;

      await this.repo.updateJobStats(jobId, {
        totalRows,
        successRows,
        errorRows,
        status: finalStatus,
      });

      this.logger.log(
        `CSV Import Job ${jobId} completed. status=${finalStatus}, total=${totalRows}, success=${successRows}, error=${errorRows}`,
      );
    } catch (jobError: any) {
      const message = jobError instanceof Error ? jobError.message : 'Unknown error';

      this.logger.error(
        `Failed to process CSV Import Job ${jobId} (attempt ${job.attemptsMade + 1}): ${message}`,
      );

      const maxAttempts = job.opts?.attempts || 1;
      const isLastAttempt = job.attemptsMade + 1 >= maxAttempts;

      await this.repo.updateJobStats(jobId, {
        totalRows,
        successRows,
        errorRows,
        status: isLastAttempt
          ? CsvImportJobStatus.FAILED
          : CsvImportJobStatus.PROCESSING,
        failureReason: isLastAttempt
          ? message
          : `Attempt ${job.attemptsMade + 1} failed: ${message}`,
      });

      throw jobError;
    }
  }
}
