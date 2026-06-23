import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

/** ReportingRepository — raw SQL aggregation queries only. No entity repositories from other modules. */
@Injectable()
export class ReportingRepository {
  constructor(private readonly dataSource: DataSource) {}

  private buildConcertWhere(
    params: unknown[],
    organizerId?: string,
    concertId?: string,
  ) {
    let where = '1=1';

    if (organizerId) {
      params.push(organizerId);
      where += ` AND c.organizer_id = $${params.length}`;
    }

    if (concertId) {
      params.push(concertId);
      where += ` AND c.id::text = $${params.length}`;
    }

    return where;
  }

  private buildDateWhere(
    params: unknown[],
    column: string,
    startDate?: string,
    endDate?: string,
  ) {
    let where = '1=1';

    if (startDate) {
      params.push(startDate);
      where += ` AND ${column} >= $${params.length}`;
    }

    if (endDate) {
      params.push(endDate);
      where += ` AND ${column} <= $${params.length}`;
    }

    return where;
  }

  private buildBaseWhere(
    params: unknown[],
    organizerId?: string,
    concertId?: string,
    startDate?: string,
    endDate?: string
  ) {
    const concertWhere = this.buildConcertWhere(params, organizerId, concertId);
    const dateWhere = this.buildDateWhere(params, 'o.created_at', startDate, endDate);
    return `${concertWhere} AND ${dateWhere}`;
  }

  async getRevenueSummary(organizerId?: string, concertId?: string, startDate?: string, endDate?: string) {
    const params: unknown[] = [];
    const where = this.buildBaseWhere(params, organizerId, concertId, startDate, endDate);
    
    const query = `
      SELECT 
        c.id AS "concertId", 
        c.name AS "concertName", 
        COALESCE(SUM(o.total_amount), 0) AS "totalRevenue"
      FROM concerts c
      LEFT JOIN orders o ON o.concert_id = c.id::text AND o.status = 'PAID'
      WHERE ${where}
      GROUP BY c.id, c.name
      ORDER BY "totalRevenue" DESC
    `;
    
    return await this.dataSource.query(query, params);
  }

  async getTicketsSold(organizerId?: string, concertId?: string, startDate?: string, endDate?: string) {
    const params: unknown[] = [];
    const where = this.buildBaseWhere(params, organizerId, concertId, startDate, endDate);
    
    const query = `
      SELECT 
        c.id AS "concertId", 
        c.name AS "concertName", 
        COALESCE(SUM(o.quantity), 0) AS "ticketsSold"
      FROM concerts c
      LEFT JOIN orders o ON o.concert_id = c.id::text AND o.status = 'PAID'
      WHERE ${where}
      GROUP BY c.id, c.name
      ORDER BY "ticketsSold" DESC
    `;
    
    return await this.dataSource.query(query, params);
  }

  async getOrderStatusBreakdown(organizerId?: string, concertId?: string, startDate?: string, endDate?: string) {
    const params: unknown[] = [];
    const where = this.buildBaseWhere(params, organizerId, concertId, startDate, endDate);
    
    const query = `
      SELECT 
        o.status AS "status", 
        COUNT(o.id) AS "count"
      FROM orders o
      JOIN concerts c ON o.concert_id = c.id::text
      WHERE ${where}
      GROUP BY o.status
    `;
    
    return await this.dataSource.query(query, params);
  }

  async getCheckinRate(organizerId?: string, concertId?: string) {
    // Checkin rate only filters by concert, since it maps to physical tickets
    const params: unknown[] = [];
    const where = this.buildConcertWhere(params, organizerId, concertId);

    const query = `
      SELECT 
        c.id AS "concertId", 
        c.name AS "concertName", 
        COUNT(t.id) AS "totalTickets",
        SUM(CASE WHEN t.status = 'USED' THEN 1 ELSE 0 END) AS "checkedInTickets",
        CASE WHEN COUNT(t.id) > 0 THEN ROUND((SUM(CASE WHEN t.status = 'USED' THEN 1 ELSE 0 END)::numeric / COUNT(t.id)::numeric) * 100, 2) ELSE 0 END AS "checkinRate"
      FROM concerts c
      LEFT JOIN tickets t ON t.concert_id = c.id::text AND t.status != 'CANCELLED'
      WHERE ${where}
      GROUP BY c.id, c.name
    `;
    
    return await this.dataSource.query(query, params);
  }

