import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket } from './entities/ticket.entity';

@Injectable()
export class TicketsRepository {
  constructor(@InjectRepository(Ticket) private readonly repo: Repository<Ticket>) {}
  // TODO Phase 3: bulkCreate, findByUser, findByQrToken, markUsed
}
