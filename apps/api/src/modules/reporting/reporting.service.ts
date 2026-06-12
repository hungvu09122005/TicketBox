import { Injectable } from '@nestjs/common';
import { ReportingRepository } from './reporting.repository';

@Injectable()
export class ReportingService {
  constructor(private readonly repo: ReportingRepository) {}
  // TODO Phase 8: getRevenueSummary, getTicketsSold, getOrderStatusBreakdown, getCheckinRate
}
