import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { TicketsService } from '../tickets/tickets.service';
import { Ticket, TicketStatus } from '@modules/tickets/entities/ticket.entity';
import { CheckinLog, CheckinMode, CheckinStatus } from './entities/checkin-log.entity';
import { CheckinDevice, DeviceStatus } from './entities/checkin-device.entity';
import { CheckinDto, RegisterDeviceDto, SyncDatasetQueryDto } from './dto/checkin.dto';

@Injectable()
export class CheckinService {
  constructor(
    @InjectRepository(CheckinLog)
    private readonly checkinRepository: Repository<CheckinLog>,
    @InjectRepository(CheckinDevice)
    private readonly deviceRepository: Repository<CheckinDevice>,
    private readonly ticketsService: TicketsService,
    private readonly jwtService: JwtService,
    private readonly entityManager: EntityManager,
  ) {}

  /**
   * Online: Atomic verify + mark USED + write log
   */
  async validateOnline(dto: CheckinDto, user: any) {
    if (!dto.ticket_id && !dto.qr_token) {
      throw new ConflictException('Phải cung cấp ticket_id hoặc qr_token');
    }

    let resolvedTicketId = dto.ticket_id;

    if (dto.qr_token) {
      const ticket = await this.ticketsService.verifyQrToken(dto.qr_token);
      resolvedTicketId = ticket.id;
    }
    
    if (!resolvedTicketId) {
      throw new ConflictException('Không thể phân giải ticket_id');
    }

    // Xác minh thiết bị để lấy concert/zone scope
    const device = await this.deviceRepository.findOne({ where: { id: dto.device_id } });
    if (!device || device.status !== DeviceStatus.ACTIVE) {
      throw new UnauthorizedException('Thiết bị kiểm soát không hợp lệ hoặc đã bị thu hồi');
    }

    return await this.checkinRepository.manager.transaction(async (manager) => {
      const ticket = await manager.findOne(Ticket, {
        where: { id: resolvedTicketId },
        lock: { mode: 'pessimistic_write' }
      });

      if (!ticket) throw new NotFoundException('Vé không tồn tại');
      if (ticket.status === TicketStatus.USED) throw new ConflictException('Vé đã được sử dụng.');
      if (ticket.status !== TicketStatus.ACTIVE) throw new ConflictException('Vé không ở trạng thái hợp lệ.');

      // Kiểm tra scope concert
      if (ticket.concertId !== device.concertId) {
        throw new ConflictException('Vé không thuộc sự kiện này.');
      }

      // Kiểm tra scope zone nếu thiết bị bị giới hạn
      if (device.zoneId) {
        const zone = await manager.query(
          `SELECT ticket_type_id FROM seat_zones WHERE id = $1 LIMIT 1`,
          [device.zoneId]
        );
        if (zone && zone.length > 0 && zone[0].ticket_type_id !== ticket.ticketTypeId) {
          throw new ConflictException('Vé không hợp lệ cho khu vực / cổng này.');
        }
      }

      await manager.update(Ticket, ticket.id, { status: TicketStatus.USED });

      const log = manager.create(CheckinLog, {
        ticketId: ticket.id,
        staffId: user.sub,
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
  async processSyncBatch(logs: CheckinDto[], staffId?: string) {
    const results = [];
    
    for (const log of logs) {
      const result = await this.checkinRepository.manager.transaction(async (manager) => {
        // Kiểm tra Idempotent clientEventId
        const existing = await manager.findOne(CheckinLog, { 
          where: { clientEventId: log.client_event_id } 
        });

        if (existing) {
          return { client_event_id: log.client_event_id, status: 'SKIPPED' };
        }

        let resolvedTicketId = log.ticket_id;
        if (log.qr_token) {
          try {
            const parsed = await this.ticketsService.verifyQrToken(log.qr_token);
            resolvedTicketId = parsed.id;
          } catch (e) {
            resolvedTicketId = undefined;
          }
        }

        if (!resolvedTicketId) {
           const newLog = manager.create(CheckinLog, {
             ticketId: '00000000-0000-0000-0000-000000000000', // Cannot save without ticketId, but ticketId is a UUID
             clientEventId: log.client_event_id,
             deviceId: log.device_id,
             staffId: staffId,
             mode: CheckinMode.OFFLINE,
             status: CheckinStatus.REJECTED,
             conflictReason: 'Invalid QR Token or Ticket ID',
             scannedAt: log.scanned_at ? new Date(log.scanned_at) : new Date(),
             syncAt: new Date()
           });
           // Depending on DB constraints, dummy ticketId might fail. Better just not save log or return rejected
           // Let's just return rejected without saving log since we can't tie it to a ticket
           return { client_event_id: log.client_event_id, status: CheckinStatus.REJECTED, reason: 'Invalid ticket' };
        }

        // Khóa dòng vé để ngăn ngừa race condition
        const ticket = await manager.findOne(Ticket, {
          where: { id: resolvedTicketId },
          lock: { mode: 'pessimistic_write' }
        });

        if (!ticket) {
           return { client_event_id: log.client_event_id, status: CheckinStatus.REJECTED, reason: 'Vé không tồn tại' };
        }

        let status = CheckinStatus.ACCEPTED;
        let reason = undefined;

        if (ticket.status === TicketStatus.USED) {
          status = CheckinStatus.CONFLICT;
          reason = 'Duplicate scan';
        } else if (ticket.status !== TicketStatus.ACTIVE) {
          status = CheckinStatus.REJECTED;
          reason = 'Vé không hợp lệ';
        }

        // Cập nhật trạng thái vé nếu hợp lệ
        if (status === CheckinStatus.ACCEPTED) {
          await manager.update(Ticket, ticket.id, { status: TicketStatus.USED });
        }

        // Tạo log
        const newLog = manager.create(CheckinLog, {
          ticketId: ticket.id,
          clientEventId: log.client_event_id,
          deviceId: log.device_id,
          staffId: staffId,
          mode: CheckinMode.OFFLINE,
          status: status,
          conflictReason: reason,
          scannedAt: log.scanned_at ? new Date(log.scanned_at) : new Date(),
          syncAt: new Date()
        });
        await manager.save(CheckinLog, newLog);
        
        return { client_event_id: log.client_event_id, status };
      });
      
      results.push(result);
    }
    return results;
  }

  /**
   * Register a device for offline checkin
   */
  async registerDevice(dto: RegisterDeviceDto, staffId: string) {
    // Save device to DB
    const device = this.deviceRepository.create({
      name: dto.deviceName,
      staffId,
      concertId: dto.concertId,
      zoneId: dto.zoneId,
      gate: dto.gate,
      status: DeviceStatus.ACTIVE,
    });
    await this.deviceRepository.save(device);

    // Generate offline JWT token
    const payload = {
      sub: device.id,
      concertId: device.concertId,
      zoneId: device.zoneId,
      gate: device.gate,
    };
    const token = this.jwtService.sign(payload);

    return {
      deviceId: device.id,
      token,
    };
  }

  /**
   * Get sync dataset for offline devices using device token
   */
  async getSyncDataset(query: SyncDatasetQueryDto) {
    let payload;
    try {
      payload = this.jwtService.verify(query.deviceToken);
    } catch (e) {
      throw new UnauthorizedException('Invalid or expired device token');
    }

    const { sub: deviceId, concertId, zoneId } = payload;

    // Verify device is still ACTIVE in DB
    const device = await this.deviceRepository.findOne({ where: { id: deviceId } });
    if (!device || device.status !== DeviceStatus.ACTIVE) {
      throw new UnauthorizedException('Device is revoked or not found');
    }

    let ticketTypeId: string | undefined;

    // If zoneId is provided, restrict dataset to that zone's ticketTypeId
    if (zoneId) {
      const zone = await this.entityManager.query(
        `SELECT ticket_type_id FROM seat_zones WHERE id = $1 LIMIT 1`,
        [zoneId]
      );
      if (zone && zone.length > 0) {
        ticketTypeId = zone[0].ticket_type_id;
      }
    }

    const tickets = await this.ticketsService.findValidTicketsForSync(concertId, ticketTypeId);

    return {
      version: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      tickets,
    };
  }
}