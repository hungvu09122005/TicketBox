import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from './entities/payment.entity';

@Injectable()
export class PaymentsRepository {
  constructor(@InjectRepository(Payment) private readonly repo: Repository<Payment>) {}
  // TODO Phase 3: create, findByIdempotencyKey, findByProviderTxId, updateStatus
}
