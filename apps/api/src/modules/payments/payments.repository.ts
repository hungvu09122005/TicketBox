import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, PaymentStatus } from './entities/payment.entity';

@Injectable()
export class PaymentsRepository {
  constructor(@InjectRepository(Payment) private readonly repo: Repository<Payment>) {}

  create(data: Partial<Payment>) {
    return this.repo.save(this.repo.create(data));
  }

  findById(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  findByOrderId(orderId: string) {
    return this.repo.findOne({ where: { orderId } });
  }

  findAllByOrderId(orderId: string) {
    return this.repo.find({ 
      where: { orderId },
      order: { createdAt: 'DESC' }
    });
  }

  findLatestPendingByOrderId(orderId: string) {
    return this.repo.findOne({
      where: { orderId, status: PaymentStatus.PENDING },
      order: { createdAt: 'DESC' },
    });
  }

  findByIdempotencyKey(idempotencyKey: string) {
    return this.repo.findOne({ where: { idempotencyKey } });
  }

  findByProviderTxId(providerTxId: string) {
    return this.repo.findOne({ where: { providerTxId } });
  }

  async updateStatus(id: string, status: PaymentStatus, providerTxId?: string, rawCallback?: Record<string, unknown>) {
    const payment = await this.repo.findOne({ where: { id } });
    if (!payment) return null;

    payment.status = status;
    if (providerTxId !== undefined) {
      payment.providerTxId = providerTxId;
    }
    if (rawCallback !== undefined) {
      payment.rawCallback = rawCallback;
    }

    return this.repo.save(payment);
  }
}
