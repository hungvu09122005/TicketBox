import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { Between, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import {
  OBJECT_STORAGE_PORT,
  ObjectStoragePort,
} from '../../../common/ports/object-storage.port';
import { Concert, ConcertStatus } from '../../concerts/entities/concert.entity';
import { CsvImportService } from '../csv-import.service';

@Injectable()
export class VipGuestSyncScheduler {
  private readonly logger = new Logger(VipGuestSyncScheduler.name);

  constructor(
    @InjectRepository(Concert)
    private readonly concertRepository: Repository<Concert>,
    private readonly csvImportService: CsvImportService,
    private readonly configService: ConfigService,
    @Inject(OBJECT_STORAGE_PORT)
    private readonly storage: ObjectStoragePort,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async syncNightlyGuestLists(): Promise<void> {
    const now = new Date();
    const nextConcertDay = new Date(now);
    nextConcertDay.setDate(nextConcertDay.getDate() + 1);

    const windowStart = new Date(nextConcertDay);
    windowStart.setHours(0, 0, 0, 0);

    const windowEnd = new Date(nextConcertDay);
    windowEnd.setHours(23, 59, 59, 999);

    const concerts = await this.concertRepository.find({
      where: {
        status: ConcertStatus.PUBLISHED,
        startsAt: Between(windowStart, windowEnd),
      },
      select: ['id', 'organizerId'],
    });

    const prefixRoot =
      this.configService.get<string>('CSV_IMPORT_NIGHTLY_PREFIX') ?? 'vip-sync';

    for (const concert of concerts) {
      const prefix = `${prefixRoot}/${concert.id}/`;

      try {
        const objects = await this.storage.listObjects(prefix);
        const latestCsv = objects
          .filter((item) => item.objectKey.toLowerCase().endsWith('.csv'))
          .sort((a, b) => {
            const aTime = a.lastModified?.getTime() ?? 0;
            const bTime = b.lastModified?.getTime() ?? 0;
            return bTime - aTime;
          })[0];

        if (!latestCsv) {
          continue;
        }

        const job = await this.csvImportService.createJobFromObjectKey(
          concert.id,
          concert.organizerId,
          latestCsv.objectKey,
        );

        this.logger.log(
          `Queued nightly VIP sync for concert ${concert.id} with object ${latestCsv.objectKey} (job ${job.job_id})`,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(
          `Failed nightly VIP sync for concert ${concert.id} and prefix ${prefix}: ${message}`,
        );
      }
    }
  }
}
