import { Injectable } from '@nestjs/common';
import { ReportingRepository } from './reporting.repository';

@Injectable()
export class ReportingService {
  constructor(private readonly repo: ReportingRepository) {}
  async getRevenueSummary(isAdmin: boolean, organizerId: string, concertId?: string, startDate?: string, endDate?: string) {
    const orgFilter = isAdmin ? undefined : organizerId;
    return await this.repo.getRevenueSummary(orgFilter, concertId, startDate, endDate);
  }

  async getRevenueTimeline(isAdmin: boolean, organizerId: string, concertId?: string, startDate?: string, endDate?: string) {
    const orgFilter = isAdmin ? undefined : organizerId;
    return await this.repo.getRevenueTimeline(orgFilter, concertId, startDate, endDate);
  }

  async getTicketsSold(isAdmin: boolean, organizerId: string, concertId?: string, startDate?: string, endDate?: string) {
    const orgFilter = isAdmin ? undefined : organizerId;
    return await this.repo.getTicketsSold(orgFilter, concertId, startDate, endDate);
  }

  async getTicketsSoldTimeline(isAdmin: boolean, organizerId: string, concertId?: string, startDate?: string, endDate?: string) {
    const orgFilter = isAdmin ? undefined : organizerId;
    return await this.repo.getTicketsSoldTimeline(orgFilter, concertId, startDate, endDate);
  }

  async getOrderStatusBreakdown(isAdmin: boolean, organizerId: string, concertId?: string, startDate?: string, endDate?: string) {
    const orgFilter = isAdmin ? undefined : organizerId;
    return await this.repo.getOrderStatusBreakdown(orgFilter, concertId, startDate, endDate);
  }

  async getCheckinRate(isAdmin: boolean, organizerId: string, concertId?: string) {
    const orgFilter = isAdmin ? undefined : organizerId;
    return await this.repo.getCheckinRate(orgFilter, concertId);
  }

  async getCheckinRateTimeline(isAdmin: boolean, organizerId: string, concertId?: string, startDate?: string, endDate?: string) {
    const orgFilter = isAdmin ? undefined : organizerId;
    return await this.repo.getCheckinRateTimeline(orgFilter, concertId, startDate, endDate);
  }
}
