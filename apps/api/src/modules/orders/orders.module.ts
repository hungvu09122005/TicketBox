import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrdersRepository } from './orders.repository';
import { OrderExpiryProcessor } from './processors/order-expiry.processor';
import { ConcertsModule } from '../concerts/concerts.module';
import { TicketTypesModule } from '../ticket-types/ticket-types.module';

/**
 * OrdersModule — owns Order, OrderItem entities and the core purchase transaction.
 *
 * Dependency rules:
 *   - Imports ConcertsModule → ConcertsService.assertPublishedAndSaleOpen()
 *   - Imports TicketTypesModule → TicketTypesService.holdInventory() / releaseInventory()
 *   - Does NOT import PaymentsModule or TicketsModule (they import OrdersModule)
 *   - BullMQ queue 'orders' hosts the order-expiry delayed job
 *   - Exports OrdersService for PaymentsModule (callback must update order state)
 *
 * CRITICAL: The pessimistic lock transaction (SELECT FOR UPDATE on ticket_types)
 *           happens inside OrdersService.createOrder() using DataSource.transaction().
 *           Lock is acquired THEN committed BEFORE any external payment call.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem]),
    BullModule.registerQueue({ name: 'orders' }),
    ConcertsModule,
    TicketTypesModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersRepository, OrderExpiryProcessor],
  exports: [OrdersService],
})
export class OrdersModule {}
