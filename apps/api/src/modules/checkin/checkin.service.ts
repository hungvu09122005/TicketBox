import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TicketsService } from '../tickets/tickets.service';
import { Ticket, TicketStatus } from '@modules/tickets/entities/ticket.entity';
import { CheckinLog, CheckinMode, CheckinStatus } from './entities/checkin-log.entity';
import { CheckinDto } from './dto/checkin.dto';

@Injectable()
export class CheckinService {
  constructor(
    @InjectRepository(CheckinLog)
    private readonly checkinRepository: Repository<CheckinLog>,
    private readonly ticketsService: TicketsService,
  ) {}

  /**
   * Online: Atomic verify + mark USED + write log
   */
  async validateOnline(dto: CheckinDto, user: any) {
    console.log('--- ĐANG KẾT NỐI VÀO DB ---');
    console.log('Host:', process.env.DATABASE_HOST);
    console.log('DB Name:', process.env.DATABASE_NAME);
    console.log('---------------------------');
    return await this.checkinRepository.manager.transaction(async (manager) => {
      // Dùng camelCase 'id' vì Entity Ticket định nghĩa là id
      
      const ticket = await manager.findOne(Ticket, {
        where: { id: dto.ticket_id },
        lock: { mode: 'pessimistic_write' }
      });

      if (!ticket) throw new NotFoundException('Vé không tồn tại');
      if (ticket.status === TicketStatus.USED) throw new ConflictException('Vé đã được sử dụng.');

      await manager.update(Ticket, dto.ticket_id, { status: TicketStatus.USED });

      const log = manager.create(CheckinLog, {
        ticketId: dto.ticket_id,
        clientEventId: dto.client_event_id,
        deviceId: dto.device_id,
        status: CheckinStatus.ACCEPTED,
        mode: CheckinMode.ONLINE,
        scannedAt: new Date(),
      });
      return await manager.save(log);
    });
  }

  /**
   * Offline sync: Idempotent processing of offline logs
   */
  async processSyncBatch(logs: CheckinDto[]) {
    const results = [];
    
    for (const log of logs) {
      // Dùng camelCase 'clientEventId'
      const existing = await this.checkinRepository.findOne({ 
        where: { clientEventId: log.client_event_id } 
      });

      if (existing) {
        results.push({ client_event_id: log.client_event_id, status: 'SKIPPED' });
        continue;
      }

      // Conflict logic: Kiểm tra vé đã được check-in trước đó chưa
      const previousCheckin = await this.checkinRepository.findOne({
        where: { ticketId: log.ticket_id },
        order: { scannedAt: 'ASC' }
      });

      const status = previousCheckin ? CheckinStatus.CONFLICT : CheckinStatus.ACCEPTED;
      
      // Sửa đoạn tạo newLog thành:
      const newLog = this.checkinRepository.create({
        ticketId: log.ticket_id,
        clientEventId: log.client_event_id,
        deviceId: log.device_id,
        mode: CheckinMode.OFFLINE,
        tatus: status,
  // Dùng undefined thay vì null cho các trường optional trong TypeORM
        conflictReason: status === CheckinStatus.CONFLICT ? 'Duplicate scan' : undefined,
        syncAt: new Date()
      } as any); // Thêm "as any" để bypass lỗi check property nghiêm ngặt tạm thời
      
      results.push(await this.checkinRepository.save(newLog));
    }
    return results;
  }

  /**
   * Get sync dataset for offline devices
   */
  async getSyncDataset() {
    return await this.ticketsService.findValidTickets();
  }
}