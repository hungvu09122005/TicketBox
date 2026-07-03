'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowSquareOut, SpinnerGap, TrendUp } from '@phosphor-icons/react';
import { Permission } from '@/lib/permissions';
import { useAuthStore } from '@/lib/auth-store';
import {
  operationsService,
  type ReportTimelineResponse,
  type ReportTimelineSeries,
} from '@/lib/services/operations.service';

type ReportState = {
  data: ReportTimelineResponse | null;
  isLoading: boolean;
  error: string | null;
};

const initialState: ReportState = {
  data: null,
  isLoading: true,
  error: null,
};

const chartColors = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
];

const queueDashboardHref = (() => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
  return `${apiUrl.replace(/\/$/, '')}/admin/queues`;
})();

function formatMetricValue(value: unknown) {
  if (typeof value === 'number') {
    return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(value);
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }

  return '--';
}

function formatDateLabel(timestamp: string) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function getAllPoints(series: ReportTimelineSeries[]) {
  return series.flatMap((entry) => entry.points.map((point) => ({ ...point, concertId: entry.concertId })));
}

function buildScale(min: number, max: number, start: number, end: number) {
  const span = max - min || 1;

  return (value: number) => start + ((value - min) / span) * (end - start);
}

function buildLinePath(
  points: Array<{ x: number; y: number }>,
) {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
}

function getLatestValue(points: Array<{ timestamp: string; value: number }>) {
  return points.length > 0 ? points[points.length - 1]?.value ?? 0 : 0;
}

