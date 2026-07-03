'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowSquareOut, BellRinging, CloudArrowUp, Database, DownloadSimple, FileMagnifyingGlass, Play, SpinnerGap, ArrowClockwise } from '@phosphor-icons/react';
import { Permission } from '@/lib/permissions';
import { useAuthStore } from '@/lib/auth-store';
import { artistService } from '@/lib/services/artist.service';
import { concertService } from '@/lib/services/concert.service';
import { operationsService, type AiBioRequestResult, type CsvImportJobStatus, type DemoBootstrapStatus, type NotificationJobRecord } from '@/lib/services/operations.service';
import type { Artist, Concert } from '@/lib/types';

type AiBioTargetType = 'ARTIST' | 'CONCERT';

const queueDashboardHref = (() => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
  return `${apiUrl.replace(/\/$/, '')}/admin/queues`;
})();

type MonitorFilter = 'all' | 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED';

function truncateText(value: string, maxLength: number) {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength).trimEnd()}...`;
}

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

function getTargetLabel(targetType: AiBioTargetType) {
  return targetType === 'CONCERT' ? 'concert' : 'artist';
}

function NotificationRowStatus({ item }: Readonly<{ item: NotificationJobRecord }>) {
  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ${statusTone(item.status)}`}>
      {item.status ?? 'UNKNOWN'}
    </span>
  );
}

function getNotificationTicketId(job: NotificationJobRecord) {
  const rawTicketId = job.data?.ticketId;
  return typeof rawTicketId === 'string' && rawTicketId.trim() ? rawTicketId : null;
}

