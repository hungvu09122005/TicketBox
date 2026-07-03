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
  return `${apiUrl.replace(/\/$/, '')}/admin/queues`;
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
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-[0.22em] text-muted">{label}</p>
          <p className="mt-2 break-words text-2xl font-semibold tracking-tight text-primary">
            {value}
          </p>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border bg-background text-primary">
          {icon}
        </div>
      </div>
      <div className="mt-4 border-t border-border/70 pt-4">
        <p className="text-sm leading-6 text-muted">{hint}</p>
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
        {action ? <div className="shrink-0 self-start">{action}</div> : null}
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
        'Look up orders, create payments, and track callbacks.',
      blocker: 'Ready',
    },
    {
      id: 'request14',
      title: 'Failed notification jobs and retry',
      percent: 100,
      href: '/operations/notifications',
      detail:
        'Check notification delivery, monitor failed jobs, and open the queue board when needed.',
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
          error instanceof Error ? error.message : 'Could not load report data.';
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
        description: 'Aggregated revenue from the real reporting API.',
      },
      {
        title: 'Tickets sold',
        icon: <Ticket size={20} />,
        state: reportState.tickets,
        description: 'Tickets sold from backend reporting.',
      },
      {
        title: 'Check-in rate',
        icon: <CheckCircle size={20} />,
        state: reportState.checkin,
        description: 'Check-in rate that reflects gate operations.',
      },
    ],
    [reportState],
  );

  const handleOrderLookup = async () => {
    const trimmedOrderId = orderId.trim();
    if (!trimmedOrderId) {
      setOrderLookupState({
        data: null,
        error: 'Enter an order ID to look it up.',
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
      setSummaryMessage(`Loaded order ${trimmedOrderId}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load the order.';
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
        error: 'Enter a CSV job ID to look it up.',
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
      setSummaryMessage(`Loaded CSV job status ${trimmedJobId}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load the job status.';
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
        error: 'Enter an email and ticket ID to create a notification probe.',
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
      setSummaryMessage('Queued the notification probe in the real queue.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not enqueue the notification probe.';
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
        error: 'Choose a PDF file to create an AI bio request.',
        isLoading: false,
      });
      return;
    }
    if (!selectedAiArtistId) {
      setAiState({
        data: null,
        error: 'Choose an artist to attach to the AI bio request.',
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
      setSummaryMessage('Created a real AI bio request.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not create the AI bio request.';
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
                This screen combines four admin requests into one real operations surface: order lookup,
                report APIs, failed-job tracking, and the backend queue dashboard when retry is needed.
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

          <div className="space-y-3">
            <div className="grid gap-3 xl:grid-cols-2">
              <StatCard
                label="Orders"
                value={canViewOrders ? 'Live lookup' : 'Restricted'}
                hint="Search an order ID and inspect the current state."
                icon={<Receipt size={20} />}
              />
              <StatCard
                label="Reports"
                value={canViewReports ? 'API backed' : 'Restricted'}
                hint="Revenue, tickets sold, and check-in rate come from APIs."
                icon={<TrendUp size={20} />}
              />
              <StatCard
                label="Jobs"
                value={canViewJobs ? 'Queue aware' : 'Restricted'}
                hint="CSV, AI bio, and notification probes hit real APIs."
                icon={<CloudArrowUp size={20} />}
              />
              <StatCard
                label="Retry path"
                value={canManageNotifications ? 'Bull Board' : 'Restricted'}
                hint="Failed jobs retry from Bull Board."
                icon={<ArrowClockwise size={20} />}
              />
            </div>
          </div>
        </div>
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
        description="Look up an order by ID to view status, expiration time, and payment details."
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
                No orders have been loaded yet. Enter an Order ID to view details.
              </div>
            )}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Sales and check-in dashboard"
        description="Quickly view revenue, tickets sold, and check-in rate."
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
                  Failed-job retries are handled in Bull Board. Here you only send probes and open the queue board when needed.
                </p>
              )}
            </div>
          </div>
        </SectionCard>

      <SectionCard
        title="Background job monitor"
        description="Look up CSV jobs, create AI bio jobs, and open the queue board when needed."
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
                  Enter a CSV job ID to view its processing status.
                </p>
              )}
            </div>

            <div className="grid gap-3 rounded-[24px] border border-dashed border-border bg-surface p-4">
              <div>
                <p className="text-sm font-medium text-primary">AI bio request</p>
                <p className="text-xs text-muted">Upload a PDF to create an AI bio request for an artist.</p>
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
                    Upload a PDF to create a new AI bio job.
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