function TimelineChart({
  title,
  state,
  detailHref,
}: Readonly<{
  title: string;
  state: ReportState;
  detailHref: string;
}>) {
  const series = state.data?.series ?? [];
  const flattenedPoints = useMemo(() => getAllPoints(series), [series]);

  if (state.isLoading) {
    return (
      <div className="rounded-[28px] border border-border bg-surface p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted">{title}</p>
            <h2 className="mt-2 text-lg font-semibold text-primary">{title}</h2>
          </div>
          <div className="rounded-full border border-border bg-background p-2 text-primary">
            <TrendUp size={18} />
          </div>
        </div>
        <div className="mt-4 rounded-2xl border border-border bg-background p-4">
          <div className="inline-flex items-center gap-2 text-sm text-muted">
            <SpinnerGap size={16} className="animate-spin" />
            Loading...
          </div>
        </div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="rounded-[28px] border border-border bg-surface p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted">{title}</p>
            <h2 className="mt-2 text-lg font-semibold text-primary">{title}</h2>
          </div>
          <div className="rounded-full border border-border bg-background p-2 text-primary">
            <TrendUp size={18} />
          </div>
        </div>
        <div className="mt-4 rounded-2xl border border-border bg-background p-4">
          <p className="text-sm leading-6 text-red-800">{state.error}</p>
        </div>
      </div>
    );
  }

  if (!series.length || !flattenedPoints.length) {
    return (
      <div className="rounded-[28px] border border-border bg-surface p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted">{title}</p>
            <h2 className="mt-2 text-lg font-semibold text-primary">{title}</h2>
          </div>
          <div className="rounded-full border border-border bg-background p-2 text-primary">
            <TrendUp size={18} />
          </div>
        </div>
        <div className="mt-4 rounded-2xl border border-border bg-background p-4">
          <p className="text-sm leading-6 text-muted">No time series returned for this report.</p>
        </div>
      </div>
    );
  }

  const xValues = flattenedPoints.map((point) => new Date(point.timestamp).getTime()).filter((value) => Number.isFinite(value));
  const yValues = flattenedPoints.map((point) => point.value).filter((value) => Number.isFinite(value));

  if (!xValues.length || !yValues.length) {
    return (
      <div className="rounded-[28px] border border-border bg-surface p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted">{title}</p>
            <h2 className="mt-2 text-lg font-semibold text-primary">{title}</h2>
          </div>
          <Link
            href={detailHref}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-primary transition hover:bg-surface"
          >
            View table
            <ArrowSquareOut size={16} />
          </Link>
        </div>
        <div className="mt-4 rounded-2xl border border-border bg-background p-4">
          <p className="text-sm leading-6 text-muted">No valid timeline points returned for this report.</p>
        </div>
      </div>
    );
  }

  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  const minY = Math.min(0, ...yValues);
  const maxY = Math.max(...yValues);

  const chartWidth = 920;
  const chartHeight = 320;
  const paddingLeft = 56;
  const paddingRight = 24;
  const paddingTop = 24;
  const paddingBottom = 44;
  const xScale = buildScale(minX, maxX, paddingLeft, chartWidth - paddingRight);
  const yScale = buildScale(minY, maxY || 1, chartHeight - paddingBottom, paddingTop);
  const yTicks = 4;
  const xTicks = 4;

  return (
    <div className="rounded-[28px] border border-border bg-surface p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-muted">{title}</p>
          <h2 className="mt-2 text-lg font-semibold text-primary">{title}</h2>
        </div>
        <Link
          href={detailHref}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-primary transition hover:bg-surface"
        >
          View table
          <ArrowSquareOut size={16} />
        </Link>
      </div>

      <div className="mt-4 rounded-2xl border border-border bg-background p-4">
        <div className="mb-4 flex flex-wrap gap-2">
          {series.map((entry, index) => (
            <div key={entry.concertId} className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-muted">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: chartColors[index % chartColors.length] }}
              />
              <span className="max-w-[220px] truncate">{entry.concertName}</span>
              <span className="font-medium text-primary">{formatMetricValue(getLatestValue(entry.points))}</span>
            </div>
          ))}
        </div>

        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="h-[320px] w-full min-w-[680px]">
            {Array.from({ length: yTicks + 1 }, (_, index) => {
              const ratio = index / yTicks;
              const value = maxY - (maxY - minY) * ratio;
              const y = yScale(value);
              return (
                <g key={`y-${index}`}>
                  <line
                    x1={paddingLeft}
                    y1={y}
                    x2={chartWidth - paddingRight}
                    y2={y}
                    stroke="currentColor"
                    strokeOpacity="0.09"
                  />
                  <text x={10} y={y + 4} className="text-[11px]" style={{ fill: 'var(--color-muted)' }}>
                    {formatMetricValue(value)}
                  </text>
                </g>
              );
            })}

            {Array.from({ length: xTicks + 1 }, (_, index) => {
              const ratio = index / xTicks;
              const timestamp = minX + (maxX - minX) * ratio;
              const x = xScale(timestamp);
              return (
                <g key={`x-${index}`}>
                  <line
                    x1={x}
                    y1={paddingTop}
                    x2={x}
                    y2={chartHeight - paddingBottom}
                    stroke="currentColor"
                    strokeOpacity="0.04"
                  />
                  <text x={x} y={chartHeight - 16} textAnchor="middle" className="text-[11px]" style={{ fill: 'var(--color-muted)' }}>
                    {formatDateLabel(new Date(timestamp).toISOString())}
                  </text>
                </g>
              );
            })}

            <line
              x1={paddingLeft}
              y1={chartHeight - paddingBottom}
              x2={chartWidth - paddingRight}
              y2={chartHeight - paddingBottom}
              stroke="currentColor"
              strokeOpacity="0.18"
            />
            <line
              x1={paddingLeft}
              y1={paddingTop}
              x2={paddingLeft}
              y2={chartHeight - paddingBottom}
              stroke="currentColor"
              strokeOpacity="0.18"
            />

            {series.map((entry, index) => {
              const chartPoints = entry.points
                .map((point) => {
                  const timestamp = new Date(point.timestamp).getTime();
                  if (!Number.isFinite(timestamp)) return null;

                  return {
                    x: xScale(timestamp),
                    y: yScale(point.value),
                    value: point.value,
                  };
                })
                .filter((point): point is { x: number; y: number; value: number } => point !== null);

              if (!chartPoints.length) {
                return null;
              }

              return (
                <g key={entry.concertId}>
                  <path
                    d={buildLinePath(chartPoints)}
                    fill="none"
                    stroke={chartColors[index % chartColors.length]}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {chartPoints.map((point, pointIndex) => (
                    <circle
                      key={`${entry.concertId}-${pointIndex}`}
                      cx={point.x}
                      cy={point.y}
                      r="4"
                      fill="var(--color-background)"
                      stroke={chartColors[index % chartColors.length]}
                      strokeWidth="2"
                    />
                  ))}
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const permissions = useAuthStore((state) => state.permissions);
  const canViewReports = permissions.includes(Permission.REPORT_VIEW);
  const [revenue, setRevenue] = useState<ReportState>(initialState);
  const [tickets, setTickets] = useState<ReportState>(initialState);
  const [checkin, setCheckin] = useState<ReportState>(initialState);

  useEffect(() => {
    let isActive = true;

    const load = async () => {
      try {
        const [revenueData, ticketsData, checkinData] = await Promise.all([
          operationsService.getRevenueTimelineReport(),
          operationsService.getTicketsSoldTimelineReport(),
          operationsService.getCheckinRateTimelineReport(),
        ]);

        if (!isActive) return;

        setRevenue({ data: revenueData, isLoading: false, error: null });
        setTickets({ data: ticketsData, isLoading: false, error: null });
        setCheckin({ data: checkinData, isLoading: false, error: null });
      } catch (error) {
        if (!isActive) return;
        const message = error instanceof Error ? error.message : 'Không thể tải báo cáo.';
        setRevenue({ data: null, isLoading: false, error: message });
        setTickets({ data: null, isLoading: false, error: message });
        setCheckin({ data: null, isLoading: false, error: message });
      }
    };

    void load();

    return () => {
      isActive = false;
    };
  }, []);

  if (!canViewReports) {
    return (
      <div className="rounded-[32px] border border-border bg-surface p-6 text-sm text-muted shadow-sm">
        You do not have report access.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[32px] border border-border bg-surface p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="max-w-2xl space-y-3">
            <Link href="/operations" className="inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-primary">
              <ArrowLeft size={16} />
              Back to operations hub
            </Link>
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted">Reports</p>
            <div>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-primary">Sales and check-in dashboard</h1>
            </div>
          </div>
          <a
            href={queueDashboardHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-surface md:self-start"
          >
            <ArrowSquareOut size={16} />
            Open queue board
          </a>
        </div>
      </div>

      <div className="grid gap-4">
        <TimelineChart title="Revenue" state={revenue} detailHref="/operations/reports/revenue" />
        <TimelineChart title="Tickets sold" state={tickets} detailHref="/operations/reports/tickets-sold" />
        <TimelineChart title="Check-in rate" state={checkin} detailHref="/operations/reports/checkin-rate" />
      </div>
    </div>
  );
}
