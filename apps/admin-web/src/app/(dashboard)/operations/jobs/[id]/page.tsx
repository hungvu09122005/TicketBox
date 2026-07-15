'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowSquareOut, DownloadSimple, FileMagnifyingGlass, SpinnerGap } from '@phosphor-icons/react';
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
  return `${apiUrl.replace(/\/$/, '')}/admin/queues`;
})();

export default function CsvJobDetailPage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const [job, setJob] = useState<CsvImportJobStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resolvedJobId, setResolvedJobId] = useState<string | null>(null);
  const [isDownloadingReport, setIsDownloadingReport] = useState(false);

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
        setErrorMessage(error instanceof Error ? error.message : 'Could not load the CSV job details.');
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

  const handleDownloadErrorReport = async () => {
    if (!resolvedJobId) {
      return;
    }

    setIsDownloadingReport(true);

    try {
      const report = await operationsService.downloadCsvErrorReport(resolvedJobId);
      const csv = report.csv ?? 'rowNumber,status,errorReason\n';
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = report.filename ?? `csv-error-report-${resolvedJobId}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not load the error report.');
    } finally {
      setIsDownloadingReport(false);
    }
  };

  const failureReason =
    typeof job?.failureReason === 'string'
      ? job.failureReason
      : job?.failureReason
        ? JSON.stringify(job.failureReason)
        : null;

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
                View a CSV job in detail, including processing status and error file if available.
              </p>
            </div>
          </div>
          <a href={queueDashboardHref} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-surface">
            <ArrowSquareOut size={16} />
            Open queue board
          </a>
          <button
            type="button"
            onClick={() => void handleDownloadErrorReport()}
            disabled={!resolvedJobId || isDownloadingReport}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-background px-4 py-2.5 text-sm font-medium text-primary disabled:opacity-60"
          >
            {isDownloadingReport ? <SpinnerGap size={16} className="animate-spin" /> : <DownloadSimple size={16} />}
            Download error report
          </button>
        </div>
      </div>

      <section className="rounded-[28px] border border-border bg-surface p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-border bg-background p-3 text-primary">
              <FileMagnifyingGlass size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-primary">Job summary</h2>
              <p className="text-sm text-muted">Current information for the selected job.</p>
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
                {failureReason ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 p-4 sm:col-span-2">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-red-700">Failure reason</p>
                    <p className="mt-2 break-words text-sm text-red-800">{failureReason}</p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
      </section>
    </div>
  );
}
