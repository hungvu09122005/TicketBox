import { Injectable, Inject, ForbiddenException, NotFoundException, ConflictException, Logger, ServiceUnavailableException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { PaymentPort, PAYMENT_PORT, CreatePaymentParams } from '../../common/ports/payment.port';
import { PaymentsRepository } from './payments.repository';
import { PaymentStatus, Payment } from './entities/payment.entity';
import { OrdersService } from '../orders/orders.service';
import { TicketsService } from '../tickets/tickets.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Order } from '../orders/entities/order.entity';
import CircuitBreaker = require('opossum') ;

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private paymentUrlBreaker: CircuitBreaker<any[], string>;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
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
    try {
      console.log('===== INITIATE PAYMENT START =====');
      console.log({ orderId, userId, idempotencyKey, ipAddress });

      const order = await this.ordersService.findOne(orderId);
      console.log('PAYMENT_ORDER:', order);

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
          orderDescription: `Thanh toan don hang ${existingPayment.orderId}`,
          ipAddress,
          idempotencyKey: existingPayment.idempotencyKey,
        });

        return { paymentUrl, paymentId: existingPayment.id };
      }

      let payment: Payment;
      try {
        payment = await this.paymentsRepository.create({
          orderId: order.id,
          idempotencyKey,
          provider: 'VNPAY',
          amount: order.totalAmount,
          status: PaymentStatus.PENDING,
        });
      } catch (err: any) {
        // Handle database unique constraint violation (code '23505' or duplicate key error)
        if (
          err.code === '23505' ||
          err.message?.includes('duplicate key') ||
          err.message?.includes('UQ_') ||
          err.message?.includes('unique constraint')
        ) {
          const retriedPayment = await this.paymentsRepository.findByIdempotencyKey(idempotencyKey);
          if (retriedPayment) {
            const paymentUrl = await this.paymentUrlBreaker.fire({
              orderId: retriedPayment.orderId,
              amount: Number(retriedPayment.amount),
              orderDescription: `Thanh toan don hang ${retriedPayment.orderId}`,
              ipAddress,
              idempotencyKey: retriedPayment.idempotencyKey,
            });
            return { paymentUrl, paymentId: retriedPayment.id };
          }
        }
        throw err;
      }

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
    } catch (err) {
      console.error('=========== PAYMENT_ERROR ===========');
      console.error(err);
      console.error(err instanceof Error ? err.stack : err);
      console.error('=====================================');
      throw err;
    }
  }

  async handleVnpayCallback(query: Record<string, string>) {
    const callback = await this.paymentPort.verifyCallback(query);
    if (!callback) return { success: false, message: 'Invalid payment signature' };

    let ticketsToSend: any[] = [];
    let notificationPayload: any = null;

    const result = await this.dataSource.transaction(async (manager) => {
      // Find and lock the payment record
      const payment = await manager.createQueryBuilder(Payment, 'p')
        .setLock('pessimistic_write')
        .where('p.orderId = :orderId', { orderId: callback.orderId })
        .getOne();

      if (!payment) return { success: false, message: 'Payment record not found' };

      if (payment.status === PaymentStatus.CONFIRMED || payment.status === PaymentStatus.FAILED) {
        return { success: payment.status === PaymentStatus.CONFIRMED, message: 'Already processed' };
      }

      if (Number(payment.amount) !== callback.amount) {
        payment.status = PaymentStatus.FAILED;
        if (callback.providerTransactionId) {
          payment.providerTxId = callback.providerTransactionId;
        }
        payment.rawCallback = callback.rawData;
        await manager.save(Payment, payment);

        await this.ordersService.markPaymentFailed(callback.orderId, manager);
        return { success: false, message: 'Invalid payment amount' };
      }

      payment.status = callback.status === 'SUCCESS' ? PaymentStatus.CONFIRMED : PaymentStatus.FAILED;
      if (callback.providerTransactionId) {
        payment.providerTxId = callback.providerTransactionId;
      }
      payment.rawCallback = callback.rawData;
      await manager.save(Payment, payment);

      if (callback.status !== 'SUCCESS') {
        await this.ordersService.markPaymentFailed(callback.orderId, manager);
        return { success: true, message: 'Payment failed' };
      }

      const order = await this.ordersService.markPaid(callback.orderId, payment.id, manager);
      if (!order) {
        throw new NotFoundException('Order processing failed');
      }

      const tickets = await this.ticketsService.issueTickets(order, manager);
      ticketsToSend = tickets;
      notificationPayload = {
        email: order.user?.email,
        name: order.user?.name || order.user?.email,
        userId: order.userId,
        orderId: order.id,
        concertId: order.concertId,
        createdAt: order.createdAt,
        ticketTypeId: order.ticketTypeId,
      };

      return {
        success: true,
        orderId: order.id,
        paymentId: payment.id,
        ticketsIssued: tickets.length,
      };
    });

    // Outside the transaction, enqueue notification
    if (result.success && ticketsToSend.length > 0 && notificationPayload) {
      for (const ticket of ticketsToSend) {
        void this.notificationsService.queueTicketConfirmation({
          toEmail: notificationPayload.email,
          toName: notificationPayload.name,
          ticketId: ticket.id,
          userId: notificationPayload.userId,
          orderId: notificationPayload.orderId,
          concertName: `Concert ${notificationPayload.concertId}`,
          concertDate: notificationPayload.createdAt,
          venue: `Concert venue ${notificationPayload.concertId}`,
          ticketTypeName: ticket.ticketType?.name || notificationPayload.ticketTypeId,
          qrToken: ticket.qrToken,
        }).catch((err) => {
          this.logger.error(`Queue ticket confirmation failed for ticket ${ticket.id}: ${err.message}`);
        });
      }
    }

    return result;
  }

  async getPaymentStatus(orderId: string, userId: string, isAdmin: boolean) {
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

  async getPaymentHistory(orderId: string, userId: string, isAdmin: boolean) {
    const order = await this.ordersService.findOne(orderId);
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (!isAdmin && order.userId !== userId) {
      throw new ForbiddenException('Cannot view payment history for this order');
    }

    const payments = await this.paymentsRepository.findAllByOrderId(orderId);
    return payments;
  }

  async getPaymentAudit(orderId: string, userId: string, isAdmin: boolean) {
    const order = await this.ordersService.findOne(orderId);
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (!isAdmin && order.userId !== userId) {
      throw new ForbiddenException('Cannot view payment audit for this order');
    }

    const payments = await this.paymentsRepository.findAllByOrderId(orderId);
    return payments.map((payment) => ({
      id: payment.id,
      orderId: payment.orderId,
      provider: payment.provider,
      providerTransactionId: payment.providerTxId ?? null,
      status: payment.status,
      amount: payment.amount,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
      rawCallback: payment.rawCallback ?? null,
    }));
  }
}
