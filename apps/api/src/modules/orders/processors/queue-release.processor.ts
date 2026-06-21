import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { QueueService } from '../queue.service';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class QueueReleaseProcessor {
  private readonly logger = new Logger(QueueReleaseProcessor.name);

  constructor(
    private readonly queueService: QueueService,
    private readonly redisService: RedisService,
  ) {}

  @Cron(CronExpression.EVERY_5_SECONDS)
  async handleQueueRelease() {
    try {
      const redis = this.redisService.getClient();
      // Find all concerts that have an active queue
      const queueKeys = await redis.keys('waiting_room:*:queue');

      for (const key of queueKeys) {
        // Extract concertId from waiting_room:{concertId}:queue
        const match = key.match(/waiting_room:(.*):queue/);
        if (match && match[1]) {
          const concertId = match[1];
          await this.queueService.admitUsersFromQueue(concertId);
        }
      }
    } catch (error) {
      this.logger.error('Error during queue release cycle:', error);
    }
  }
}
