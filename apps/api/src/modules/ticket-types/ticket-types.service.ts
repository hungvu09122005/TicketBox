import { Injectable } from '@nestjs/common';
import { TicketTypesRepository } from './ticket-types.repository';

/**
 * TicketTypesService — exported surface for TicketTypesModule.
 * OrdersModule calls holdInventory / releaseInventory / confirmInventory here.
 * Redis availability cache managed here (Blueprint §07 §2, TTL 5-10s).
 */
@Injectable()
export class TicketTypesService {
  constructor(private readonly repo: TicketTypesRepository) {}
  // TODO Phase 2: findByConcertId, holdInventory, releaseInventory, confirmInventory, getAvailability
}