  private buildCumulativeSeries(
    concerts: Array<{ concertId: string; concertName: string }>,
    rows: Array<Record<string, unknown>>,
  ) {
    const grouped = new Map<string, { concertId: string; concertName: string; points: Array<{ timestamp: string; value: number }> }>();
    let minTimestamp = Number.POSITIVE_INFINITY;
    let maxTimestamp = Number.NEGATIVE_INFINITY;

    for (const row of rows) {
      const concertId = String(row.concertId ?? '');
      const concertName = String(row.concertName ?? concertId);
      const bucket = row.bucket instanceof Date ? row.bucket.toISOString() : String(row.bucket ?? '');
      const value = Number(row.value ?? 0);
      const timestamp = new Date(bucket).getTime();

      if (!concertId || !bucket || !Number.isFinite(value)) {
        continue;
      }

      if (Number.isFinite(timestamp)) {
        minTimestamp = Math.min(minTimestamp, timestamp);
        maxTimestamp = Math.max(maxTimestamp, timestamp);
      }

      if (!grouped.has(concertId)) {
        grouped.set(concertId, { concertId, concertName, points: [] });
      }

      grouped.get(concertId)!.points.push({ timestamp: bucket, value });
    }

    const seriesList = Array.from(grouped.values()).map((series) => {
      let runningTotal = 0;
      const points = series.points
        .sort((left, right) => left.timestamp.localeCompare(right.timestamp))
        .map((point) => {
          runningTotal += point.value;
          return {
            timestamp: point.timestamp,
            value: Number(runningTotal.toFixed(2)),
          };
        });

      return {
        concertId: series.concertId,
        concertName: series.concertName,
        points,
      };
    });

    const fallbackStart = Number.isFinite(minTimestamp) ? new Date(minTimestamp).toISOString() : new Date().toISOString();
    const fallbackEnd = Number.isFinite(maxTimestamp) ? new Date(maxTimestamp).toISOString() : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    return concerts.map((concert) => {
      const series = seriesList.find((item) => item.concertId === concert.concertId);
      if (series) {
        return series;
      }

      return {
        concertId: concert.concertId,
        concertName: concert.concertName,
        points: [
          { timestamp: fallbackStart, value: 0 },
          { timestamp: fallbackEnd, value: 0 },
        ],
      };
    });
  }

  private async getAccessibleConcerts(organizerId?: string, concertId?: string) {
    const params: unknown[] = [];
    const where = this.buildConcertWhere(params, organizerId, concertId);

    const query = `
      SELECT
        c.id AS "concertId",
        c.name AS "concertName"
      FROM concerts c
      WHERE ${where}
      ORDER BY c.created_at ASC
    `;

    return await this.dataSource.query(query, params);
  }

  async getRevenueTimeline(organizerId?: string, concertId?: string, startDate?: string, endDate?: string) {
    const params: unknown[] = [];
    const concertWhere = this.buildConcertWhere(params, organizerId, concertId);
    const dateWhere = this.buildDateWhere(params, 'o.created_at', startDate, endDate);
    const concerts = await this.getAccessibleConcerts(organizerId, concertId);

    const query = `
      SELECT
        c.id AS "concertId",
        c.name AS "concertName",
        date_trunc('day', o.created_at) AS "bucket",
        COALESCE(SUM(o.total_amount), 0) AS "value"
      FROM concerts c
      JOIN orders o ON o.concert_id = c.id::text AND o.status = 'PAID'
      WHERE ${concertWhere}
        AND ${dateWhere}
      GROUP BY c.id, c.name, date_trunc('day', o.created_at)
      ORDER BY "bucket" ASC
    `;

    const rows = await this.dataSource.query(query, params);
    return {
      granularity: 'day',
      series: this.buildCumulativeSeries(concerts, rows),
    };
  }

  async getTicketsSoldTimeline(organizerId?: string, concertId?: string, startDate?: string, endDate?: string) {
    const params: unknown[] = [];
    const concertWhere = this.buildConcertWhere(params, organizerId, concertId);
    const dateWhere = this.buildDateWhere(params, 'o.created_at', startDate, endDate);
    const concerts = await this.getAccessibleConcerts(organizerId, concertId);

    const query = `
      SELECT
        c.id AS "concertId",
        c.name AS "concertName",
        date_trunc('day', o.created_at) AS "bucket",
        COALESCE(SUM(o.quantity), 0) AS "value"
      FROM concerts c
      JOIN orders o ON o.concert_id = c.id::text AND o.status = 'PAID'
      WHERE ${concertWhere}
        AND ${dateWhere}
      GROUP BY c.id, c.name, date_trunc('day', o.created_at)
      ORDER BY "bucket" ASC
    `;

    const rows = await this.dataSource.query(query, params);
    return {
      granularity: 'day',
      series: this.buildCumulativeSeries(concerts, rows),
    };
  }

