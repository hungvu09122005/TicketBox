import { Injectable, Inject, NotFoundException, ConflictException } from '@nestjs/common';
import * as crypto from 'crypto';
import { EntityManager } from 'typeorm';
import { QrCodeGeneratorPort, QR_CODE_GENERATOR_PORT } from '../../common/ports/qr-code-generator.port';
import { TicketsRepository } from './tickets.repository';
import { Ticket, TicketStatus } from './entities/ticket.entity';
import { Order } from '../orders/entities/order.entity';
import { randomUUID } from 'crypto';

@Injectable()
export class TicketsService {
  constructor(
    private readonly ticketsRepository: TicketsRepository,
    @Inject(QR_CODE_GENERATOR_PORT) private readonly qrGenerator: QrCodeGeneratorPort,
  ) {}

  // Dùng cho CheckinService: getSyncDataset
  async findValidTickets(): Promise<Ticket[]> {
    return await this.ticketsRepository.find({
      where: { status: TicketStatus.ACTIVE },
    });
  }

  // Tìm vé theo ID
  async findOne(id: string): Promise<Ticket> {
    const ticket = await this.ticketsRepository.findOne({ where: { id } });
    if (!ticket) throw new NotFoundException('Vé không tồn tại');
    return ticket;
  }

  // Tìm vé của một user
  async findMine(userId: string): Promise<Ticket[]> {
    return await this.ticketsRepository.find({ where: { userId } });
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

  async issueTicketsForOrder(order: Order, manager: EntityManager): Promise<Ticket[]> {
    const tickets: Ticket[] = [];
    
    for (let i = 0; i < order.quantity; i++) {
      const ticketId = crypto.randomUUID();
      const qrToken = this.qrGenerator.generateToken({
        ticketId,
        concertId: order.concertId,
        ticketTypeId: order.ticketTypeId,
      });

      const ticket = manager.create(Ticket, {
        id: ticketId,
        orderId: order.id,
        ticketTypeId: order.ticketTypeId,
        userId: order.userId,
        concertId: order.concertId,
        status: TicketStatus.ACTIVE,
      } as Ticket;

      ticket.qrToken = this.qrGenerator.generateToken({
        ticketId,
        concertId: order.concertId,
        ticketTypeId: order.ticketTypeId,
      });

      tickets.push(ticket);
    }

    return this.ticketsRepository.saveTickets(tickets);
  }
}
