import { Injectable, Inject, NotFoundException, ConflictException } from '@nestjs/common';
import * as crypto from 'crypto';
import { EntityManager } from 'typeorm';
import { QrCodeGeneratorPort, QR_CODE_GENERATOR_PORT } from '../../common/ports/qr-code-generator.port';
import { TicketsRepository } from './tickets.repository';
import { Ticket, TicketStatus } from './entities/ticket.entity';
import { Order } from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { OrderStatus } from '../orders/enums/order-status.enum';
import { randomUUID } from 'crypto';

@Injectable()
export class TicketsService {
  constructor(
    private readonly ticketsRepository: TicketsRepository,
    @Inject(QR_CODE_GENERATOR_PORT) private readonly qrGenerator: QrCodeGeneratorPort,
  ) {}

  // Dùng cho CheckinService: getSyncDataset
  async findValidTicketsForSync(concertId: string, ticketTypeId?: string): Promise<Partial<Ticket>[]> {
    const where: any = { concertId, status: TicketStatus.ACTIVE };
    if (ticketTypeId) {
      where.ticketTypeId = ticketTypeId;
    }
    return await this.ticketsRepository.find({
      where,
      select: ['id', 'qrToken', 'status', 'ticketTypeId', 'concertId'],
    });
  }

  // Tìm vé theo ID
  async findOne(id: string): Promise<Ticket> {
    const ticket = await this.ticketsRepository.findOne({ where: { id } });
    if (!ticket) throw new NotFoundException('Vé không tồn tại');
    return ticket;
  }

  // Tìm vé của một user
  async findMineWithFilters(userId: string, query: any) {
    const { page = 1, limit = 10, status, concertId, ticketTypeId } = query;
    const where: any = { userId };
    if (status) where.status = status;
    if (concertId) where.concertId = concertId;
    if (ticketTypeId) where.ticketTypeId = ticketTypeId;

    const [data, total] = await this.ticketsRepository.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      }
    };
  }

  // Xác thực QR Token (Logic từ port)
  async verifyQrToken(qrToken: string): Promise<Ticket> {
  const payload = await this.qrGenerator.verifyToken(qrToken);
  
  // 1. Kiểm tra nếu không có payload hoặc không có ticketId
  if (!payload || !payload.ticketId) {
    throw new NotFoundException('QR Token không hợp lệ hoặc không chứa ID vé');
  }

  // 2. Bây giờ TypeScript biết chắc chắn payload.ticketId là string
  return await this.findOne(payload.ticketId);
}

  // Đánh dấu vé đã sử dụng (Cập nhật status)
  async markUsed(id: string): Promise<void> {
    const ticket = await this.findOne(id);
    if (ticket.status === TicketStatus.USED) {
      throw new ConflictException('Vé đã được sử dụng trước đó');
    }
    await this.ticketsRepository.update(id, { status: TicketStatus.USED });
  }

  async findByConcert(concertId: string) {
   return await this.ticketsRepository.find({ where: { concertId } });
  }

  async issueTickets(order: Order, manager?: EntityManager): Promise<Ticket[]> {
    const tickets: Ticket[] = [];
    
    for (let i = 0; i < order.quantity; i++) {
      const ticketId = crypto.randomUUID();
      const qrToken = this.qrGenerator.generateToken({
        ticketId,
        concertId: order.concertId,
        ticketTypeId: order.ticketTypeId,
      });

      let ticket: Ticket;
      const ticketData = {
        id: ticketId,
        orderId: order.id,
        ticketTypeId: order.ticketTypeId,
        userId: order.userId,
        concertId: order.concertId,
        qrToken,
        status: TicketStatus.ACTIVE,
        manualCode: crypto.randomBytes(6).toString('hex').toUpperCase(),
      };

      if (manager) {
        ticket = manager.create(Ticket, ticketData);
      } else {
        ticket = new Ticket();
        Object.assign(ticket, ticketData);
      }
      
      tickets.push(ticket);
    }

    if (manager) {
      return await manager.save(Ticket, tickets);
    } else {
      return await this.ticketsRepository.saveTickets(tickets);
    }
  }

  async issueVipTicket(
    params: {
      userId: string;
      concertId: string;
      ticketTypeId: string;
    },
    manager?: EntityManager,
  ): Promise<Ticket> {
    const orderData = {
      id: crypto.randomUUID(),
      userId: params.userId,
      concertId: params.concertId,
      ticketTypeId: params.ticketTypeId,
      quantity: 1,
      totalAmount: 0,
      status: OrderStatus.PAID,
      expiresAt: new Date(),
    };

    const run = async (m: EntityManager) => {
      const order = m.create(Order, orderData);
      await m.save(Order, order);

      const orderItem = m.create(OrderItem, {
        id: crypto.randomUUID(),
        orderId: order.id,
        ticketTypeId: params.ticketTypeId,
        quantity: 1,
        unitPrice: 0,
      });
      await m.save(OrderItem, orderItem);

      const ticketId = crypto.randomUUID();
      const qrToken = this.qrGenerator.generateToken({
        ticketId,
        concertId: params.concertId,
        ticketTypeId: params.ticketTypeId,
      });

      const ticket = m.create(Ticket, {
        id: ticketId,
        orderId: order.id,
        ticketTypeId: params.ticketTypeId,
        userId: params.userId,
        concertId: params.concertId,
        qrToken,
        status: TicketStatus.ACTIVE,
        manualCode: crypto.randomBytes(6).toString('hex').toUpperCase(),
      });
      return await m.save(Ticket, ticket);
    };

    if (manager) {
      return await run(manager);
    } else {
      return await this.ticketsRepository.repo.manager.transaction(async (m) => {
        return await run(m);
      });
    }
  }

  async findByManualCode(
    manualCode: string,
  ): Promise<Ticket> {
    const ticket =
      await this.ticketsRepository.findOne({
        where: { manualCode },
      });

    if (!ticket) {
      throw new NotFoundException(
        'Không tìm thấy vé',
      );
    }

    return ticket;
  }
}
