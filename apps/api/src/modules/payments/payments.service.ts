import { Injectable, Inject, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PaymentPort, PAYMENT_PORT } from '../../common/ports/payment.port';
import { PaymentsRepository } from './payments.repository';
import { Payment, PaymentStatus } from './entities/payment.entity';
import { OrdersService } from '../orders/orders.service';
import { TicketsService } from '../tickets/tickets.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OrderStatus } from '../orders/enums/order-status.enum';

import { Order } from '../orders/entities/order.entity';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly paymentsRepository: PaymentsRepository,
    @Inject(PAYMENT_PORT) private readonly paymentPort: PaymentPort,
    private readonly ordersService: OrdersService,
    private readonly ticketsService: TicketsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async initiatePayment(orderId: string, ipAddress: string): Promise<{ paymentUrl: string }> {
    const order = await this.ordersService.findOne(orderId);
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      throw new ConflictException('Order is not in pending payment state');
    }

    const idempotencyKey = `payment_${orderId}_${Date.now()}`;

    const payment = await this.paymentsRepository.create({
      orderId: order.id,
      idempotencyKey,
      provider: 'VNPAY',
      amount: order.totalAmount,
      status: PaymentStatus.PENDING,
    });

    const paymentUrl = await this.paymentPort.createPaymentUrl({
      orderId: order.id,
      amount: order.totalAmount,
      orderDescription: `TicketBox payment for order ${order.id}`,
      ipAddress,
      idempotencyKey,
    });

    return { paymentUrl };
  }

  async handleVnpayCallback(rawQuery: Record<string, string>): Promise<void> {
    const result = await this.paymentPort.verifyCallback(rawQuery);
    if (!result) {
      this.logger.error('Invalid payment callback signature');
      return;
    }

    const { orderId, providerTransactionId, status, rawData } = result;

    await this.dataSource.transaction(async (manager) => {
      // Find the order, locking it
      const order = await manager.findOne(Order, {
        where: { id: orderId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!order) {
        this.logger.warn(`Callback received for unknown order: ${orderId}`);
        return;
      }

      // Check for idempotency
      if (order.status === OrderStatus.PAID) {
        this.logger.log(`Order ${orderId} is already paid. Ignoring callback.`);
        return;
      }

      // Find the pending payment record
      let payment = await manager.findOne(Payment, { where: { orderId, status: PaymentStatus.PENDING } });
      if (!payment) {
        this.logger.warn(`No pending payment found for order: ${orderId}`);
        return;
      }

      // Check provider tx idempotency
      const existingTx = await manager.findOne(Payment, { where: { providerTxId: providerTransactionId } });
      if (existingTx && existingTx.id !== payment.id) {
        this.logger.warn(`Duplicate provider tx id: ${providerTransactionId}`);
        return;
      }

      payment.providerTxId = providerTransactionId;
      payment.rawCallback = rawData;

      if (status === 'SUCCESS') {
        payment.status = PaymentStatus.CONFIRMED;
        await manager.save(payment);

        order.status = OrderStatus.PAID;
        await manager.save(order);

        // This will decrement held_quantity and increment sold_quantity
        await this.ordersService.markPaid(order.id, payment.id);

        // Issue tickets
        await this.ticketsService.issueTicketsForOrder(order, manager);

        // Enqueue notification (mocked for now or assuming the method exists)
        // await this.notificationsService.enqueueTicketConfirmation(order.userId, order.id);
        
        this.logger.log(`Payment confirmed and tickets issued for order: ${order.id}`);
      } else {
        payment.status = PaymentStatus.FAILED;
        await manager.save(payment);
        
        // order.status is still PENDING_PAYMENT, let it expire naturally or explicitly cancel it
        // Depending on business rules, we might want to release inventory now or wait for expiry.
        // Rule 01 says: On failure, cancellation, or expiry: release held inventory exactly once.
        // We can let the expiry job handle it, or call expireOrder immediately.
        // Let's call expireOrder.
        await this.ordersService.expireOrder(order.id);
        
        this.logger.log(`Payment failed for order: ${order.id}`);
      }
    });
  }
}
