import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationLog } from './entities/notification-log.entity';

@Injectable()
export class NotificationsRepository {
  constructor(@InjectRepository(NotificationLog) private readonly repo: Repository<NotificationLog>) {}
  // TODO Phase 4: createLog, markSent, markFailed, existsByTicketTypeChannel (idempotency check)
}
