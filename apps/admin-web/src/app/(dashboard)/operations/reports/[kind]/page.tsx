'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowSquareOut, SpinnerGap, TrendUp } from '@phosphor-icons/react';
import { Permission } from '@/lib/permissions';
import { useAuthStore } from '@/lib/auth-store';
import { operationsService, type ReportResponse } from '@/lib/services/operations.service';

type ReportKind = 'revenue' | 'tickets-sold' | 'checkin-rate';
type ReportRow = Record<string, unknown>;

const kindConfig: Record<ReportKind, { label: string; endpoint: string; title: string; description: string }> = {
  revenue: {
    label: 'Revenue report',
    endpoint: 'GET /reports/revenue',
    title: 'Revenue report',
    description: 'View revenue figures for the selected report.',
  },
  'tickets-sold': {
    label: 'Tickets sold report',
    endpoint: 'GET /reports/tickets-sold',
    title: 'Tickets sold report',
    description: 'View ticket sales for the selected report.',
  },
  'checkin-rate': {
    label: 'Check-in rate report',
    endpoint: 'GET /reports/checkin-rate',
    title: 'Check-in rate report',
    description: 'View check-in performance for the selected report.',
  },
};

function formatMetricValue(value: unknown) {
  if (typeof value === 'number') {
    return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(value);
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }

  return '--';
}

function formatMetricLabel(key: string, index: number) {
  if (/^\d+$/.test(key)) {
    return `Metric ${index + 1}`;
  }

  return key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getReportRows(data: ReportResponse | ReportResponse[] | null): ReportRow[] {
  if (!data) return [];
  return Array.isArray(data) ? (data as ReportRow[]) : [data as ReportRow];
}

const queueDashboardHref = (() => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
  return `${apiUrl.replace(/\/$/, '')}/admin/queues`;
})();

export default function ReportDetailPage({ params }: Readonly<{ params: Promise<{ kind: string }> }>) {
  const permissions = useAuthStore((state) => state.permissions);
  const canViewReports = permissions.includes(Permission.REPORT_VIEW);
  const [kind, setKind] = useState<ReportKind | null>(null);
  const [state, setState] = useState<{ data: ReportResponse | ReportResponse[] | null; isLoading: boolean; error: string | null }>({
    data: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    let isActive = true;

    const load = async () => {
      try {
        const resolved = await params;
        const nextKind = resolved.kind as ReportKind;
        const config = kindConfig[nextKind];

        if (!config) {
          throw new Error('Unsupported report kind.');
        }

        setKind(nextKind);

        const response =
          nextKind === 'revenue'
            ? await operationsService.getRevenueReport()
            : nextKind === 'tickets-sold'
              ? await operationsService.getTicketsSoldReport()
              : await operationsService.getCheckinRateReport();

        if (!isActive) return;

        setState({ data: response, isLoading: false, error: null });
      } catch (error) {
        if (!isActive) return;
        setState({ data: null, isLoading: false, error: error instanceof Error ? error.message : 'Could not load the report.' });
      }
    };

    void load();

    return () => {
      isActive = false;
    };
  }, [params]);

  const reportRows = useMemo(() => getReportRows(state.data), [state.data]);
  const firstRow = reportRows[0] ?? null;
  const metricKeys = useMemo(
    () => Object.keys(firstRow ?? {}).filter((key) => key !== 'message'),
    [firstRow],
  );

  if (!canViewReports) {
    return (
      <div className="rounded-[32px] border border-border bg-surface p-6 text-sm text-muted shadow-sm">
        You do not have report access.
      </div>
    );
  }

  const config = kind ? kindConfig[kind] : null;

  return (
    <div className="space-y-6">
      <div className="rounded-[32px] border border-border bg-surface p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl space-y-3">
            <Link href="/operations/reports" className="inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-primary">
              <ArrowLeft size={16} />
              Back to reports
            </Link>
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-muted">{config?.label ?? 'Report detail'}</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-primary">{config?.title ?? 'Report detail'}</h1>
              <p className="mt-3 text-sm leading-6 text-muted">{config?.description ?? 'Report details.'}</p>
            </div>
          </div>
          <a href={queueDashboardHref} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-surface">
            <ArrowSquareOut size={16} />
            Open queue board
          </a>
        </div>
      </div>

      <div className="grid gap-4">
        <section className="rounded-[28px] border border-border bg-surface p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-border bg-background p-3 text-primary">
              <TrendUp size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-primary">Report data</h2>
              <p className="text-sm text-muted">{config?.endpoint ?? 'GET /reports/*'}</p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-border bg-background p-4">
            {state.isLoading ? (
              <div className="inline-flex items-center gap-2 text-sm text-muted">
                <SpinnerGap size={16} className="animate-spin" />
                Loading report...
              </div>
            ) : state.error ? (
              <p className="text-sm leading-6 text-red-800">{state.error}</p>
            ) : !reportRows.length ? (
              <p className="text-sm leading-6 text-muted">No metrics returned for this report.</p>
            ) : 'message' in reportRows[0] && typeof reportRows[0].message === 'string' ? (
              <p className="text-sm leading-6 text-muted">{reportRows[0].message}</p>
            ) : metricKeys.length > 0 ? (
              <div className="overflow-hidden rounded-2xl border border-border bg-surface">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-background text-muted">
                      <tr>
                        {metricKeys.map((key, index) => (
                          <th key={key} className="px-4 py-3 font-medium">
                            {formatMetricLabel(key, index)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {reportRows.map((row, rowIndex) => (
                        <tr key={`${rowIndex}-${metricKeys.join('-')}`}>
                          {metricKeys.map((key) => (
                            <td key={`${rowIndex}-${key}`} className="px-4 py-3 text-muted">
                              {formatMetricValue(row[key])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <p className="text-sm leading-6 text-muted">No metrics returned for this report.</p>
            )}
          </div>

        </section>
      </div>
    </div>
  );
}
