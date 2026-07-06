'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import {
  ArrowClockwise,
  ArrowSquareOut,
  CheckCircle,
  CloudArrowUp,
  FileMagnifyingGlass,
  Receipt,
  Play,
  ShieldCheck,
  SpinnerGap,
} from '@phosphor-icons/react';
import { Permission } from '@/lib/permissions';
import { useAuthStore } from '@/lib/auth-store';
import { artistService } from '@/lib/services/artist.service';
import {
  operationsService,
  type AiBioRequestResult,
  type CsvImportJobStatus,
  type OrderDetails,
} from '@/lib/services/operations.service';
import type { Artist } from '@/lib/types';
import { useToast } from '@/components/ui/ToastProvider';

type FetchState<T> = {
  data: T | null;
  error: string | null;
  isLoading: boolean;
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
  const canViewJobs = permissions.includes(Permission.VIP_IMPORT) || permissions.includes(Permission.AI_GENERATE_BIO);
  const canViewOrders = permissions.includes(Permission.ORDER_READ_OWN) || permissions.includes(Permission.ORDER_READ_ALL);
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
  const [aiFile, setAiFile] = useState<File | null>(null);
  const [aiArtists, setAiArtists] = useState<Artist[]>([]);
  const [selectedAiArtistId, setSelectedAiArtistId] = useState('');
  const [aiState, setAiState] = useState<FetchState<AiBioRequestResult>>({
    data: null,
    error: null,
    isLoading: false,
  });
  const [summaryMessage, setSummaryMessage] = useState<string | null>(null);
  const { toast } = useToast();

  const dashboardHref = queueDashboardBaseUrl;

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

  const handleAiUpload = async () => {
    if (!aiFile) {
      const errMsg = 'Choose a PDF file to create an AI bio request.';
      setAiState({
        data: null,
        error: errMsg,
        isLoading: false,
      });
      toast.error(errMsg);
      return;
    }
    if (!selectedAiArtistId) {
      const errMsg = 'Choose an artist to attach to the AI bio request.';
      setAiState({
        data: null,
        error: errMsg,
        isLoading: false,
      });
      toast.error(errMsg);
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
      const msg = 'Created a real AI bio request.';
      setSummaryMessage(msg);
      toast.success(msg);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not create the AI bio request.';
      setAiState({
        data: null,
        error: message,
        isLoading: false,
      });
      toast.error(message);
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
                value={permissions.includes(Permission.REPORT_VIEW) ? 'Available' : 'Restricted'}
                hint="Detailed report pages remain available from the operations menu."
                icon={<CheckCircle size={20} />}
              />
              <StatCard
                label="Jobs"
                value={canViewJobs ? 'Queue aware' : 'Restricted'}
                hint="CSV, AI bio, and notification probes run from the job monitor."
                icon={<CloudArrowUp size={20} />}
              />
              <StatCard
                label="Retry path"
                value="Bull Board"
                hint="Live queue board is available directly in Operations."
                icon={<ArrowClockwise size={20} />}
              />
            </div>
          </div>
        </div>
      </section>

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

      <div className="space-y-6">
        <SectionCard
          title="Live queue board"
          description="Embedded Bull Board view for live queue inspection without leaving the operations console."
          action={
            <a
              href={dashboardHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-xs font-medium text-primary transition-transform hover:-translate-y-[1px] active:translate-y-0"
            >
              <ArrowSquareOut size={14} />
              Open full screen
            </a>
          }
        >
          <div className="overflow-hidden rounded-[24px] border border-border bg-background">
            <iframe
              title="Bull Board queue dashboard"
              src={dashboardHref}
              className="h-[640px] w-full"
            />
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
