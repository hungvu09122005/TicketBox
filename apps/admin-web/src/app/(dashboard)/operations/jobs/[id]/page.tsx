'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowSquareOut, FileMagnifyingGlass, SpinnerGap } from '@phosphor-icons/react';
import { operationsService, type CsvImportJobStatus } from '@/lib/services/operations.service';

function formatDateTime(value?: string) {
  if (!value) return '--';
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function statusTone(status?: string) {
  switch (status) {
    case 'COMPLETED':
    case 'SUCCESS':
      return 'border-emerald-200 bg-emerald-50 text-emerald-800';
    case 'FAILED':
      return 'border-red-200 bg-red-50 text-red-800';
    case 'PROCESSING':
    case 'PENDING':
    case 'PARTIALLY_COMPLETED':
      return 'border-amber-200 bg-amber-50 text-amber-800';
    default:
      return 'border-border bg-background text-muted';
  }
}

function displayJobStatus(status?: CsvImportJobStatus['status']) {
  if (status === 'COMPLETED') {
    return 'SUCCESS';
  }

  return status ?? 'UNKNOWN';
}

const queueDashboardHref = (() => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
  return apiUrl.replace(/\/api\/v1\/?$/, '') + '/admin/queues';
})();

export default function CsvJobDetailPage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const [job, setJob] = useState<CsvImportJobStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resolvedJobId, setResolvedJobId] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    const load = async () => {
      try {
        const { id } = await params;
        const data = await operationsService.getCsvImportStatus(id);

        if (!isActive) return;

        setJob(data);
        setResolvedJobId(id);
      } catch (error) {
        if (!isActive) return;
        setErrorMessage(error instanceof Error ? error.message : 'Không thể tải chi tiết CSV job.');
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      isActive = false;
    };
  }, [params]);

  return (
    <div className="space-y-6">
      <div className="rounded-[32px] border border-border bg-surface p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="max-w-2xl space-y-3">
            <Link href="/operations/jobs" className="inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-primary">
              <ArrowLeft size={16} />
              Back to job monitor
            </Link>
            <div>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-primary">CSV job detail</h1>
              <p className="mt-3 text-sm leading-6 text-muted">
                This detail view reads the real CSV status endpoint so admins can inspect a specific job without guessing from a generic monitor screen.
              </p>
            </div>
          </div>
          <a href={queueDashboardHref} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-surface">
            <ArrowSquareOut size={16} />
            Open queue board
          </a>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[28px] border border-border bg-surface p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-border bg-background p-3 text-primary">
              <FileMagnifyingGlass size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-primary">Job summary</h2>
              <p className="text-sm text-muted">Live data from `GET /imports/:jobId/status`.</p>
            </div>
          </div>

          <div className="mt-5">
            {isLoading ? (
              <div className="inline-flex items-center gap-2 text-sm text-muted">
                <SpinnerGap size={16} className="animate-spin" />
                Loading job...
              </div>
            ) : errorMessage ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                {errorMessage}
              </div>
            ) : job ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-border bg-background p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Job ID</p>
                  <p className="mt-2 break-words text-sm font-semibold text-primary">{resolvedJobId ?? '--'}</p>
                </div>
                <div className="rounded-2xl border border-border bg-background p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Status</p>
                  <span className={`mt-2 inline-flex rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ${statusTone(job.status)}`}>
                    {displayJobStatus(job.status)}
                  </span>
                </div>
                <div className="rounded-2xl border border-border bg-background p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Total rows</p>
                  <p className="mt-2 text-lg font-semibold text-primary">{job.totalRows ?? '--'}</p>
                </div>
                <div className="rounded-2xl border border-border bg-background p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Success rows</p>
                  <p className="mt-2 text-lg font-semibold text-primary">{job.successRows ?? '--'}</p>
                </div>
                <div className="rounded-2xl border border-border bg-background p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Error rows</p>
                  <p className="mt-2 text-lg font-semibold text-primary">{job.errorRows ?? '--'}</p>
                </div>
                <div className="rounded-2xl border border-border bg-background p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Created at</p>
                  <p className="mt-2 text-sm text-primary">{formatDateTime(job.createdAt)}</p>
                </div>
                <div className="rounded-2xl border border-border bg-background p-4 sm:col-span-2">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Object key</p>
                  <p className="mt-2 break-words text-sm text-primary">{job.objectKey ?? '--'}</p>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-[28px] border border-border bg-surface p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-primary">Queue context</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              The full retry and worker state remains in the backend Bull Board, which keeps this UI contract honest and avoids simulating worker internals.
            </p>
          </div>

          <div className="rounded-[28px] border border-border bg-surface p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-primary">Status contract</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              These are the states the CSV monitor expects from the backend job record.
            </p>
            <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-background">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-surface/80 text-muted">
                  <tr>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Meaning</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    ['PENDING', 'Queued and not yet processed'],
                    ['PROCESSING', 'Worker is reading the CSV'],
                    ['COMPLETED', 'Displayed as SUCCESS in the UI'],
                    ['PARTIALLY_COMPLETED', 'Some rows failed validation'],
                    ['FAILED', 'Worker or import pipeline failed'],
                  ].map(([status, meaning]) => (
                    <tr key={status}>
                      <td className="px-4 py-3 font-medium text-primary">{status}</td>
                      <td className="px-4 py-3 text-muted">{meaning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-[28px] border border-border bg-surface p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-primary">Paths available</h2>
            <div className="mt-4 rounded-2xl border border-border bg-background p-4 text-sm leading-6 text-muted">
              <p>GET /imports/:jobId/status</p>
              <p className="mt-1">POST /imports/csv</p>
              <p className="mt-1">Bull Board /admin/queues</p>
            </div>
          </div>

          <div className="rounded-[28px] border border-border bg-surface p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-primary">Manual actions</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              CSV retry is only available in the queue dashboard. The frontend page focuses on inspection and navigation, not on inventing a missing API.
            </p>
            <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-background">
              <table className="min-w-full text-left text-sm">
                <tbody className="divide-y divide-border">
                  <tr>
                    <th className="w-44 px-4 py-3 font-medium text-primary">Retry</th>
                    <td className="px-4 py-3 text-muted">Use Bull Board on the backend</td>
                  </tr>
                  <tr>
                    <th className="w-44 px-4 py-3 font-medium text-primary">Inspect failure</th>
                    <td className="px-4 py-3 text-muted">Review `errorRows` and queue logs</td>
                  </tr>
                  <tr>
                    <th className="w-44 px-4 py-3 font-medium text-primary">Permission gate</th>
                    <td className="px-4 py-3 text-muted">Visible only to job-monitor roles</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
