import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Logger } from 'nestjs-pino';
import { TicketTypesRepository } from './ticket-types.repository';
import { TicketType } from './entities/ticket-type.entity';
import { CreateTicketTypeDto } from './dto/create-ticket-type.dto';
import { UpdateTicketTypeDto } from './dto/update-ticket-type.dto';

@Injectable()
export class TicketTypesService {
  constructor(
    private readonly repo: TicketTypesRepository,
    private readonly logger: Logger,
  ) {}

  async findByConcertId(concertId: string): Promise<TicketType[]> {
    return await this.repo.find({ where: { concertId }, order: { price: 'ASC' } });
  }

  async create(concertId: string, dto: CreateTicketTypeDto, adminId: string): Promise<TicketType> {
    const ticketType = await this.repo.createTicketType({
      concertId,
      ...dto,
      saleStartsAt: dto.saleStartsAt ? new Date(dto.saleStartsAt) : undefined,
      saleEndsAt: dto.saleEndsAt ? new Date(dto.saleEndsAt) : undefined,
    });

    this.logger.log({
      msg: 'Audit: TicketType created',
      targetConcertId: concertId,
      ticketTypeId: ticketType.id,
      adminId,
      details: dto,
    });

    return ticketType;
  }

  async update(ticketTypeId: string, dto: UpdateTicketTypeDto, adminId: string): Promise<TicketType> {
    const ticketType = await this.repo.findOne({ where: { id: ticketTypeId } });
    if (!ticketType) {
      throw new NotFoundException('Loại vé không tồn tại');
    }

    if (dto.totalQuantity !== undefined) {
      const minimumRequired = ticketType.soldQuantity + ticketType.heldQuantity;
      if (dto.totalQuantity < minimumRequired) {
        throw new BadRequestException(`Không thể giảm tổng số vé xuống dưới số vé đã bán và đang giữ (${minimumRequired})`);
      }
    }

    const updateData: Partial<TicketType> = {
      ...dto,
      saleStartsAt: dto.saleStartsAt ? new Date(dto.saleStartsAt) : undefined,
      saleEndsAt: dto.saleEndsAt ? new Date(dto.saleEndsAt) : undefined,
    };
    // remove undefined values so they don't overwrite with null
    if (dto.saleStartsAt === undefined) delete updateData.saleStartsAt;
    if (dto.saleEndsAt === undefined) delete updateData.saleEndsAt;

    const updated = await this.repo.updateTicketType(ticketTypeId, updateData);

    this.logger.log({
      msg: 'Audit: TicketType updated',
      ticketTypeId,
      adminId,
      oldValues: {
        name: ticketType.name,
        price: ticketType.price,
        totalQuantity: ticketType.totalQuantity,
        maxPerUser: ticketType.maxPerUser,
        saleStartsAt: ticketType.saleStartsAt,
        saleEndsAt: ticketType.saleEndsAt,
      },
      newValues: dto,
    });

    return updated;
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