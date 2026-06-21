import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

/** ReportingRepository — raw SQL aggregation queries only. No entity repositories from other modules. */
@Injectable()
export class ReportingRepository {
  constructor(private readonly dataSource: DataSource) {}
  private buildBaseWhere(
    params: any[], 
    organizerId?: string, 
    concertId?: string, 
    startDate?: string, 
    endDate?: string
  ) {
    let where = '1=1';
    
    if (organizerId) {
      params.push(organizerId);
      where += ` AND c.organizer_id = $${params.length}`;
    }
    
    if (concertId) {
      params.push(concertId);
      where += ` AND c.id = $${params.length}`;
    }

    if (startDate) {
      params.push(startDate);
      where += ` AND o.created_at >= $${params.length}`;
    }

    if (endDate) {
      params.push(endDate);
      where += ` AND o.created_at <= $${params.length}`;
    }

    return where;
  }

  async getRevenueSummary(organizerId?: string, concertId?: string, startDate?: string, endDate?: string) {
    const params: any[] = [];
    const where = this.buildBaseWhere(params, organizerId, concertId, startDate, endDate);
    
    const query = `
      SELECT 
        c.id AS "concertId", 
        c.name AS "concertName", 
        COALESCE(SUM(o.total_amount), 0) AS "totalRevenue"
      FROM concerts c
      LEFT JOIN orders o ON o.concert_id = c.id AND o.status = 'PAID'
      WHERE ${where}
      GROUP BY c.id, c.name
      ORDER BY "totalRevenue" DESC
    `;
    
    return await this.dataSource.query(query, params);
  }

  async getTicketsSold(organizerId?: string, concertId?: string, startDate?: string, endDate?: string) {
    const params: any[] = [];
    const where = this.buildBaseWhere(params, organizerId, concertId, startDate, endDate);
    
    const query = `
      SELECT 
        c.id AS "concertId", 
        c.name AS "concertName", 
        COALESCE(SUM(o.quantity), 0) AS "ticketsSold"
      FROM concerts c
      LEFT JOIN orders o ON o.concert_id = c.id AND o.status = 'PAID'
      WHERE ${where}
      GROUP BY c.id, c.name
      ORDER BY "ticketsSold" DESC
    `;
    
    return await this.dataSource.query(query, params);
  }

  async getOrderStatusBreakdown(organizerId?: string, concertId?: string, startDate?: string, endDate?: string) {
    const params: any[] = [];
    const where = this.buildBaseWhere(params, organizerId, concertId, startDate, endDate);
    
    const query = `
      SELECT 
        o.status AS "status", 
        COUNT(o.id) AS "count"
      FROM orders o
      JOIN concerts c ON o.concert_id = c.id
      WHERE ${where}
      GROUP BY o.status
    `;
    
    return await this.dataSource.query(query, params);
  }

  async getCheckinRate(organizerId?: string, concertId?: string) {
    // Checkin rate only filters by concert, since it maps to physical tickets
    const params: any[] = [];
    let where = '1=1';
    
    if (organizerId) {
      params.push(organizerId);
      where += ` AND c.organizer_id = $${params.length}`;
    }
    
    if (concertId) {
      params.push(concertId);
      where += ` AND c.id = $${params.length}`;
    }

    const query = `
      SELECT 
        c.id AS "concertId", 
        c.name AS "concertName", 
        COUNT(t.id) AS "totalTickets",
        SUM(CASE WHEN t.status = 'USED' THEN 1 ELSE 0 END) AS "checkedInTickets",
        CASE WHEN COUNT(t.id) > 0 THEN ROUND((SUM(CASE WHEN t.status = 'USED' THEN 1 ELSE 0 END)::numeric / COUNT(t.id)::numeric) * 100, 2) ELSE 0 END AS "checkinRate"
      FROM concerts c
      LEFT JOIN tickets t ON t.concert_id = c.id AND t.status != 'CANCELLED'
      WHERE ${where}
      GROUP BY c.id, c.name
    `;
    
    return await this.dataSource.query(query, params);
  }
}
