'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowSquareOut, CloudArrowUp, FileMagnifyingGlass, SpinnerGap, ArrowClockwise } from '@phosphor-icons/react';
import { Permission } from '@/lib/permissions';
import { useAuthStore } from '@/lib/auth-store';
import { artistService } from '@/lib/services/artist.service';
import { operationsService, type AiBioRequestResult, type CsvImportJobStatus, type NotificationJobRecord } from '@/lib/services/operations.service';
import type { Artist } from '@/lib/types';

const queueDashboardHref = (() => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
  return apiUrl.replace(/\/api\/v1\/?$/, '') + '/admin/queues';
})();

type MonitorFilter = 'all' | 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED';

function formatDateTime(value?: string | number) {
  if (!value) return '--';
  const date = typeof value === 'number' ? new Date(value) : new Date(value);
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function statusTone(status?: string) {
  switch (status) {
    case 'SUCCESS':
      return 'border-emerald-200 bg-emerald-50 text-emerald-800';
    case 'FAILED':
      return 'border-red-200 bg-red-50 text-red-800';
    case 'PROCESSING':
      return 'border-amber-200 bg-amber-50 text-amber-800';
    case 'PENDING':
      return 'border-sky-200 bg-sky-50 text-sky-800';
    default:
      return 'border-border bg-background text-muted';
  }
}

function normalizeCsvStatus(status?: CsvImportJobStatus['status']) {
  switch (status) {
    case 'PENDING':
      return 'PENDING';
    case 'PROCESSING':
      return 'PROCESSING';
    case 'FAILED':
      return 'FAILED';
    case 'PARTIALLY_COMPLETED':
    case 'COMPLETED':
      return 'SUCCESS';
    default:
      return 'PENDING';
  }
}

function normalizeAiStatus(status?: AiBioRequestResult['status']) {
  switch (status) {
    case 'PENDING':
      return 'PENDING';
    case 'PROCESSING':
      return 'PROCESSING';
    case 'SUCCESS':
    case 'DRAFT':
    case 'PUBLISHED':
      return 'SUCCESS';
    case 'FAILED':
      return 'FAILED';
    default:
      return 'PENDING';
  }
}

function NotificationRowStatus({ item }: Readonly<{ item: NotificationJobRecord }>) {
  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ${statusTone(item.status)}`}>
      {item.status ?? 'UNKNOWN'}
    </span>
  );
}

export default function JobsPage() {
  const permissions = useAuthStore((state) => state.permissions);
  const canViewJobs = permissions.includes(Permission.VIP_IMPORT) || permissions.includes(Permission.AI_GENERATE_BIO) || permissions.includes(Permission.REPORT_VIEW) || permissions.includes(Permission.RBAC_MANAGE);
  const canRetryCsv = permissions.includes(Permission.VIP_IMPORT);
  const canRetryAi = permissions.includes(Permission.AI_GENERATE_BIO);
  const canRetryNotifications = permissions.includes(Permission.RBAC_MANAGE);

  const [csvJobs, setCsvJobs] = useState<CsvImportJobStatus[]>([]);
  const [aiJobs, setAiJobs] = useState<AiBioRequestResult[]>([]);
  const [notificationJobs, setNotificationJobs] = useState<NotificationJobRecord[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [selectedArtistId, setSelectedArtistId] = useState('');
  const [csvFilter, setCsvFilter] = useState<MonitorFilter>('all');
  const [aiFilter, setAiFilter] = useState<MonitorFilter>('all');
  const [notificationFilter, setNotificationFilter] = useState<MonitorFilter>('FAILED');
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [csvLookupId, setCsvLookupId] = useState('');
  const [csvLookupResult, setCsvLookupResult] = useState<CsvImportJobStatus | null>(null);
  const [csvLookupError, setCsvLookupError] = useState<string | null>(null);
  const [csvLookupLoading, setCsvLookupLoading] = useState(false);

  const loadAllJobs = async () => {
    setPageLoading(true);
    setPageError(null);

    try {
      const [nextCsvJobs, nextAiJobs, nextNotificationJobs] = await Promise.all([
        operationsService.listCsvImportJobs(),
        operationsService.listAiBioJobs(),
        operationsService.getNotificationJobs(),
      ]);

      setCsvJobs(nextCsvJobs);
      setAiJobs(nextAiJobs);
      setNotificationJobs(nextNotificationJobs);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Unable to load job monitors.');
    } finally {
      setPageLoading(false);
    }

    try {
      const nextArtists = await artistService.getArtists();
      setArtists(nextArtists);
      setSelectedArtistId((current) => current || nextArtists[0]?.id || '');
    } catch {
      setArtists([]);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load initial jobs and artists when the page mounts
    void loadAllJobs();
  }, []);

  const filteredCsvJobs = useMemo(
    () => csvJobs.filter((job) => csvFilter === 'all' || normalizeCsvStatus(job.status) === csvFilter),
    [csvFilter, csvJobs],
  );

  const filteredAiJobs = useMemo(
    () => aiJobs.filter((job) => aiFilter === 'all' || normalizeAiStatus(job.status) === aiFilter),
    [aiFilter, aiJobs],
  );

  const filteredNotificationJobs = useMemo(
    () => notificationJobs.filter((job) => notificationFilter === 'all' || (job.status ?? 'PENDING') === notificationFilter),
    [notificationFilter, notificationJobs],
  );

  const handleCreateAiRequest = async () => {
    if (!pdfFile) {
      setCreateError('Please choose a PDF file.');
      return;
    }
    if (!selectedArtistId) {
      setCreateError('Please choose an artist.');
      return;
    }

    setCreateLoading(true);
    setCreateError(null);
    setCreateMessage(null);

    try {
      const result = await operationsService.createAiBioRequest(pdfFile, selectedArtistId);
      setCreateMessage(result.status ? `AI bio request created: ${result.status}` : 'AI bio request created.');
      await loadAllJobs();
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Unable to create AI bio request.');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleCsvLookup = async () => {
    if (!csvLookupId.trim()) {
      setCsvLookupError('Please enter a CSV job ID.');
      return;
    }

    setCsvLookupLoading(true);
    setCsvLookupError(null);
    setCsvLookupResult(null);

    try {
      const result = await operationsService.getCsvImportStatus(csvLookupId.trim());
      setCsvLookupResult(result);
    } catch (error) {
      setCsvLookupError(error instanceof Error ? error.message : 'Unable to load CSV job status.');
    } finally {
      setCsvLookupLoading(false);
    }
  };

  const handleRetry = async (kind: 'csv' | 'ai' | 'notification', jobId: string) => {
    setRetrying(`${kind}:${jobId}`);
    setPageError(null);

    try {
      if (kind === 'csv') {
        await operationsService.retryCsvImportJob(jobId);
      } else if (kind === 'ai') {
        await operationsService.retryAiBioJob(jobId);
      } else {
        await operationsService.retryNotificationJob(jobId);
      }
      await loadAllJobs();
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Unable to retry job.');
    } finally {
      setRetrying(null);
    }
  };

  if (!canViewJobs) {
    return (
      <div className="rounded-[32px] border border-border bg-surface p-6 text-sm text-muted shadow-sm">
        You do not have access to job monitoring.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="min-w-0 space-y-6">
        <div className="rounded-[32px] border border-border bg-surface p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl space-y-3">
              <Link href="/operations" className="inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-primary">
                <ArrowLeft size={16} />
                Back to operations hub
              </Link>
              <div>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-primary">Background job monitor</h1>
                <p className="mt-3 text-sm leading-6 text-muted">
                  CSV, AI bio, and notification jobs are now visible from the backend APIs, with retry buttons for jobs that are actually failed.
                </p>
              </div>
            </div>
            <a href={queueDashboardHref} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-surface">
              <ArrowSquareOut size={16} />
              Open queue board
            </a>
          </div>
        </div>

        {pageError ? (
          <div className="rounded-[28px] border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {pageError}
          </div>
        ) : null}

        <section className="rounded-[28px] border border-border bg-surface p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-border bg-background p-3 text-primary">
              <CloudArrowUp size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-primary">Create AI job</h2>
              <p className="text-sm text-muted">Creates a real multipart request to `/api/artist-bio`.</p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <div className="grid gap-3 md:grid-cols-2 md:items-end">
              <label className="block space-y-2 md:col-span-2">
                <span className="text-sm font-medium text-primary">Artist</span>
                <select
                  value={selectedArtistId}
                  onChange={(event) => setSelectedArtistId(event.target.value)}
                  className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm text-primary outline-none focus:border-primary"
                >
                  <option value="">Select artist</option>
                  {artists.map((artist) => (
                    <option key={artist.id} value={artist.id}>
                      {artist.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 text-sm font-medium text-primary">
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(event) => setPdfFile(event.target.files?.[0] ?? null)}
                  className="hidden"
                />
                <span className="truncate">{pdfFile ? pdfFile.name : 'Choose PDF'}</span>
              </label>
              <button
                type="button"
                onClick={handleCreateAiRequest}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-sm font-medium text-surface"
              >
                {createLoading ? <SpinnerGap size={16} className="animate-spin" /> : <CloudArrowUp size={16} />}
                Create AI job
              </button>
            </div>
            {createMessage ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{createMessage}</div> : null}
            {createError ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{createError}</div> : null}
          </div>
        </section>

        <section className="rounded-[28px] border border-border bg-surface p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-border bg-background p-3 text-primary">
              <FileMagnifyingGlass size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-primary">CSV status lookup</h2>
              <p className="text-sm text-muted">Reads `/imports/:jobId/status` from the backend.</p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-primary">Job ID</span>
              <input
                value={csvLookupId}
                onChange={(event) => setCsvLookupId(event.target.value)}
                placeholder="csv-job-id"
                className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-primary outline-none focus:border-primary"
              />
            </label>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleCsvLookup}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-surface"
              >
                {csvLookupLoading ? <SpinnerGap size={16} className="animate-spin" /> : <FileMagnifyingGlass size={16} />}
                Lookup status
              </button>
              <button
                type="button"
                onClick={() => setCsvLookupResult(null)}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-background px-4 py-2.5 text-sm font-medium text-primary"
              >
                Clear
              </button>
            </div>
            {csvLookupResult ? (
              <div className="rounded-2xl border border-border bg-background p-4 text-sm leading-6 text-muted">
                <p>Status: {csvLookupResult.status ?? '--'}</p>
                <p className="mt-1">Rows: {csvLookupResult.totalRows ?? 0} total, {csvLookupResult.successRows ?? 0} success, {csvLookupResult.errorRows ?? 0} error</p>
                <p className="mt-1">Object key: {csvLookupResult.objectKey ?? '--'}</p>
              </div>
            ) : null}
            {csvLookupError ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{csvLookupError}</div> : null}
          </div>
        </section>

        <section className="rounded-[28px] border border-border bg-surface p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-primary">CSV imports</h2>
              <p className="mt-2 text-sm leading-6 text-muted">Monitor backend CSV jobs, inspect status, and retry failed imports with permission.</p>
            </div>
            <label className="block min-w-[220px] space-y-2">
              <span className="text-sm font-medium text-primary">Filter</span>
              <select
                value={csvFilter}
                onChange={(event) => setCsvFilter(event.target.value as MonitorFilter)}
                className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm text-primary outline-none focus:border-primary"
              >
                {(['all', 'PENDING', 'PROCESSING', 'SUCCESS', 'FAILED'] as const).map((status) => (
                  <option key={status} value={status}>
                    {status === 'all' ? 'All statuses' : status}
                  </option>
                ))}
              </select>
            </label>
          </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-background">
          <div className="overflow-x-auto">
            <table className="min-w-full whitespace-nowrap text-left text-sm">
              <thead className="bg-surface/80 text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Job</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Rows</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pageLoading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted">
                      <div className="inline-flex items-center gap-2">
                        <SpinnerGap size={16} className="animate-spin" />
                        Loading jobs...
                      </div>
                    </td>
                  </tr>
                ) : filteredCsvJobs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted">
                      No CSV jobs found for the selected status.
                    </td>
                  </tr>
                ) : (
                  filteredCsvJobs.map((job) => {
                    const normalizedStatus = normalizeCsvStatus(job.status);
                    const retryable = job.status === 'FAILED' || job.status === 'PARTIALLY_COMPLETED';
                    return (
                      <tr key={String(job.id)}>
                        <td className="px-4 py-3 font-medium text-primary">{job.id ?? '--'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ${statusTone(normalizedStatus)}`}>
                            {normalizedStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted">
                          {job.totalRows ?? 0} / {job.successRows ?? 0} / {job.errorRows ?? 0}
                        </td>
                        <td className="px-4 py-3 text-muted">{formatDateTime(job.createdAt)}</td>
                        <td className="px-4 py-3">
                          {retryable && canRetryCsv ? (
                            <button
                              type="button"
                              onClick={() => handleRetry('csv', String(job.id))}
                              disabled={retrying === `csv:${String(job.id)}`}
                              className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-xs font-medium text-primary disabled:opacity-60"
                            >
                              {retrying === `csv:${String(job.id)}` ? <SpinnerGap size={14} className="animate-spin" /> : <ArrowClockwise size={14} />}
                              Retry
                            </button>
                          ) : (
                            <span className="text-xs text-muted">{canRetryCsv ? 'No action' : 'Retry locked'}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
        </section>

        <section className="rounded-[28px] border border-border bg-surface p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-primary">AI bio jobs</h2>
              <p className="mt-2 text-sm leading-6 text-muted">Monitor PDF-to-bio requests from the backend and retry failed draft generation.</p>
            </div>
            <label className="block min-w-[220px] space-y-2">
              <span className="text-sm font-medium text-primary">Filter</span>
              <select
                value={aiFilter}
                onChange={(event) => setAiFilter(event.target.value as MonitorFilter)}
                className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm text-primary outline-none focus:border-primary"
              >
                {(['all', 'PENDING', 'PROCESSING', 'SUCCESS', 'FAILED'] as const).map((status) => (
                  <option key={status} value={status}>
                    {status === 'all' ? 'All statuses' : status}
                  </option>
                ))}
              </select>
            </label>
          </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-background">
          <div className="overflow-x-auto">
            <table className="min-w-full whitespace-nowrap text-left text-sm">
              <thead className="bg-surface/80 text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Job</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Artist</th>
                  <th className="px-4 py-3 font-medium">Draft</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pageLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted">
                      <div className="inline-flex items-center gap-2">
                        <SpinnerGap size={16} className="animate-spin" />
                        Loading jobs...
                      </div>
                    </td>
                  </tr>
                ) : filteredAiJobs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted">
                      No AI jobs found for the selected status.
                    </td>
                  </tr>
                ) : (
                  filteredAiJobs.map((job) => {
                    const normalizedStatus = normalizeAiStatus(job.status);
                    const retryable = job.status === 'FAILED';
                    return (
                      <tr key={String(job.id)}>
                        <td className="px-4 py-3 font-medium text-primary">{job.id ?? '--'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ${statusTone(normalizedStatus)}`}>
                            {normalizedStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted">{job.artistId ?? '--'}</td>
                        <td className="px-4 py-3 text-muted">
                          <div className="max-w-[360px] whitespace-normal leading-6">
                            {job.draftContent?.trim()
                              ? job.draftContent.slice(0, 140)
                              : 'No draft content returned yet.'}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted">{formatDateTime(job.createdAt)}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            {job.id ? (
                              <Link
                                href={`/operations/jobs/ai/${job.id}`}
                                className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-xs font-medium text-primary"
                              >
                                Review draft
                              </Link>
                            ) : null}
                            {job.artistId ? (
                              <Link
                                href={`/artists/${job.artistId}/edit`}
                                className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-xs font-medium text-primary"
                              >
                                Review & publish
                              </Link>
                            ) : null}
                            {retryable && canRetryAi ? (
                              <button
                                type="button"
                                onClick={() => handleRetry('ai', String(job.id))}
                                disabled={retrying === `ai:${String(job.id)}`}
                                className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-xs font-medium text-primary disabled:opacity-60"
                              >
                                {retrying === `ai:${String(job.id)}` ? <SpinnerGap size={14} className="animate-spin" /> : <ArrowClockwise size={14} />}
                                Retry
                              </button>
                            ) : (
                              <span className="text-xs text-muted">{canRetryAi ? 'No action' : 'Retry locked'}</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
        </section>

        <section className="rounded-[28px] border border-border bg-surface p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-primary">Notification jobs</h2>
              <p className="mt-2 text-sm leading-6 text-muted">Failed delivery jobs are visible here with reasons and retry buttons for admins.</p>
            </div>
            <label className="block min-w-[220px] space-y-2">
              <span className="text-sm font-medium text-primary">Filter</span>
              <select
                value={notificationFilter}
                onChange={(event) => setNotificationFilter(event.target.value as MonitorFilter)}
                className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm text-primary outline-none focus:border-primary"
              >
                {(['FAILED', 'PENDING', 'PROCESSING', 'SUCCESS', 'all'] as const).map((status) => (
                  <option key={status} value={status}>
                    {status === 'all' ? 'All statuses' : status}
                  </option>
                ))}
              </select>
            </label>
          </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-background">
          <div className="overflow-x-auto">
            <table className="min-w-full whitespace-nowrap text-left text-sm">
              <thead className="bg-surface/80 text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Job</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Reason</th>
                  <th className="px-4 py-3 font-medium">Attempts</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pageLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted">
                      <div className="inline-flex items-center gap-2">
                        <SpinnerGap size={16} className="animate-spin" />
                        Loading jobs...
                      </div>
                    </td>
                  </tr>
                ) : filteredNotificationJobs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted">
                      No notification jobs found for the selected status.
                    </td>
                  </tr>
                ) : (
                  filteredNotificationJobs.map((job) => {
                    const retryable = job.status === 'FAILED';
                    return (
                      <tr key={String(job.id)}>
                        <td className="px-4 py-3 font-medium text-primary">{job.name ?? String(job.id)}</td>
                        <td className="px-4 py-3">
                          <NotificationRowStatus item={job} />
                        </td>
                        <td className="px-4 py-3 text-muted">{job.failedReason ?? '--'}</td>
                        <td className="px-4 py-3 text-muted">{job.attemptsMade ?? 0}</td>
                        <td className="px-4 py-3 text-muted">{formatDateTime(job.timestamp)}</td>
                        <td className="px-4 py-3">
                          {retryable && canRetryNotifications ? (
                            <button
                              type="button"
                              onClick={() => handleRetry('notification', String(job.id))}
                              disabled={retrying === `notification:${String(job.id)}`}
                              className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-xs font-medium text-primary disabled:opacity-60"
                            >
                              {retrying === `notification:${String(job.id)}` ? <SpinnerGap size={14} className="animate-spin" /> : <ArrowClockwise size={14} />}
                              Retry
                            </button>
                          ) : (
                            <span className="text-xs text-muted">{canRetryNotifications ? 'No action' : 'Retry locked'}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        </section>
      </div>
    </div>
  );
}
