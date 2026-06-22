import { Injectable, Inject, ForbiddenException, NotFoundException, ConflictException, Logger, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PaymentPort, PAYMENT_PORT, CreatePaymentParams } from '../../common/ports/payment.port';
import { PaymentsRepository } from './payments.repository';
import { Payment, PaymentStatus } from './entities/payment.entity';
import { OrdersService } from '../orders/orders.service';
import { TicketsService } from '../tickets/tickets.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OrderStatus } from '../orders/enums/order-status.enum';
import { Order } from '../orders/entities/order.entity';
import { createCircuitBreaker } from '../../common/utils/circuit-breaker.factory';
import CircuitBreaker = require('opossum') ;

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private paymentUrlBreaker: CircuitBreaker<any[], string>;

  constructor(
    private readonly dataSource: DataSource,
    private readonly paymentsRepository: PaymentsRepository,
    @Inject(PAYMENT_PORT) private readonly paymentPort: PaymentPort,
    private readonly ordersService: OrdersService,
    private readonly ticketsService: TicketsService,
    private readonly notificationsService: NotificationsService,
  ) {
    this.paymentUrlBreaker = new CircuitBreaker(
      async (params: CreatePaymentParams) => this.paymentPort.createPaymentUrl(params),
      {
        name: 'PaymentUrlGeneration',
        timeout: 5000,
        errorThresholdPercentage: 50,
        resetTimeout: 10000,
      }
    );

    this.paymentUrlBreaker.fallback(() => {
      throw new ServiceUnavailableException('Payment gateway is currently unavailable. Please try again later.');
    });
  }

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

    let existingPayment = await this.paymentsRepository.findByIdempotencyKey(idempotencyKey);
    if (!existingPayment) {
      existingPayment = await this.paymentsRepository.findLatestPendingByOrderId(order.id);
    }

    if (existingPayment) {
      const paymentUrl = await this.paymentUrlBreaker.fire({
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

    const paymentUrl = await this.paymentUrlBreaker.fire({
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
    if (!callback) return { success: false, message: 'Invalid payment signature' };

    const payment = await this.paymentsRepository.findByOrderId(callback.orderId);
    if (!payment) return { success: false, message: 'Payment record not found' };
    

    if (payment.status === PaymentStatus.CONFIRMED || payment.status === PaymentStatus.FAILED) {
      return { success: payment.status === PaymentStatus.CONFIRMED, message: 'Already processed' };
    }

    if (Number(payment.amount) !== callback.amount) {
      await this.paymentsRepository.updateStatus(
        payment.id,
        PaymentStatus.FAILED,
        callback.providerTransactionId,
        callback.rawData,
      );
      await this.ordersService.markPaymentFailed(callback.orderId);
      return { success: false, message: 'Invalid payment amount' };
    }

    await this.paymentsRepository.updateStatus(
      payment.id,
      callback.status === 'SUCCESS' ? PaymentStatus.CONFIRMED : PaymentStatus.FAILED,
      callback.providerTransactionId,
      callback.rawData,
    );

    if (callback.status !== 'SUCCESS') {
      await this.ordersService.markPaymentFailed(callback.orderId);
      return { success: true, message: 'Payment failed' };
    }

    const order = await this.ordersService.markPaid(callback.orderId, payment.id);
  if (!order) {
     throw new NotFoundException('Order processing failed');
  }
    const tickets = await this.ticketsService.issueTickets(order as Order);

    return {
      success: true,
      orderId: order.id,
      paymentId: payment.id,
      ticketsIssued: tickets.length,
    };
  }

  // Trong PaymentsService.ts
async getPaymentStatus(orderId: string, userId: string, isAdmin: boolean) {
  // SỬA: Dùng findOne thay vì markPaid
  const order = await this.ordersService.findOne(orderId);
  
  if (!order) {
    throw new NotFoundException('Order not found');
  }

  if (!isAdmin && order.userId !== userId) {
    throw new ForbiddenException('Cannot view payment status for this order');
  }

  const payment = await this.paymentsRepository.findLatestPendingByOrderId(orderId) 
                 ?? await this.paymentsRepository.findByOrderId(orderId);
                 
  if (!payment) {
    return { status: 'NO_PAYMENT_INITIATED', orderStatus: order.status };
  }

  return {
    paymentId: payment.id,
    status: payment.status,
    provider: payment.provider,
    orderStatus: order.status,
    amount: payment.amount,
    createdAt: payment.createdAt,
  };
}
}