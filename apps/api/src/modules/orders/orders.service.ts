import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { OrdersRepository } from './orders.repository';
import { ConcertsService } from '../concerts/concerts.service';
import { TicketTypesService } from '../ticket-types/ticket-types.service';

/**
 * OrdersService — application service.
 *
 * Exported surface consumed by:
 *   - PaymentsModule: markOrderPaid(), findById()
 *   - ReportingModule: findByStatus() aggregation queries
 *
 * Internal dependencies (all via imported services, never via foreign repositories):
 *   - ConcertsService.assertPublishedAndSaleOpen()
 *   - TicketTypesService.holdInventory() / releaseInventory() / confirmInventory()
 */
@Injectable()
export class OrdersService {
  constructor(
    private readonly ordersRepository: OrdersRepository,
    private readonly concertsService: ConcertsService,
    private readonly ticketTypesService: TicketTypesService,
    @InjectQueue('orders') private readonly ordersQueue: Queue,
  ) {}

  async findMine(userId: string) {
    return this.ordersRepository.findByUser(userId);
  }

  async findById(id: string, userId: string, isAdmin: boolean) {
    const order = await this.ordersRepository.findByIdAndOwner(id, userId, isAdmin);
    if (!order) {
      throw new NotFoundException(`Order ${id} not found.`);
    }
    return order;
  }

  // TODO Phase 3:
  //   createOrder(dto, userId) — pessimistic lock transaction → enqueue order-expiry delayed job
  //   markPaid(orderId, paymentId)    ← called by PaymentsService
  //   expireOrder(orderId)            ← called by OrderExpiryProcessor
}
