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

  async createQueuedLogIfAbsent(data: {
  ticketId: string;
  userId: string;
  type: NotificationType;
  channel: NotificationChannel;
}): Promise<NotificationLog | null> {
  const result = await this.repo
    .createQueryBuilder()
    .insert()
    .into(NotificationLog)
    .values({
      ticketId: data.ticketId,
      userId: data.userId,
      type: data.type,
      channel: data.channel,
      status: NotificationStatus.QUEUED,
    })
    .orIgnore()
    .returning('id')
    .execute();

  const insertedId = result.identifiers[0]?.id ?? result.raw?.[0]?.id;

  if (!insertedId) {
    return null;
  }

  return this.repo.findOne({ where: { id: insertedId } });
}

  async markSent(id: string): Promise<void> {
  await this.repo.update(id, {
    status: NotificationStatus.SENT,
    sentAt: new Date(),
    failureReason: null,
  });
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
