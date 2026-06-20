import { Injectable, Inject, ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import { Injectable, Inject, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PaymentPort, PAYMENT_PORT } from '../../common/ports/payment.port';
import { PaymentsRepository } from './payments.repository';
import { Payment, PaymentStatus } from './entities/payment.entity';
import { OrdersService } from '../orders/orders.service';
import { TicketsService } from '../tickets/tickets.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentStatus } from './entities/payment.entity';
import { Payment } from './entities/payment.entity';
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

  async initiatePayment(orderId: string, userId: string, idempotencyKey: string, ipAddress: string) {
    const order = await this.ordersService.findOne(orderId);
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (order.userId !== userId) {
      throw new ForbiddenException('You cannot pay for this order');
    }
    if (order.status !== 'PENDING_PAYMENT') {
      throw new ConflictException('Order is not waiting for payment');
    }

    const pendingPayment = await this.paymentsRepository.findLatestPendingByOrderId(order.id);
    const existingPayment =
      pendingPayment ?? (await this.paymentsRepository.findByIdempotencyKey(idempotencyKey));

    if (existingPayment) {
      const paymentUrl = await this.paymentPort.createPaymentUrl({
        orderId: existingPayment.orderId,
        amount: Number(existingPayment.amount),
        orderDescription: `Thanh toán đơn hàng ${existingPayment.orderId}`,
        ipAddress,
        idempotencyKey: existingPayment.idempotencyKey,
      });

      return { paymentUrl, paymentId: existingPayment.id };
    }

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

    return {
      paymentId: payment.id,
      paymentUrl,
    };
  }

  async handleVnpayCallback(query: Record<string, string>) {
    const callback = await this.paymentPort.verifyCallback(query);
    if (!callback) {
      return { success: false, message: 'Invalid payment signature' };
    }

    const payment = await this.paymentsRepository.findByOrderId(callback.orderId);
    if (!payment) {
      return { success: false, message: 'Payment record not found' };
    }

    if (payment.status === PaymentStatus.CONFIRMED) {
      return { success: true, message: 'Already processed' };
    }

    await this.paymentsRepository.updateStatus(
      payment.id,
      callback.status === 'SUCCESS' ? PaymentStatus.CONFIRMED : PaymentStatus.FAILED,
      callback.providerTransactionId,
      callback.rawData,
    );

    if (callback.status !== 'SUCCESS') {
      return { success: true, message: 'Payment failed' };
    }

    const order = await this.ordersService.markPaid(callback.orderId, payment.id);
    const tickets = await this.ticketsService.issueTickets(order as Order);

    return {
      success: true,
      orderId: order.id,
      paymentId: payment.id,
      ticketsIssued: tickets.length,
    };
  }
}
