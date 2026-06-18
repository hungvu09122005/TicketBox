import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { TicketTypesRepository } from './ticket-types.repository';
import { TicketType } from './entities/ticket-type.entity';

@Injectable()
export class TicketTypesService {
  constructor(private readonly repo: TicketTypesRepository) {}

  async findByConcertId(concertId: string): Promise<TicketType[]> {
    // Sửa: where: { concertId: concertId }
    return await this.repo.find({ where: { concertId: concertId } });
  }

  /**
   * Pessimistic Locking: Khóa dòng để chống Oversell
   */
  async holdInventory(ticketTypeId: string, quantity: number, manager: EntityManager): Promise<TicketType> {
    const ticketType = await manager.findOne(TicketType, {
      where: { id: ticketTypeId },
      lock: { mode: 'pessimistic_write' }
    });

    if (!ticketType) throw new NotFoundException('Loại vé không tồn tại');

    // Sửa: Dùng camelCase (soldQuantity, heldQuantity, totalQuantity)
    if (ticketType.soldQuantity + ticketType.heldQuantity + quantity > ticketType.totalQuantity) {
      throw new ConflictException('Hết vé hoặc số lượng không đủ');
    }

    // Sửa: Tăng heldQuantity
    ticketType.heldQuantity += quantity;
    await manager.save(ticketType);
    
    return ticketType;
  }

  async confirmInventory(ticketTypeId: string, quantity: number, manager: EntityManager): Promise<void> {
    // Sửa: Trừ heldQuantity, Tăng soldQuantity
    await manager.decrement(TicketType, { id: ticketTypeId }, 'heldQuantity', quantity);
    await manager.increment(TicketType, { id: ticketTypeId }, 'soldQuantity', quantity);
  }

  async releaseInventory(ticketTypeId: string, quantity: number, manager: EntityManager): Promise<void> {
    // Sửa: Trừ heldQuantity
    await manager.decrement(TicketType, { id: ticketTypeId }, 'heldQuantity', quantity);
  }

  async getAvailability(ticketTypeId: string): Promise<number> {
    const ticketType = await this.repo.findOne({ where: { id: ticketTypeId } });
    if (!ticketType) throw new NotFoundException('Loại vé không tồn tại');
    
    // Sửa: Tính toán với camelCase
    return ticketType.totalQuantity - (ticketType.soldQuantity + ticketType.heldQuantity);
  }
}