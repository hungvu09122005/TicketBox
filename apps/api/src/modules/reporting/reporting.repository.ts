import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

/** ReportingRepository — raw SQL aggregation queries only. No entity repositories from other modules. */
@Injectable()
export class ReportingRepository {
  constructor(private readonly dataSource: DataSource) {}
  // TODO Phase 8: getRevenueSummary(concertId, organizerId), getTicketsSold, getCheckinRate
}
