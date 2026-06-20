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
    return await this.checkinRepository.manager.transaction(async (manager) => {
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
      const existing = await this.checkinRepository.findOne({ 
        where: { clientEventId: log.client_event_id } 
      });

      if (existing) {
        results.push({ client_event_id: log.client_event_id, status: 'SKIPPED' });
        continue;
      }

      const previousCheckin = await this.checkinRepository.findOne({
        where: { ticketId: log.ticket_id },
        order: { scannedAt: 'ASC' }
      });

      const status = previousCheckin ? CheckinStatus.CONFLICT : CheckinStatus.ACCEPTED;
      
      const newLog = this.checkinRepository.create({
        ticketId: log.ticket_id,
        clientEventId: log.client_event_id,
        deviceId: log.device_id,
        mode: CheckinMode.OFFLINE,
        status: status,
        conflictReason: status === CheckinStatus.CONFLICT ? 'Duplicate scan' : undefined,
        syncAt: new Date()
      } as any); 
      
      results.push(await this.checkinRepository.save(newLog));
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