import { Injectable, Inject } from '@nestjs/common';
import { PaymentPort, PAYMENT_PORT } from '../../common/ports/payment.port';
import { PaymentsRepository } from './payments.repository';
import { OrdersService } from '../orders/orders.service';
import { TicketsService } from '../tickets/tickets.service';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * PaymentsService — application service.
 *
 * Critical rules (Blueprint §05 §3.1):
 *   - initiatePayment(): generates idempotency_key → stores pending Payment → calls PaymentPort
 *   - handleCallback(): verifies signature via PaymentPort → idempotency via provider_tx_id UNIQUE
 *     → atomic: markOrderPaid + confirmInventory + issueTickets + enqueueNotification
 *   - NEVER trust payment status from frontend
 *   - Circuit breaker on PaymentPort (Phase 3)
 */
@Injectable()
export class PaymentsService {
  constructor(
    private readonly paymentsRepository: PaymentsRepository,
    @Inject(PAYMENT_PORT) private readonly paymentPort: PaymentPort,
    private readonly ordersService: OrdersService,
    private readonly ticketsService: TicketsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // TODO Phase 3: initiatePayment(orderId, userId), handleVnpayCallback(rawQuery)
}
