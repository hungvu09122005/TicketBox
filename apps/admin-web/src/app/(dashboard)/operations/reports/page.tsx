'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowSquareOut, CheckCircle, SpinnerGap, TrendUp } from '@phosphor-icons/react';
import { Permission } from '@/lib/permissions';
import { useAuthStore } from '@/lib/auth-store';
import { operationsService, type ReportResponse } from '@/lib/services/operations.service';

type ReportState = {
  data: ReportResponse | null;
  isLoading: boolean;
  error: string | null;
};

const initialState: ReportState = {
  data: null,
  isLoading: true,
  error: null,
};

const queueDashboardHref = (() => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
  return apiUrl.replace(/\/api\/v1\/?$/, '') + '/admin/queues';
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

function MetricCard({
  title,
  state,
}: Readonly<{
  title: string;
  state: ReportState;
}>) {
  const metricKeys = Object.keys(state.data ?? {}).filter((key) => key !== 'message');

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
        {state.isLoading ? (
          <div className="inline-flex items-center gap-2 text-sm text-muted">
            <SpinnerGap size={16} className="animate-spin" />
            Loading...
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
          operationsService.getRevenueReport(),
          operationsService.getTicketsSoldReport(),
          operationsService.getCheckinRateReport(),
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
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl space-y-3">
            <Link href="/operations" className="inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-primary">
              <ArrowLeft size={16} />
              Back to operations hub
            </Link>
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-muted">Request 15</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-primary">Sales and check-in dashboard</h1>
              <p className="mt-3 text-sm leading-6 text-muted">
                The page reads live reporting endpoints and keeps a clean loading/error/empty state for the current backend aggregates.
              </p>
            </div>
          </div>
          <a href={queueDashboardHref} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-surface">
            <ArrowSquareOut size={16} />
            Open queue board
          </a>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Link href="/operations/reports/revenue" className="block">
          <MetricCard title="Revenue" state={revenue} />
        </Link>
        <Link href="/operations/reports/tickets-sold" className="block">
          <MetricCard title="Tickets sold" state={tickets} />
        </Link>
        <Link href="/operations/reports/checkin-rate" className="block">
          <MetricCard title="Check-in rate" state={checkin} />
        </Link>
      </div>

      <div className="rounded-[28px] border border-border bg-surface p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-primary">Report summary table</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          A compact table view for the same reporting contract so admins can scan endpoint state faster than reading the cards one by one.
        </p>
        <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-background">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-surface/80 text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Report</th>
                <th className="px-4 py-3 font-medium">Endpoint</th>
                <th className="px-4 py-3 font-medium">State</th>
                <th className="px-4 py-3 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[
                ['Revenue', 'GET /reports/revenue', revenue],
                ['Tickets sold', 'GET /reports/tickets-sold', tickets],
                ['Check-in rate', 'GET /reports/checkin-rate', checkin],
              ].map(([reportName, endpoint, state]) => {
                const reportState = state as ReportState;
                const stateLabel = reportState.isLoading ? 'Loading' : reportState.error ? 'Error' : reportState.data?.message ? 'Placeholder' : 'Ready';
                const notes = reportState.isLoading
                  ? 'Waiting for backend response'
                  : reportState.error
                    ? reportState.error
                    : reportState.data?.message
                      ? reportState.data.message
                      : 'Structured metrics available';

                return (
                  <tr key={endpoint as string}>
                    <td className="px-4 py-3 font-medium text-primary">{reportName as string}</td>
                    <td className="px-4 py-3 text-muted">{endpoint as string}</td>
                    <td className="px-4 py-3 text-muted">{stateLabel}</td>
                    <td className="px-4 py-3 text-muted">{notes}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {[
          ['revenue', 'GET /reports/revenue'],
          ['tickets-sold', 'GET /reports/tickets-sold'],
          ['checkin-rate', 'GET /reports/checkin-rate'],
        ].map(([slug, endpoint]) => (
          <Link
            key={slug}
            href={`/operations/reports/${slug}`}
            className="rounded-[28px] border border-border bg-surface p-5 shadow-sm transition-transform hover:-translate-y-[1px] active:translate-y-0"
          >
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted">{slug}</p>
            <h3 className="mt-2 text-base font-semibold text-primary">{endpoint}</h3>
            <p className="mt-3 text-sm leading-6 text-muted">
              Open a dedicated report view with live contract, status, and loading/error states.
            </p>
          </Link>
        ))}
      </div>

      <div className="rounded-[28px] border border-border bg-surface p-5 shadow-sm">
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
          <CheckCircle size={18} className="mt-0.5 shrink-0" />
          <p className="text-sm leading-6">
            The reporting endpoints are now backed by live aggregation queries. These linked views keep the contract visible without inventing fake charts.
          </p>
        </div>
      </div>
    </div>
  );
}
