import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CheckinLog } from './entities/checkin-log.entity';

@Injectable()
export class CheckinRepository {
  constructor(@InjectRepository(CheckinLog) private readonly repo: Repository<CheckinLog>) {}
  // TODO Phase 5: createLog, findByTicketId, bulkUpsertOffline (idempotent by clientEventId)
}