  async getCheckinRateTimeline(organizerId?: string, concertId?: string, startDate?: string, endDate?: string) {
    const concerts = await this.getAccessibleConcerts(organizerId, concertId);
    const soldParams: unknown[] = [];
    const soldConcertWhere = this.buildConcertWhere(soldParams, organizerId, concertId);
    const soldDateWhere = this.buildDateWhere(soldParams, 'o.created_at', startDate, endDate);

    const soldQuery = `
      SELECT
        c.id AS "concertId",
        c.name AS "concertName",
        date_trunc('day', o.created_at) AS "bucket",
        COALESCE(SUM(o.quantity), 0) AS "value"
      FROM concerts c
      JOIN orders o ON o.concert_id = c.id::text AND o.status = 'PAID'
      WHERE ${soldConcertWhere}
        AND ${soldDateWhere}
      GROUP BY c.id, c.name, date_trunc('day', o.created_at)
      ORDER BY "bucket" ASC
    `;

    const checkinParams: unknown[] = [];
    const checkinConcertWhere = this.buildConcertWhere(checkinParams, organizerId, concertId);
    const checkinDateWhere = this.buildDateWhere(checkinParams, 'cl.scanned_at', startDate, endDate);

    const checkinQuery = `
      SELECT
        c.id AS "concertId",
        c.name AS "concertName",
        date_trunc('day', cl.scanned_at) AS "bucket",
        COUNT(cl.id) AS "value"
      FROM concerts c
      JOIN tickets t ON t.concert_id = c.id::text
      JOIN checkin_logs cl ON cl.ticket_id = t.id::text
      WHERE ${checkinConcertWhere}
        AND ${checkinDateWhere}
        AND cl.status = 'ACCEPTED'
      GROUP BY c.id, c.name, date_trunc('day', cl.scanned_at)
      ORDER BY "bucket" ASC
    `;

    const soldRows = await this.dataSource.query(soldQuery, soldParams);
    const checkinRows = await this.dataSource.query(checkinQuery, checkinParams);

    const soldSeries = this.buildCumulativeSeries(concerts, soldRows);
    const checkinSeries = this.buildCumulativeSeries(concerts, checkinRows);
    const soldSeriesMap = new Map(soldSeries.map((series) => [series.concertId, series]));
    const checkinSeriesMap = new Map(checkinSeries.map((series) => [series.concertId, series]));

    const series = Array.from(
      new Set([
        ...soldSeries.map((seriesItem) => seriesItem.concertId),
        ...checkinSeries.map((seriesItem) => seriesItem.concertId),
      ]),
    ).map((concertIdValue) => {
      const sold = soldSeriesMap.get(concertIdValue);
      const checked = checkinSeriesMap.get(concertIdValue);
      const concertName = sold?.concertName ?? checked?.concertName ?? concertIdValue;

      const bucketSet = new Set<string>();
      sold?.points.forEach((point) => bucketSet.add(point.timestamp));
      checked?.points.forEach((point) => bucketSet.add(point.timestamp));
      const sortedBuckets = Array.from(bucketSet).sort((left, right) => left.localeCompare(right));

      let soldTotal = 0;
      let checkedTotal = 0;
      let soldIndex = 0;
      let checkedIndex = 0;

      return {
        concertId: concertIdValue,
        concertName,
        points: sortedBuckets.map((bucket) => {
          while (sold && soldIndex < sold.points.length && sold.points[soldIndex].timestamp <= bucket) {
            soldTotal += sold.points[soldIndex].value;
            soldIndex += 1;
          }

          while (checked && checkedIndex < checked.points.length && checked.points[checkedIndex].timestamp <= bucket) {
            checkedTotal += checked.points[checkedIndex].value;
            checkedIndex += 1;
          }

          const value = soldTotal > 0 ? Number(((checkedTotal / soldTotal) * 100).toFixed(2)) : 0;

          return {
            timestamp: bucket,
            value,
          };
        }),
      };
    });

    return {
      granularity: 'day',
      series,
    };
  }
}
