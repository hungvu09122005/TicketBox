import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CheckinLog } from './entities/checkin-log.entity';
import { CheckinController } from './checkin.controller';
import { CheckinService } from './checkin.service';
//import { CheckinRepository } from './checkin.repository';
import { TicketsModule } from '../tickets/tickets.module';

/**
 * CheckinModule — online + offline check-in and sync.
 *
 * Dependency rules:
 *   - Imports TicketsModule → TicketsService.verifyAndMarkUsed()
 *   - Conflict resolution (multi-device) handled in CheckinService via timestamp comparison
 *   - client_event_id UNIQUE constraint handles offline sync idempotency at DB level
 *   - Does NOT import OrdersModule or PaymentsModule
 */
@Module({
  imports: [TypeOrmModule.forFeature([CheckinLog]), TicketsModule],
  controllers: [CheckinController],
  providers: [CheckinService],
})
export class CheckinModule {}
