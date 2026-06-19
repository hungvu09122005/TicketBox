import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from './entities/payment.entity';

@Injectable()
export class PaymentsRepository {
  constructor(@InjectRepository(Payment) private readonly repo: Repository<Payment>) {}
  async create(payment: Partial<Payment>): Promise<Payment> {
    const newPayment = this.repo.create(payment);
    return await this.repo.save(newPayment);
  }

  async findByIdempotencyKey(idempotencyKey: string): Promise<Payment | null> {
    return await this.repo.findOne({ where: { idempotencyKey } });
  }

  async findByProviderTxId(providerTxId: string): Promise<Payment | null> {
    return await this.repo.findOne({ where: { providerTxId } });
  }

}
