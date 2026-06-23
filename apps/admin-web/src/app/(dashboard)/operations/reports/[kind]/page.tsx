'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowSquareOut, SpinnerGap, TrendUp } from '@phosphor-icons/react';
import { Permission } from '@/lib/permissions';
import { useAuthStore } from '@/lib/auth-store';
import { operationsService, type ReportResponse } from '@/lib/services/operations.service';

type ReportKind = 'revenue' | 'tickets-sold' | 'checkin-rate';

const kindConfig: Record<ReportKind, { label: string; endpoint: string; title: string; description: string }> = {
  revenue: {
    label: 'Request 15',
    endpoint: 'GET /reports/revenue',
    title: 'Revenue report',
    description: 'Shows the revenue contract in isolation with live backend aggregation and fallback states.',
  },
  'tickets-sold': {
    label: 'Request 15',
    endpoint: 'GET /reports/tickets-sold',
    title: 'Tickets sold report',
    description: 'Tracks ticket volume metrics from the live reporting contract for organizers.',
  },
  'checkin-rate': {
    label: 'Request 15',
    endpoint: 'GET /reports/checkin-rate',
    title: 'Check-in rate report',
    description: 'Focuses on check-in performance using the current backend aggregate.',
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

const queueDashboardHref = (() => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
  return apiUrl.replace(/\/api\/v1\/?$/, '') + '/admin/queues';
})();

export default function ReportDetailPage({ params }: Readonly<{ params: Promise<{ kind: string }> }>) {
  const permissions = useAuthStore((state) => state.permissions);
  const canViewReports = permissions.includes(Permission.REPORT_VIEW);
  const [kind, setKind] = useState<ReportKind | null>(null);
  const [state, setState] = useState<{ data: ReportResponse | null; isLoading: boolean; error: string | null }>({
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
        setState({ data: null, isLoading: false, error: error instanceof Error ? error.message : 'Không thể tải báo cáo.' });
      }
    };

    void load();

    return () => {
      isActive = false;
    };
  }, [params]);

  const metricKeys = useMemo(
    () => Object.keys(state.data ?? {}).filter((key) => key !== 'message'),
    [state.data],
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
              <p className="text-[11px] uppercase tracking-[0.22em] text-muted">{config?.label ?? 'Request 15'}</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-primary">{config?.title ?? 'Report detail'}</h1>
              <p className="mt-3 text-sm leading-6 text-muted">{config?.description ?? 'Report contract detail view.'}</p>
            </div>
          </div>
          <a href={queueDashboardHref} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-surface">
            <ArrowSquareOut size={16} />
            Open queue board
          </a>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <section className="rounded-[28px] border border-border bg-surface p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-border bg-background p-3 text-primary">
              <TrendUp size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-primary">Endpoint contract</h2>
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
            ) : state.data?.message ? (
              <p className="text-sm leading-6 text-muted">{state.data.message}</p>
            ) : metricKeys.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {metricKeys.map((key) => (
                  <div key={key} className="rounded-2xl border border-border bg-surface p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted">{key}</p>
                    <p className="mt-2 text-lg font-semibold text-primary">{formatMetricValue(state.data?.[key])}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm leading-6 text-muted">No metrics returned for this report.</p>
            )}
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-background">
            <div className="border-b border-border px-4 py-3">
              <h3 className="text-sm font-semibold text-primary">Metric table</h3>
              <p className="mt-1 text-xs text-muted">Key/value view of the same live response.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full whitespace-nowrap text-left text-sm">
                <thead className="bg-surface/80 text-muted">
                  <tr>
                    <th className="px-4 py-3 font-medium">Metric</th>
                    <th className="px-4 py-3 font-medium">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {state.isLoading ? (
                    <tr>
                      <td colSpan={2} className="px-4 py-8 text-center text-muted">
                        Loading metrics...
                      </td>
                    </tr>
                  ) : state.error ? (
                    <tr>
                      <td colSpan={2} className="px-4 py-8 text-center text-red-800">
                        {state.error}
                      </td>
                    </tr>
                  ) : metricKeys.length > 0 ? (
                    metricKeys.map((key) => (
                      <tr key={key} className="hover:bg-surface/60">
                        <td className="px-4 py-3 font-medium text-primary">{key}</td>
                        <td className="px-4 py-3 text-muted">{formatMetricValue(state.data?.[key])}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={2} className="px-4 py-8 text-center text-muted">
                        No rows to display.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-background">
            <div className="border-b border-border px-4 py-3">
              <h3 className="text-sm font-semibold text-primary">Interpretation</h3>
              <p className="mt-1 text-xs text-muted">How to read the current backend state.</p>
            </div>
            <table className="min-w-full text-left text-sm">
              <tbody className="divide-y divide-border">
                <tr>
                  <th className="w-44 px-4 py-3 font-medium text-primary">Live response</th>
                  <td className="px-4 py-3 text-muted">Backend returns aggregation rows from PostgreSQL</td>
                </tr>
                <tr>
                  <th className="w-44 px-4 py-3 font-medium text-primary">Structured values</th>
                  <td className="px-4 py-3 text-muted">Render directly from the live report payload</td>
                </tr>
                <tr>
                  <th className="w-44 px-4 py-3 font-medium text-primary">Permissions</th>
                  <td className="px-4 py-3 text-muted">Shown only when `report:view` is granted</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-[28px] border border-border bg-surface p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-primary">Backend status</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              The backend controller now returns live aggregates, so this view surfaces the contract rather than fake charts.
            </p>
          </div>

          <div className="rounded-[28px] border border-border bg-surface p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-primary">Loaded keys</h2>
            <div className="mt-4 rounded-2xl border border-border bg-background p-4 text-sm leading-6 text-muted">
              {metricKeys.length > 0 ? metricKeys.map((key) => <p key={key}>{key}</p>) : <p>None</p>}
            </div>
          </div>

          <div className="rounded-[28px] border border-border bg-surface p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-primary">Contract note</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Reporting permissions are enforced by the backend via `report:view`, and the page respects that gating before showing any data.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
