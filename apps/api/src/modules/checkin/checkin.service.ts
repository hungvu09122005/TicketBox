import { Injectable } from '@nestjs/common';
import { CheckinRepository } from './checkin.repository';
import { TicketsService } from '../tickets/tickets.service';

/**
 * CheckinService — online validate + offline sync.
 *
 * Online: atomic verify signature + check status + mark USED + write log (single transaction).
 * Offline sync: process batch of offline events, idempotent by client_event_id.
 * Conflict: earliest scanned_at wins; later duplicate → CONFLICT status.
 */
@Injectable()
export class CheckinService {
  constructor(
    private readonly checkinRepository: CheckinRepository,
    private readonly ticketsService: TicketsService,
  ) {}
  // TODO Phase 5: validateOnline, getSyncDataset, processSyncBatch
}
