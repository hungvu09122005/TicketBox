import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TicketType } from './entities/ticket-type.entity';

/** Private to TicketTypesModule. OrdersModule accesses inventory only via TicketTypesService. */
@Injectable()
export class TicketTypesRepository {
  constructor(@InjectRepository(TicketType) private readonly repo: Repository<TicketType>) {}
  // TODO Phase 2: findByConcertId, lockForUpdate (SELECT FOR UPDATE), adjustInventory
}
