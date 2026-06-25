import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from './entities/payment.entity';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentsRepository } from './payments.repository';
import { VnpayAdapter } from './adapters/vnpay.adapter';
import { PAYMENT_PORT } from '../../common/ports/payment.port';
import { OrdersModule } from '../orders/orders.module';
import { TicketsModule } from '../tickets/tickets.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { DatabaseModule } from '../../database/database.module';
/**
 * PaymentsModule — owns Payment entity, payment gateway integration, callback handling.
 *
 * Dependency rules:
 *   - Imports OrdersModule → OrdersService.markOrderPaid() / findById()
 *   - Imports TicketsModule → TicketsService.issueTickets() (after payment confirmed)
 *   - Imports NotificationsModule → NotificationsService.enqueueTicketConfirmation()
 *   - PaymentPort is fulfilled by VnpayAdapter (swap to MomoAdapter without changing service)
 *   - Circuit breaker is applied inside PaymentsService wrapping the PaymentPort call
 *   - Callback endpoint is PUBLIC but signature-verified inside service
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Payment]),
    OrdersModule,
    TicketsModule,
    NotificationsModule,
    DatabaseModule,
  ],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    PaymentsRepository,
    { provide: PAYMENT_PORT, useClass: VnpayAdapter },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
