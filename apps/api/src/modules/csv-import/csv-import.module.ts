import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { CsvImportJob } from './entities/csv-import-job.entity';
import { CsvImportRow } from './entities/csv-import-row.entity';
import { VipGuest } from './entities/vip-guest.entity';
import { CsvImportController } from './csv-import.controller';
import { CsvImportService } from './csv-import.service';
import { CsvImportRepository } from './csv-import.repository';
import { CsvImportProcessor } from './processors/csv-import.processor';
import { TicketsModule } from '../tickets/tickets.module';
import { NotificationsModule } from '../notifications/notifications.module';

/**
 * CsvImportModule — VIP guest import pipeline.
 *
 * Dependency rules:
 *   - Imports TicketsModule → TicketsService.issueVipTicket()
 *   - Imports NotificationsModule → NotificationsService.enqueueVipWelcome()
 *   - CSV binary in Object Storage (key in csv_import_jobs.object_key)
 *   - All processing async via BullMQ queue 'csv-import'
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([CsvImportJob, CsvImportRow, VipGuest]),
    BullModule.registerQueue({ name: 'csv-import' }),
    TicketsModule,
    NotificationsModule,
  ],
  controllers: [CsvImportController],
  providers: [CsvImportService, CsvImportRepository, CsvImportProcessor],
  exports: [CsvImportService],
})
export class CsvImportModule {}
