import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TicketType } from './entities/ticket-type.entity';
import { TicketTypesController } from './ticket-types.controller';
import { TicketTypesService } from './ticket-types.service';
import { TicketTypesRepository } from './ticket-types.repository';

/**
 * TicketTypesModule — owns TicketType entity and inventory management.
 *
 * Boundary rules:
 *   - Exports TicketTypesService for OrdersModule (inventory lock + decrement).
 *   - Pessimistic row-level lock logic lives inside TicketTypesRepository.lockForUpdate().
 *   - Redis availability cache is managed by TicketTypesService.
 */
@Module({
  imports: [TypeOrmModule.forFeature([TicketType])],
  controllers: [TicketTypesController],
  providers: [TicketTypesService, TicketTypesRepository],
  exports: [TicketTypesService],
})
export class TicketTypesModule {}
