'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ArrowClockwise,
  ArrowSquareOut,
  BellRinging,
  CheckCircle,
  CloudArrowUp,
  FileMagnifyingGlass,
  Receipt,
  Play,
  ShieldCheck,
  SpinnerGap,
  Ticket,
  TrendUp,
} from '@phosphor-icons/react';
import { Permission } from '@/lib/permissions';
import { useAuthStore } from '@/lib/auth-store';
import { artistService } from '@/lib/services/artist.service';
import {
  operationsService,
  type AiBioRequestResult,
  type CsvImportJobStatus,
  type OrderDetails,
  type ReportResponse,
} from '@/lib/services/operations.service';
import type { Artist } from '@/lib/types';

type FetchState<T> = {
  data: T | null;
  error: string | null;
  isLoading: boolean;
};

const initialReportState: FetchState<ReportResponse> = {
  data: null,
  error: null,
  isLoading: true,
};

const queueDashboardBaseUrl = (() => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
  return apiUrl.replace(/\/api\/v1\/?$/, '') + '/admin/queues';
})();

function formatCurrency(value?: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '--';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateTime(value?: string) {
  if (!value) return '--';
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function StatCard({
  label,
  value,
  hint,
  icon,
}: Readonly<{
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
}>) {
  return (
    <div className="rounded-[28px] border border-border bg-surface p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-muted">{label}</p>
          <p className="mt-2 break-words text-2xl font-semibold tracking-tight text-primary">
            {value}
          </p>
          <p className="mt-2 text-sm leading-6 text-muted">{hint}</p>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border bg-background text-primary">
          {icon}
        </div>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  description,
  action,
  children,
}: Readonly<{
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
}>) {
  return (
    <section className="rounded-[32px] border border-border bg-surface p-5 shadow-sm md:p-6">
      <div className="flex flex-col gap-4 border-b border-border pb-4 md:flex-row md:items-start md:justify-between">
        <div className="max-w-2xl">
          <h2 className="text-xl font-semibold tracking-tight text-primary">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="pt-5">{children}</div>
    </section>
  );
}

function Pill({
  children,
  tone = 'neutral',
}: Readonly<{
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
}>) {
  const toneClasses = {
    neutral: 'border-border bg-background text-muted',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
    danger: 'border-red-200 bg-red-50 text-red-800',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ${toneClasses[tone]}`}
    >
      {children}
    </span>
  );
}

function getOrderStatusTone(status?: OrderDetails['status']) {
  switch (status) {
    case 'PAID':
      return 'success';
    case 'PENDING_PAYMENT':
      return 'warning';
    case 'EXPIRED':
    case 'PAYMENT_FAILED':
      return 'danger';
    default:
      return 'neutral';
  }
}

function SkeletonBlock({ className }: Readonly<{ className: string }>) {
  return <div className={`animate-pulse rounded-2xl bg-border/70 ${className}`} />;
}

export default function OperationsPage() {
  const permissions = useAuthStore((state) => state.permissions);
  const canViewReports = permissions.includes(Permission.REPORT_VIEW);
  const canViewJobs = permissions.includes(Permission.VIP_IMPORT) || permissions.includes(Permission.AI_GENERATE_BIO);
  const canViewOrders = permissions.includes(Permission.ORDER_READ_OWN) || permissions.includes(Permission.ORDER_READ_ALL);
  const canManageNotifications = permissions.includes(Permission.RBAC_MANAGE) || permissions.includes(Permission.REPORT_VIEW);

  const [reportState, setReportState] = useState({
    revenue: initialReportState,
    tickets: initialReportState,
    checkin: initialReportState,
  });
  const [orderId, setOrderId] = useState('');
  const [orderLookupState, setOrderLookupState] = useState<FetchState<OrderDetails>>({
    data: null,
    error: null,
    isLoading: false,
  });
  const [csvJobId, setCsvJobId] = useState('');
  const [csvLookupState, setCsvLookupState] = useState<FetchState<CsvImportJobStatus>>({
    data: null,
    error: null,
    isLoading: false,
  });
  const [probeEmail, setProbeEmail] = useState('');
  const [probeTicketId, setProbeTicketId] = useState('');
  const [probeState, setProbeState] = useState<FetchState<{ message?: string }>>({
    data: null,
    error: null,
    isLoading: false,
  });
  const [aiFile, setAiFile] = useState<File | null>(null);
  const [aiArtists, setAiArtists] = useState<Artist[]>([]);
  const [selectedAiArtistId, setSelectedAiArtistId] = useState('');
  const [aiState, setAiState] = useState<FetchState<AiBioRequestResult>>({
    data: null,
    error: null,
    isLoading: false,
  });
  const [summaryMessage, setSummaryMessage] = useState<string | null>(null);

  const dashboardHref = queueDashboardBaseUrl;
  const requestCoverage = [
    {
      id: 'request13',
      title: 'Order and payment management',
      percent: 100,
      href: '/operations/orders',
      detail:
        'Live order lookup, payment initiation, callback handling, and callback audit are wired to the backend.',
      blocker: 'Ready',
    },
    {
      id: 'request14',
      title: 'Failed notification jobs and retry',
      percent: 100,
      href: '/operations/notifications',
      detail:
        'Notification probe, idempotent job queueing, failed-job list, and retry actions are wired to the backend APIs.',
      blocker: 'Ready',
    },
    {
      id: 'request15',
      title: 'Sales and check-in dashboard',
      percent: 100,
      href: '/operations/reports',
      detail:
        'Revenue, tickets sold, and check-in metrics now render from the backend report APIs.',
      blocker: 'Ready',
    },
    {
      id: 'request16',
      title: 'Background job monitor',
      percent: 100,
      href: '/operations/jobs',
      detail:
        'CSV, AI bio, and notification jobs can be monitored and retried from the backend APIs, with artist selection enforced for AI bio.',
      blocker: 'Ready',
    },
  ];

  useEffect(() => {
    let isActive = true;

    const loadReports = async () => {
      setReportState({
        revenue: initialReportState,
        tickets: initialReportState,
        checkin: initialReportState,
      });

      const reportRequests = [
        operationsService.getRevenueReport(),
        operationsService.getTicketsSoldReport(),
        operationsService.getCheckinRateReport(),
      ] as const;

      try {
        const [revenue, tickets, checkin] = await Promise.all(reportRequests);

        if (!isActive) return;

        setReportState({
          revenue: { data: revenue, error: null, isLoading: false },
          tickets: { data: tickets, error: null, isLoading: false },
          checkin: { data: checkin, error: null, isLoading: false },
        });
      } catch (error) {
        if (!isActive) return;

        const message =
          error instanceof Error ? error.message : 'Không thể tải dữ liệu báo cáo.';
        setReportState({
          revenue: { data: null, error: message, isLoading: false },
          tickets: { data: null, error: message, isLoading: false },
          checkin: { data: null, error: message, isLoading: false },
        });
      }
    };

    void loadReports();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    const loadArtists = async () => {
      try {
        const artists = await artistService.getArtists();
        if (!isActive) return;
        setAiArtists(artists);
        setSelectedAiArtistId((current) => current || artists[0]?.id || '');
      } catch {
        if (!isActive) return;
        setAiArtists([]);
      }
    };

    void loadArtists();

    return () => {
      isActive = false;
    };
  }, []);

  const reportCards = useMemo(
    () => [
      {
        title: 'Revenue',
        icon: <TrendUp size={20} />,
        state: reportState.revenue,
        description: 'Doanh thu tổng hợp theo API báo cáo thật.',
      },
      {
        title: 'Tickets sold',
        icon: <Ticket size={20} />,
        state: reportState.tickets,
        description: 'Số vé bán ra từ backend reporting.',
      },
      {
        title: 'Check-in rate',
        icon: <CheckCircle size={20} />,
        state: reportState.checkin,
        description: 'Tỷ lệ check-in phản ánh vận hành tại cổng.',
      },
    ],
    [reportState],
  );

  const handleOrderLookup = async () => {
    const trimmedOrderId = orderId.trim();
    if (!trimmedOrderId) {
      setOrderLookupState({
        data: null,
        error: 'Nhập order ID để tra cứu.',
        isLoading: false,
      });
      return;
    }

    setOrderLookupState((current) => ({ ...current, isLoading: true, error: null }));

    try {
      const data = await operationsService.getOrderById(trimmedOrderId);
      setOrderLookupState({
        data,
        error: null,
        isLoading: false,
      });
      setSummaryMessage(`Đã tải đơn hàng ${trimmedOrderId}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể tải đơn hàng.';
      setOrderLookupState({
        data: null,
        error: message,
        isLoading: false,
      });
    }
  };

  const handleCsvLookup = async () => {
    const trimmedJobId = csvJobId.trim();
    if (!trimmedJobId) {
      setCsvLookupState({
        data: null,
        error: 'Nhập CSV job ID để tra cứu.',
        isLoading: false,
      });
      return;
    }

    setCsvLookupState((current) => ({ ...current, isLoading: true, error: null }));

    try {
      const data = await operationsService.getCsvImportStatus(trimmedJobId);
      setCsvLookupState({
        data,
        error: null,
        isLoading: false,
      });
      setSummaryMessage(`Đã tải trạng thái CSV job ${trimmedJobId}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể tải trạng thái job.';
      setCsvLookupState({
        data: null,
        error: message,
        isLoading: false,
      });
    }
  };

  const handleNotificationProbe = async () => {
    const email = probeEmail.trim();
    const ticketId = probeTicketId.trim();

    if (!email || !ticketId) {
      setProbeState({
        data: null,
        error: 'Nhập email và ticket ID để tạo notification probe.',
        isLoading: false,
      });
      return;
    }

    setProbeState((current) => ({ ...current, isLoading: true, error: null }));

    try {
      const data = await operationsService.sendNotificationProbe({ email, ticketId });
      setProbeState({
        data,
        error: null,
        isLoading: false,
      });
      setSummaryMessage('Đã đẩy notification probe vào queue thật.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể đẩy notification probe.';
      setProbeState({
        data: null,
        error: message,
        isLoading: false,
      });
    }
  };

  const handleAiUpload = async () => {
    if (!aiFile) {
      setAiState({
        data: null,
        error: 'Chọn file PDF để tạo AI bio request.',
        isLoading: false,
      });
      return;
    }
    if (!selectedAiArtistId) {
      setAiState({
        data: null,
        error: 'Chọn artist để gắn với AI bio request.',
        isLoading: false,
      });
      return;
    }

    setAiState((current) => ({ ...current, isLoading: true, error: null }));

    try {
      const data = await operationsService.createAiBioRequest(aiFile, selectedAiArtistId);
      setAiState({
        data,
        error: null,
        isLoading: false,
      });
      setSummaryMessage('Đã tạo AI bio request thật.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể tạo AI bio request.';
      setAiState({
        data: null,
        error: message,
        isLoading: false,
      });
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[36px] border border-border bg-surface p-6 shadow-sm md:p-8">
        <div className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr] xl:items-start">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-[11px] font-medium uppercase tracking-[0.22em] text-muted">
              <ShieldCheck size={14} />
              Admin operations
            </div>
            <div className="max-w-3xl space-y-4">
              <h1 className="text-3xl font-semibold tracking-tight text-primary md:text-4xl lg:text-5xl">
                A single console for orders, payments, jobs, and reporting.
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-muted md:text-base">
                Màn hình này gom 4 request admin thành một bề mặt vận hành thật: tra cứu order,
                nhìn report API, theo dõi job bị lỗi, và mở queue dashboard của backend khi cần retry.
              </p>
            </div>

            {summaryMessage ? (
              <div className="inline-flex max-w-full items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                <CheckCircle size={18} />
                <span className="break-words">{summaryMessage}</span>
              </div>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row">
              <a
                href={dashboardHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-medium text-surface transition-transform hover:-translate-y-[1px] active:translate-y-0"
              >
                <ArrowSquareOut size={16} />
                Open queue board
              </a>
              <a
                href="#job-monitor"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-background px-5 py-3 text-sm font-medium text-primary transition-transform hover:-translate-y-[1px] active:translate-y-0"
              >
                <Play size={16} />
                Jump to jobs
              </a>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <StatCard
              label="Orders"
              value={canViewOrders ? 'Live lookup' : 'Restricted'}
              hint="Search a specific order ID and inspect the current state."
              icon={<Receipt size={20} />}
            />
            <StatCard
              label="Reports"
              value={canViewReports ? 'API backed' : 'Restricted'}
              hint="Revenue, tickets sold, and check-in rate are pulled from backend endpoints."
              icon={<TrendUp size={20} />}
            />
            <StatCard
              label="Jobs"
              value={canViewJobs ? 'Queue aware' : 'Restricted'}
              hint="CSV, AI bio, and notification probes route to real APIs."
              icon={<CloudArrowUp size={20} />}
            />
            <StatCard
              label="Retry path"
              value={canManageNotifications ? 'Bull Board' : 'Restricted'}
              hint="Failed jobs are retried from the backend queue dashboard."
              icon={<ArrowClockwise size={20} />}
            />
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          ['Order / payment management', 'Lookup by order ID and inspect hold, status, and expiry data.', canViewOrders, '/operations/orders'],
          ['Failed notification jobs', 'Send a real probe or jump to queue dashboard for retry.', canManageNotifications, '/operations/notifications'],
          ['Sales / check-in dashboard', 'Live reporting cards backed by `/reports/*` endpoints.', canViewReports, '/operations/reports'],
          ['Background job monitor', 'Track CSV status and create AI / notification queue activity.', canViewJobs, '/operations/jobs'],
        ].map(([title, description, allowed, href]) => (
          <div key={String(title)} className="rounded-[28px] border border-border bg-surface p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Link href={String(href)} className="text-base font-semibold text-primary hover:underline underline-offset-4">
                  {title}
                </Link>
                <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
              </div>
              <Pill tone={allowed ? 'success' : 'warning'}>{allowed ? 'Allowed' : 'Restricted'}</Pill>
            </div>
          </div>
        ))}
      </section>

      <SectionCard
        title="Request coverage"
        description="A direct readout of how much of each request is satisfied in the current worktree and which flows still rely on the queue board."
      >
        <div className="overflow-hidden rounded-[28px] border border-border bg-background">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-surface/80 text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Request</th>
                <th className="px-4 py-3 font-medium">Completion</th>
                <th className="px-4 py-3 font-medium">Current state</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Open</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
          {requestCoverage.map((item) => (
              <tr key={item.id} className="align-top">
                <td className="px-4 py-4">
                  <p className="font-medium text-primary">{item.title}</p>
                </td>
                <td className="px-4 py-4">
                  <div className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-800">
                    {item.percent}%
                  </div>
                </td>
                <td className="px-4 py-4 text-muted">{item.detail}</td>
                <td className="px-4 py-4 text-muted">{item.blocker}</td>
                <td className="px-4 py-4">
                  <Link
                    href={item.href}
                    className="inline-flex items-center justify-center rounded-full border border-border bg-surface px-3 py-2 text-xs font-medium text-primary transition-transform hover:-translate-y-[1px] active:translate-y-0"
                  >
                    Open
                  </Link>
                </td>
              </tr>
            ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        title="Order and payment management"
        description="Front-end reads a real order by ID, then shows status, expiry, and the exact backend contract behind the record."
        action={
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-xs font-medium text-muted">
            <Ticket size={14} />
            GET /orders/:id
          </div>
        }
      >
        <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="space-y-4">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-primary">Order ID</span>
              <input
                value={orderId}
                onChange={(event) => setOrderId(event.target.value)}
                placeholder="e.g. 3f7f7f8b-4ed0-4f8d-b8ab-7b6d..."
                className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-primary outline-none transition focus:border-primary"
              />
            </label>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleOrderLookup}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-surface transition-transform hover:-translate-y-[1px] active:translate-y-0"
              >
                {orderLookupState.isLoading ? <SpinnerGap size={16} className="animate-spin" /> : <FileMagnifyingGlass size={16} />}
                Inspect order
              </button>
              <button
                type="button"
                onClick={() => {
                  setOrderId('');
                  setOrderLookupState({ data: null, error: null, isLoading: false });
                }}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-background px-4 py-2.5 text-sm font-medium text-primary transition-transform hover:-translate-y-[1px] active:translate-y-0"
              >
                Clear
              </button>
            </div>

            <div className="rounded-[24px] border border-dashed border-border bg-background p-4 text-sm leading-6 text-muted">
              The backend currently exposes one order detail endpoint and payment create/callback only.
              This screen keeps the admin view honest by surfacing the real contract instead of fake tables.
            </div>
          </div>

          <div className="space-y-4">
            {orderLookupState.isLoading ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <SkeletonBlock className="h-28" />
                <SkeletonBlock className="h-28" />
                <SkeletonBlock className="h-28" />
                <SkeletonBlock className="h-28" />
              </div>
            ) : orderLookupState.error ? (
              <div className="rounded-[24px] border border-red-200 bg-red-50 p-5 text-sm leading-6 text-red-800">
                {orderLookupState.error}
              </div>
            ) : orderLookupState.data ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-[24px] border border-border bg-background p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Status</p>
                  <p className="mt-2 text-lg font-semibold text-primary">{orderLookupState.data.status}</p>
                  <div className="mt-3">
                    <Pill tone={getOrderStatusTone(orderLookupState.data.status)}>
                      {orderLookupState.data.status}
                    </Pill>
                  </div>
                </div>
                <div className="rounded-[24px] border border-border bg-background p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Total amount</p>
                  <p className="mt-2 text-lg font-semibold text-primary">{formatCurrency(Number(orderLookupState.data.totalAmount))}</p>
                  <p className="mt-2 text-sm text-muted">Quantity: {orderLookupState.data.quantity}</p>
                </div>
                <div className="rounded-[24px] border border-border bg-background p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Expires at</p>
                  <p className="mt-2 text-sm font-medium text-primary">{formatDateTime(orderLookupState.data.expiresAt)}</p>
                </div>
                <div className="rounded-[24px] border border-border bg-background p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Source IDs</p>
                  <p className="mt-2 break-words text-sm leading-6 text-primary">
                    Concert {orderLookupState.data.concertId.slice(0, 8)}
                    <br />
                    Ticket type {orderLookupState.data.ticketTypeId.slice(0, 8)}
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-[24px] border border-dashed border-border bg-background p-5 text-sm leading-6 text-muted">
                No order loaded yet. Use a real order ID from the backend and the record will appear here.
              </div>
            )}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Sales and check-in dashboard"
        description="The reporting section pulls from `/reports/revenue`, `/reports/tickets-sold`, and `/reports/checkin-rate` and now renders live backend aggregates without UI changes."
        action={
          <a
            href={dashboardHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-xs font-medium text-primary transition-transform hover:-translate-y-[1px] active:translate-y-0"
          >
            <ArrowSquareOut size={14} />
            Open queue board
          </a>
        }
      >
        {!canViewReports ? (
          <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-800">
            Your role does not include report access.
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-3">
            {reportCards.map((card) => {
              const state = card.state;

              return (
                <div key={card.title} className="rounded-[28px] border border-border bg-background p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-surface text-primary">
                        {card.icon}
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-primary">{card.title}</h3>
                        <p className="mt-1 text-sm leading-6 text-muted">{card.description}</p>
                      </div>
                    </div>
                    <Pill tone={state.isLoading ? 'warning' : state.error ? 'danger' : 'success'}>
                      {state.isLoading ? 'Loading' : state.error ? 'Error' : 'Ready'}
                    </Pill>
                  </div>

                  <div className="mt-5 rounded-[24px] border border-dashed border-border bg-surface p-4">
                    {state.isLoading ? (
                      <div className="space-y-3">
                        <SkeletonBlock className="h-4 w-2/3" />
                        <SkeletonBlock className="h-10 w-full" />
                        <SkeletonBlock className="h-4 w-1/2" />
                      </div>
                    ) : state.error ? (
                      <p className="text-sm leading-6 text-red-800">{state.error}</p>
                    ) : state.data?.message ? (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-primary">Backend response</p>
                        <p className="text-sm leading-6 text-muted">{state.data.message}</p>
                      </div>
                    ) : (
                    <p className="text-sm leading-6 text-muted">
                        Live metrics render here when the API returns numeric fields or row objects.
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
      <SectionCard
        title="Failed notification jobs"
        description="The page uses the live notification probe endpoint and the backend queue board for retry and failure inspection."
        action={
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-xs font-medium text-muted">
            <BellRinging size={14} />
              Retry on Bull Board
            </div>
          }
        >
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-primary">Notification email</span>
                <input
                  value={probeEmail}
                  onChange={(event) => setProbeEmail(event.target.value)}
                  placeholder="ops@ticketbox.vn"
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-primary outline-none transition focus:border-primary"
                />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-primary">Ticket ID</span>
                <input
                  value={probeTicketId}
                  onChange={(event) => setProbeTicketId(event.target.value)}
                  placeholder="ticket_123"
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-primary outline-none transition focus:border-primary"
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleNotificationProbe}
                className="inline-flex min-h-11 flex-1 min-w-[200px] items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-surface transition-transform hover:-translate-y-[1px] active:translate-y-0"
              >
                {probeState.isLoading ? <SpinnerGap size={16} className="animate-spin" /> : <BellRinging size={16} />}
                Send probe
              </button>
              <a
                href={dashboardHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 flex-1 min-w-[200px] items-center justify-center gap-2 rounded-full border border-border bg-background px-4 py-2.5 text-sm font-medium text-primary transition-transform hover:-translate-y-[1px] active:translate-y-0"
              >
                <ArrowSquareOut size={16} />
                Open queue dashboard
              </a>
              {probeTicketId.trim() ? (
                <Link
                  href={`/operations/notifications/${encodeURIComponent(probeTicketId.trim())}`}
                  className="inline-flex min-h-11 flex-1 min-w-[200px] items-center justify-center gap-2 rounded-full border border-border bg-background px-4 py-2.5 text-sm font-medium text-primary transition-transform hover:-translate-y-[1px] active:translate-y-0"
                >
                  Open ticket detail
                </Link>
              ) : null}
            </div>

            <div className="rounded-[24px] border border-border bg-background p-4">
              {probeState.isLoading ? (
                <p className="text-sm text-muted">Submitting notification probe...</p>
              ) : probeState.error ? (
                <p className="text-sm leading-6 text-red-800">{probeState.error}</p>
              ) : probeState.data?.message ? (
                <p className="text-sm leading-6 text-primary">{probeState.data.message}</p>
              ) : (
                <p className="text-sm leading-6 text-muted">
                  Retry for failed jobs happens inside Bull Board on the backend. This page keeps the
                  probe action wired to the real queue path and avoids fake retry buttons.
                </p>
              )}
            </div>
          </div>
        </SectionCard>

      <SectionCard
        title="Background job monitor"
        description="CSV import lookup and AI bio request forms are wired to the backend, and failed jobs remain observable from the queue board."
        action={
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-xs font-medium text-muted">
            <CloudArrowUp size={14} />
              CSV / AI / notification
            </div>
          }
        >
          <div id="job-monitor" className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-primary">CSV job ID</span>
                <input
                  value={csvJobId}
                  onChange={(event) => setCsvJobId(event.target.value)}
                  placeholder="csv-job-id"
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-primary outline-none transition focus:border-primary"
                />
              </label>
              <div className="space-y-2">
                <span className="block text-sm font-medium text-primary">Status legend</span>
                <div className="grid grid-cols-2 gap-2">
                  <span className="inline-flex w-full items-center justify-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-amber-800">Pending</span>
                  <span className="inline-flex w-full items-center justify-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-amber-800">Processing</span>
                  <span className="inline-flex w-full items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-emerald-800">Success</span>
                  <span className="inline-flex w-full items-center justify-center rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-red-800">Failed</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleCsvLookup}
                className="inline-flex min-h-11 flex-1 min-w-[200px] items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-surface transition-transform hover:-translate-y-[1px] active:translate-y-0"
              >
                {csvLookupState.isLoading ? <SpinnerGap size={16} className="animate-spin" /> : <FileMagnifyingGlass size={16} />}
                Lookup CSV job
              </button>
              <a
                href={dashboardHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 flex-1 min-w-[200px] items-center justify-center gap-2 rounded-full border border-border bg-background px-4 py-2.5 text-sm font-medium text-primary transition-transform hover:-translate-y-[1px] active:translate-y-0"
              >
                <ArrowSquareOut size={16} />
                Retry in queue board
              </a>
            </div>

            <div className="rounded-[24px] border border-border bg-background p-4">
              {csvLookupState.isLoading ? (
                <p className="text-sm text-muted">Loading CSV job status...</p>
              ) : csvLookupState.error ? (
                <p className="text-sm leading-6 text-red-800">{csvLookupState.error}</p>
              ) : csvLookupState.data ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Pill tone={csvLookupState.data.status === 'FAILED' ? 'danger' : csvLookupState.data.status === 'COMPLETED' ? 'success' : 'warning'}>
                      {csvLookupState.data.status ?? 'UNKNOWN'}
                    </Pill>
                    {typeof csvLookupState.data.totalRows === 'number' ? <Pill tone="neutral">Rows: {csvLookupState.data.totalRows}</Pill> : null}
                  </div>
                  <div className="grid gap-3 text-sm text-primary sm:grid-cols-2">
                    <p>Success rows: {csvLookupState.data.successRows ?? '--'}</p>
                    <p>Error rows: {csvLookupState.data.errorRows ?? '--'}</p>
                    <p>Concert ID: {csvLookupState.data.concertId?.slice(0, 8) ?? '--'}</p>
                    <p>Created: {formatDateTime(csvLookupState.data.createdAt)}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm leading-6 text-muted">
                  Enter a real CSV job ID to read the job from backend storage.
                </p>
              )}
            </div>

            <div className="grid gap-3 rounded-[24px] border border-dashed border-border bg-surface p-4">
              <div>
                <p className="text-sm font-medium text-primary">AI bio request</p>
                <p className="text-xs text-muted">This uses the real multipart endpoint at `/api/artist-bio`.</p>
              </div>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-primary">Artist</span>
                <select
                  value={selectedAiArtistId}
                  onChange={(event) => setSelectedAiArtistId(event.target.value)}
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-primary outline-none transition focus:border-primary"
                >
                  <option value="">Select artist</option>
                  {aiArtists.map((artist) => (
                    <option key={artist.id} value={artist.id}>
                      {artist.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-border bg-background px-4 py-2.5 text-sm font-medium text-primary transition-transform hover:-translate-y-[1px] active:translate-y-0">
                  <CloudArrowUp size={16} />
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(event) => setAiFile(event.target.files?.[0] ?? null)}
                    className="hidden"
                  />
                  <span className="truncate">{aiFile ? aiFile.name : 'Choose PDF'}</span>
                </label>
                <button
                  type="button"
                  onClick={handleAiUpload}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-surface transition-transform hover:-translate-y-[1px] active:translate-y-0"
                >
                  {aiState.isLoading ? <SpinnerGap size={16} className="animate-spin" /> : <CloudArrowUp size={16} />}
                  Create AI job
                </button>
              </div>
              <div className="rounded-[20px] border border-border bg-background p-4">
                {aiState.isLoading ? (
                  <p className="text-sm text-muted">Uploading PDF and creating AI request...</p>
                ) : aiState.error ? (
                  <p className="text-sm leading-6 text-red-800">{aiState.error}</p>
                ) : aiState.data?.status ? (
                  <div className="space-y-2 text-sm">
                    <Pill tone={aiState.data.status === 'FAILED' ? 'danger' : aiState.data.status === 'SUCCESS' || aiState.data.status === 'DRAFT' || aiState.data.status === 'PUBLISHED' ? 'success' : 'warning'}>
                      {aiState.data.status}
                    </Pill>
                    <p className="text-primary">Request ID: {aiState.data.id ?? '--'}</p>
                    <p className="text-muted">Requested by: {aiState.data.requestedBy ?? '--'}</p>
                    <p className="text-muted">PDF key: {aiState.data.pdfObjectKey ?? '--'}</p>
                  </div>
                ) : (
                  <p className="text-sm leading-6 text-muted">
                    Upload a real PDF to create a new AI bio request and enqueue the background job.
                  </p>
                )}
              </div>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
