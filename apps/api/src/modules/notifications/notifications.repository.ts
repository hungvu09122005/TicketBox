import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationLog } from './entities/notification-log.entity';
import { NotificationChannel, NotificationStatus, NotificationType } from './entities/notification-log.entity';

@Injectable()
export class NotificationsRepository {
  constructor(@InjectRepository(NotificationLog) private readonly repo: Repository<NotificationLog>) {}

  findByTicketTypeChannel(ticketId: string, type: NotificationType, channel: NotificationChannel) {
    return this.repo.findOne({ where: { ticketId, type, channel } });
  }

  async existsByTicketTypeChannel(ticketId: string, type: NotificationType, channel: NotificationChannel): Promise<boolean> {
    return Boolean(await this.findByTicketTypeChannel(ticketId, type, channel));
  }

  async createLog(data: Partial<NotificationLog>): Promise<NotificationLog> {
    return this.repo.save(this.repo.create(data));
  }

  async markSent(id: string, sentAt = new Date()): Promise<void> {
    await this.repo.update(id, { status: NotificationStatus.SENT, sentAt });
  }

  async markFailed(id: string, reason?: string): Promise<void> {
    await this.repo.update(id, { status: NotificationStatus.FAILED, failureReason: reason });
  }

  async updateFailureReason(id: string, reason: string): Promise<void> {
    await this.repo.update(id, { failureReason: reason });
  }

  async markQueued(id: string): Promise<void> {
    await this.repo.update(id, { status: NotificationStatus.QUEUED });
  }
}
