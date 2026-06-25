import { Module } from '@nestjs/common';
import { ReportingController } from './reporting.controller';
import { ReportingService } from './reporting.service';
import { ReportingRepository } from './reporting.repository';
import { DatabaseModule } from '../../database/database.module';
/**
 * ReportingModule — read-only aggregation queries.
 *
 * Dependency rules:
 *   - Uses DataSource (injected via TypeORM) to run raw aggregation queries.
 *   - Does NOT import any other domain module's repository.
 *   - Scoped by Organizer ownership or System Admin.
 */
@Module({
  imports: [DatabaseModule],
  controllers: [ReportingController],
  providers: [ReportingService, ReportingRepository],
})
export class ReportingModule {}