export default function JobsPage() {
  const admin = useAuthStore((state) => state.admin);
  const permissions = useAuthStore((state) => state.permissions);
  const canViewJobs = permissions.includes(Permission.VIP_IMPORT) || permissions.includes(Permission.AI_GENERATE_BIO) || permissions.includes(Permission.REPORT_VIEW) || permissions.includes(Permission.RBAC_MANAGE);
  const canUploadCsv = permissions.includes(Permission.VIP_IMPORT);
  const canRetryCsv = permissions.includes(Permission.VIP_IMPORT);
  const canRetryAi = permissions.includes(Permission.AI_GENERATE_BIO);
  const canRetryNotifications = permissions.includes(Permission.RBAC_MANAGE);
  const canManageDemo = permissions.includes(Permission.RBAC_MANAGE);

  const [csvJobs, setCsvJobs] = useState<CsvImportJobStatus[]>([]);
  const [aiJobs, setAiJobs] = useState<AiBioRequestResult[]>([]);
  const [notificationJobs, setNotificationJobs] = useState<NotificationJobRecord[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [concerts, setConcerts] = useState<Concert[]>([]);
  const [selectedTargetType, setSelectedTargetType] = useState<AiBioTargetType>('ARTIST');
  const [selectedTargetId, setSelectedTargetId] = useState('');
  const [selectedConcertId, setSelectedConcertId] = useState('');
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
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvUploadLoading, setCsvUploadLoading] = useState(false);
  const [csvUploadMessage, setCsvUploadMessage] = useState<string | null>(null);
  const [csvUploadError, setCsvUploadError] = useState<string | null>(null);
  const [probeEmail, setProbeEmail] = useState('');
  const [probeTicketId, setProbeTicketId] = useState('');
  const [probeLoading, setProbeLoading] = useState(false);
  const [probeMessage, setProbeMessage] = useState<string | null>(null);
  const [probeError, setProbeError] = useState<string | null>(null);
  const [manualBioContent, setManualBioContent] = useState('');
  const [manualBioLoading, setManualBioLoading] = useState(false);
  const [manualBioMessage, setManualBioMessage] = useState<string | null>(null);
  const [manualBioError, setManualBioError] = useState<string | null>(null);
  const [demoJobId, setDemoJobId] = useState<string | null>(null);
  const [demoStatus, setDemoStatus] = useState<DemoBootstrapStatus | null>(null);
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);

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
    } catch {
      setArtists([]);
    }

    try {
      const nextConcerts = await concertService.getConcerts(admin);
      setConcerts(nextConcerts);
    } catch {
      setConcerts([]);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load initial jobs and artists when the page mounts
    void loadAllJobs();
  }, []);

  useEffect(() => {
    const options = selectedTargetType === 'ARTIST' ? artists : concerts;
    setSelectedTargetId((current) => {
      if (current && options.some((item) => item.id === current)) {
        return current;
      }
      return options[0]?.id || '';
    });
  }, [artists, concerts, selectedTargetType]);

  useEffect(() => {
    setSelectedConcertId((current) => {
      if (current && concerts.some((item) => item.id === current)) {
        return current;
      }
      return concerts[0]?.id || '';
    });
  }, [concerts]);

  useEffect(() => {
    if (!demoJobId || demoStatus?.status === 'COMPLETED' || demoStatus?.status === 'FAILED') {
      return;
    }

    let isActive = true;
    const intervalId = window.setInterval(async () => {
      try {
        const nextStatus = await operationsService.getDemoBootstrapStatus(demoJobId);
        if (isActive) {
          setDemoStatus(nextStatus);
        }
      } catch (error) {
        if (isActive) {
          setDemoError(error instanceof Error ? error.message : 'Unable to load demo bootstrap status.');
        }
      }
    }, 3000);

    return () => {
      isActive = false;
      window.clearInterval(intervalId);
    };
  }, [demoJobId, demoStatus?.status]);

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
    if (!selectedTargetId) {
      setCreateError(`Please choose a ${getTargetLabel(selectedTargetType)}.`);
      return;
    }

    setCreateLoading(true);
    setCreateError(null);
    setCreateMessage(null);

    try {
      const result = await operationsService.createAiBioRequest(pdfFile, selectedTargetId, selectedTargetType);
      setCreateMessage(result.status ? `AI bio request created: ${result.status}` : 'AI bio request created.');
      await loadAllJobs();
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Unable to create AI bio request.');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleCreateManualBio = async () => {
    if (!selectedTargetId) {
      setManualBioError(`Please choose a ${getTargetLabel(selectedTargetType)}.`);
      return;
    }
    if (!manualBioContent.trim()) {
      setManualBioError('Manual bio content is required.');
      return;
    }

    setManualBioLoading(true);
    setManualBioError(null);
    setManualBioMessage(null);

    try {
      const result = await operationsService.createManualAiBioDraft(selectedTargetId, manualBioContent.trim(), selectedTargetType);
      setManualBioMessage(result.id ? `Manual draft created: ${result.id}` : 'Manual draft created.');
      setManualBioContent('');
      await loadAllJobs();
    } catch (error) {
      setManualBioError(error instanceof Error ? error.message : 'Unable to create manual bio draft.');
    } finally {
      setManualBioLoading(false);
    }
  };

  const handleCsvUpload = async () => {
    if (!selectedConcertId) {
      setCsvUploadError('Please choose a concert.');
      return;
    }
    if (!csvFile) {
      setCsvUploadError('Please choose a CSV file.');
      return;
    }

    setCsvUploadLoading(true);
    setCsvUploadError(null);
    setCsvUploadMessage(null);

    try {
      const result = await operationsService.createCsvImportJob(csvFile, selectedConcertId);
      setCsvUploadMessage(result.id ? `CSV import queued: ${result.id}` : 'CSV import queued.');
      setCsvLookupId(result.id ?? '');
      setCsvLookupResult(result);
      await loadAllJobs();
    } catch (error) {
      setCsvUploadError(error instanceof Error ? error.message : 'Unable to upload CSV import.');
    } finally {
      setCsvUploadLoading(false);
    }
  };

  const handleNotificationProbe = async () => {
    const email = probeEmail.trim();
    const ticketId = probeTicketId.trim();

    if (!email || !ticketId) {
      setProbeError('Please enter both email and ticket ID.');
      setProbeMessage(null);
      return;
    }

    setProbeLoading(true);
    setProbeError(null);
    setProbeMessage(null);

    try {
      const result = await operationsService.sendNotificationProbe({ email, ticketId });
      setProbeMessage(result.message ?? 'Notification probe submitted.');
      await loadAllJobs();
    } catch (error) {
      setProbeError(error instanceof Error ? error.message : 'Unable to submit notification probe.');
    } finally {
      setProbeLoading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    setCsvUploadError(null);

    try {
      const template = await operationsService.getCsvImportTemplate();
      const columns = template.columns?.map((column) => column.name) ?? ['email', 'name', 'phone', 'ticketTypeId'];
      const exampleRows = template.exampleRows && template.exampleRows.length > 0 ? template.exampleRows : [];
      const csvLines = [
        columns.join(','),
        ...exampleRows.map((row) => columns.map((column) => row[column] ?? '').join(',')),
      ];
      const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = template.filename ?? 'vip-import-template.csv';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setCsvUploadError(error instanceof Error ? error.message : 'Unable to download CSV template.');
    }
  };

  const handleStartDemoBootstrap = async () => {
    setDemoLoading(true);
    setDemoError(null);

    try {
      const result = await operationsService.startDemoBootstrap();
      setDemoJobId(result.jobId);
      setDemoStatus({
        jobId: result.jobId,
        status: result.status === 'PENDING' ? 'PENDING' : 'PROCESSING',
        progress: 0,
        message: result.message,
      });
    } catch (error) {
      setDemoError(error instanceof Error ? error.message : 'Unable to start demo bootstrap.');
    } finally {
      setDemoLoading(false);
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
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
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
            <a href={queueDashboardHref} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-surface md:self-start">
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
              <p className="text-sm text-muted">Create an AI bio request from an artist or concert press kit PDF.</p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <div className="grid gap-3 md:grid-cols-[180px_minmax(0,1fr)] md:items-end">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-primary">Target type</span>
                <select
                  value={selectedTargetType}
                  onChange={(event) => setSelectedTargetType(event.target.value as AiBioTargetType)}
                  className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm text-primary outline-none focus:border-primary"
                >
                  <option value="ARTIST">Artist</option>
                  <option value="CONCERT">Concert</option>
                </select>
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-primary">{selectedTargetType === 'ARTIST' ? 'Artist' : 'Concert'}</span>
                <select
                  value={selectedTargetId}
                  onChange={(event) => setSelectedTargetId(event.currentTarget.value)}
                  className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm text-primary outline-none focus:border-primary"
                >
                  <option value="">Select {getTargetLabel(selectedTargetType)}</option>
                  {(selectedTargetType === 'ARTIST' ? artists : concerts).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid gap-3 md:grid-cols-2 md:items-end">
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

            <div className="rounded-2xl border border-border bg-background p-4">
              <div className="space-y-3">
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-primary">Manual bio fallback</span>
                  <textarea
                    value={manualBioContent}
                    onChange={(event) => setManualBioContent(event.target.value)}
                    rows={4}
                    placeholder={`Write a manual ${selectedTargetType === 'ARTIST' ? 'artist bio' : 'concert intro'} when AI generation fails.`}
                    className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm leading-6 text-primary outline-none focus:border-primary"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void handleCreateManualBio()}
                  disabled={manualBioLoading || !selectedTargetId}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-border bg-surface px-4 text-sm font-medium text-primary disabled:opacity-60"
                >
                  {manualBioLoading ? <SpinnerGap size={16} className="animate-spin" /> : <CloudArrowUp size={16} />}
                  Create manual draft
                </button>
              </div>
              {manualBioMessage ? <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{manualBioMessage}</div> : null}
              {manualBioError ? <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{manualBioError}</div> : null}
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-border bg-surface p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-primary">AI bio jobs</h2>
              <p className="mt-2 text-sm leading-6 text-muted">Monitor press-kit requests from the backend and retry failed draft generation.</p>
            </div>
            <label className="block min-w-[220px] space-y-2">
              <span className="text-sm font-medium text-primary">Filter</span>
              <select
                value={aiFilter}
                onChange={(event) => setAiFilter(event.target.value as MonitorFilter)}
                className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-center text-sm text-primary outline-none focus:border-primary"
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
                    <th className="px-4 py-3 text-center align-middle font-medium">Job</th>
                    <th className="px-4 py-3 text-center font-medium">Status</th>
                    <th className="px-4 py-3 text-center font-medium">Target</th>
                    <th className="px-4 py-3 text-center font-medium">Draft</th>
                    <th className="px-4 py-3 text-center font-medium">Created</th>
                    <th className="px-4 py-3 text-center font-medium">Action</th>
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
                          <td className="px-4 py-3 align-middle font-medium text-primary">
                            {job.id ? (
                              <Link href={`/operations/jobs/ai/${job.id}`} className="hover:underline">
                                {job.id}
                              </Link>
                            ) : '--'}
                          </td>
                          <td className="px-4 py-3 align-middle">
                            <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ${statusTone(normalizedStatus)}`}>
                              {normalizedStatus}
                            </span>
                          </td>
                          <td className="px-4 py-3 align-middle text-muted">
                            <div className="space-y-1">
                              <p>{getTargetLabel((job.targetType ?? 'ARTIST') as AiBioTargetType)}: {job.targetId ?? job.artistId ?? '--'}</p>
                              <p className="text-[11px] uppercase tracking-[0.18em] text-muted">{job.targetType ?? 'ARTIST'}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3 align-middle text-muted">
                            <div className="max-w-[360px] break-words leading-6">
                              {job.draftContent?.trim()
                                ? truncateText(job.draftContent, 120)
                                : 'No draft content returned yet.'}
                            </div>
                          </td>
                          <td className="px-4 py-3 align-middle text-muted">{formatDateTime(job.createdAt)}</td>
                          <td className="px-4 py-3 align-middle">
                            <div className="flex flex-nowrap gap-2">
                              {job.id ? (
                                <Link
                                  href={`/operations/jobs/ai/${job.id}`}
                                  className="inline-flex flex-1 min-w-0 items-center justify-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-xs font-medium text-primary whitespace-nowrap"
                                >
                                  Review draft
                                </Link>
                              ) : null}
                              {job.targetType === 'ARTIST' && job.targetId ? (
                                <Link
                                  href={`/artists/${job.targetId}/edit`}
                                  className="inline-flex flex-1 min-w-0 items-center justify-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-xs font-medium text-primary whitespace-nowrap"
                                >
                                  Review & publish
                                </Link>
                              ) : null}
                              {job.targetType === 'CONCERT' && job.targetId ? (
                                <Link
                                  href={`/concerts/${job.targetId}/edit`}
                                  className="inline-flex flex-1 min-w-0 items-center justify-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-xs font-medium text-primary whitespace-nowrap"
                                >
                                  Open concert
                                </Link>
                              ) : null}
                              {retryable && canRetryAi ? (
                                <button
                                  type="button"
                                  onClick={() => handleRetry('ai', String(job.id))}
                                  disabled={retrying === `ai:${String(job.id)}`}
                                  className="inline-flex flex-1 min-w-0 items-center justify-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-xs font-medium text-primary whitespace-nowrap disabled:opacity-60"
                                >
                                  {retrying === `ai:${String(job.id)}` ? <SpinnerGap size={14} className="animate-spin" /> : <ArrowClockwise size={14} />}
                                  Retry
                                </button>
                              ) : !canRetryAi ? (
                                <span className="text-xs text-muted">Retry locked</span>
                              ) : null}
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
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-border bg-background p-3 text-primary">
              <CloudArrowUp size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-primary">Upload CSV import</h2>
              <p className="text-sm text-muted">Create a CSV import job for the selected concert.</p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,0.85fr)_minmax(0,0.85fr)] lg:items-end">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-primary">Concert</span>
              <select
                value={selectedConcertId}
                onChange={(event) => setSelectedConcertId(event.target.value)}
                disabled={!canUploadCsv}
                className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm text-primary outline-none focus:border-primary disabled:opacity-60"
              >
                <option value="">Select concert</option>
                {concerts.map((concert) => (
                  <option key={concert.id} value={concert.id}>
                    {concert.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 text-sm font-medium text-primary">
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => setCsvFile(event.target.files?.[0] ?? null)}
                className="hidden"
                disabled={!canUploadCsv}
              />
              <span className="truncate">{csvFile ? csvFile.name : 'Choose CSV'}</span>
            </label>
            <button
              type="button"
              onClick={() => void handleCsvUpload()}
              disabled={csvUploadLoading || !canUploadCsv}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-surface disabled:opacity-60"
            >
              {csvUploadLoading ? <SpinnerGap size={16} className="animate-spin" /> : <CloudArrowUp size={16} />}
              Upload
            </button>
            <button
              type="button"
              onClick={() => void handleDownloadTemplate()}
              disabled={!canUploadCsv}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-border bg-background px-4 text-sm font-medium text-primary disabled:opacity-60"
            >
              <DownloadSimple size={16} />
              Template
            </button>
          </div>
          {csvUploadMessage ? <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{csvUploadMessage}</div> : null}
          {csvUploadError ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{csvUploadError}</div> : null}
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
                className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-center text-sm text-primary outline-none focus:border-primary"
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
              <table className="min-w-full whitespace-nowrap text-center text-sm">
                <thead className="bg-surface/80 text-muted">
                  <tr>
                    <th className="px-4 py-3 text-center align-middle font-medium">Job</th>
                    <th className="px-4 py-3 text-center font-medium">Status</th>
                    <th className="px-4 py-3 text-center font-medium">Rows</th>
                    <th className="px-4 py-3 text-center font-medium">Created</th>
                    <th className="px-4 py-3 text-center font-medium">Action</th>
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
                          <td className="px-4 py-3 align-middle font-medium text-primary">
                            {job.id ? (
                              <Link href={`/operations/jobs/${job.id}`} className="hover:underline">
                                {job.id}
                              </Link>
                            ) : '--'}
                          </td>
                          <td className="px-4 py-3 align-middle">
                            <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ${statusTone(normalizedStatus)}`}>
                              {normalizedStatus}
                            </span>
                          </td>
                          <td className="px-4 py-3 align-middle text-muted">
                            {job.totalRows ?? 0} / {job.successRows ?? 0} / {job.errorRows ?? 0}
                          </td>
                          <td className="px-4 py-3 align-middle text-muted">{formatDateTime(job.createdAt)}</td>
                          <td className="px-4 py-3 align-middle">
                            <div className="flex items-center justify-center gap-2">
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
                              ) : !canRetryCsv ? (
                                <span className="text-xs text-muted">Retry locked</span>
                              ) : null}
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

        {canManageDemo ? (
          <section className="rounded-[28px] border border-border bg-surface p-5 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-border bg-background p-3 text-primary">
                  <Database size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-primary">Demo data bootstrap</h2>
                  <p className="text-sm text-muted">Starts the admin demo bootstrap API and polls its Redis-backed progress.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void handleStartDemoBootstrap()}
                disabled={demoLoading || demoStatus?.status === 'PROCESSING'}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-surface disabled:opacity-60"
              >
                {demoLoading ? <SpinnerGap size={16} className="animate-spin" /> : <Play size={16} />}
                Start bootstrap
              </button>
            </div>
            {demoStatus ? (
              <div className="mt-4 rounded-2xl border border-border bg-background p-4 text-sm leading-6 text-muted">
                <p>Status: {demoStatus.status ?? '--'} · Progress: {demoStatus.progress ?? 0}%</p>
                <p className="mt-1">{demoStatus.message ?? '--'}</p>
                {demoStatus.created ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <p>Admin user: {demoStatus.created.adminUserId ?? '--'}</p>
                    <p>Organizer user: {demoStatus.created.organizerUserId ?? '--'}</p>
                    <p>Staff user: {demoStatus.created.staffUserId ?? '--'}</p>
                    <p>Audience user: {demoStatus.created.audienceUserId ?? '--'}</p>
                    <p>Concert: {demoStatus.created.concertId ?? '--'}</p>
                    <p>CSV job: {demoStatus.created.csvJobId ?? '--'}</p>
                  </div>
                ) : null}
              </div>
            ) : null}
            {demoError ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{demoError}</div> : null}
          </section>
        ) : null}

        <section className="rounded-[28px] border border-border bg-surface p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-border bg-background p-3 text-primary">
              <BellRinging size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-primary">Notification probe</h2>
              <p className="text-sm text-muted">Send a test confirmation email and track the resulting notification job here.</p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-primary">Email</span>
                <input
                  value={probeEmail}
                  onChange={(event) => setProbeEmail(event.target.value)}
                  placeholder="ops@ticketbox.vn"
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-primary outline-none focus:border-primary"
                />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-primary">Ticket ID</span>
                <input
                  value={probeTicketId}
                  onChange={(event) => setProbeTicketId(event.target.value)}
                  placeholder="ticket_123"
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-primary outline-none focus:border-primary"
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void handleNotificationProbe()}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-surface"
              >
                {probeLoading ? <SpinnerGap size={16} className="animate-spin" /> : <BellRinging size={16} />}
                Send probe
              </button>
              {probeTicketId.trim() ? (
                <Link
                  href={`/operations/notifications/${encodeURIComponent(probeTicketId.trim())}`}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-border bg-background px-4 text-sm font-medium text-primary"
                >
                  Open ticket detail
                </Link>
              ) : null}
            </div>
            {probeMessage ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{probeMessage}</div> : null}
            {probeError ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{probeError}</div> : null}
          </div>
        </section>


        <section className="rounded-[28px] border border-border bg-surface p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-primary">Notification jobs</h2>
              <p className="mt-2 text-sm leading-6 text-muted">Failed delivery jobs are visible here with reasons and retry buttons for admins.</p>
            </div>
            <label className="block min-w-[220px] space-y-2">
              <span className="text-sm font-medium text-primary">Filter</span>
              <select
                value={notificationFilter}
                onChange={(event) => setNotificationFilter(event.target.value as MonitorFilter)}
                className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-center text-sm text-primary outline-none focus:border-primary"
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
                  <th className="px-4 py-3 text-center align-middle font-medium">Job</th>
                  <th className="px-4 py-3 text-center font-medium">Status</th>
                  <th className="px-4 py-3 text-center font-medium">Reason</th>
                  <th className="px-4 py-3 text-center font-medium">Attempts</th>
                  <th className="px-4 py-3 text-center font-medium">Created</th>
                  <th className="px-4 py-3 text-center font-medium">Action</th>
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
                    const ticketId = getNotificationTicketId(job);
                    return (
                      <tr key={String(job.id)}>
                        <td className="px-4 py-3 align-middle font-medium text-primary">
                          {ticketId ? (
                            <Link href={`/operations/notifications/${ticketId}`} className="hover:underline">
                              {job.name ?? String(job.id)}
                            </Link>
                          ) : (
                            job.name ?? String(job.id)
                          )}
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <NotificationRowStatus item={job} />
                        </td>
                        <td className="px-4 py-3 align-middle text-muted">{job.failedReason ?? '--'}</td>
                        <td className="px-4 py-3 align-middle text-muted">{job.attemptsMade ?? 0}</td>
                        <td className="px-4 py-3 align-middle text-muted">{formatDateTime(job.timestamp)}</td>
                        <td className="px-4 py-3 align-middle">
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
                          ) : !canRetryNotifications ? (
                            <span className="text-xs text-muted">Retry locked</span>
                          ) : null}
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
