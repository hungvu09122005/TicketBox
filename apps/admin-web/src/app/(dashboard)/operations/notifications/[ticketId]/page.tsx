'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowClockwise, ArrowLeft, ArrowSquareOut, BellRinging, SpinnerGap } from '@phosphor-icons/react';
import { operationsService, type NotificationJobRecord } from '@/lib/services/operations.service';

const queueDashboardHref = (() => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
  return `${apiUrl.replace(/\/$/, '')}/admin/queues`;
})();

function getNotificationTicketId(job: NotificationJobRecord) {
  const rawTicketId = job.data?.ticketId;
  return typeof rawTicketId === 'string' && rawTicketId.trim() ? rawTicketId : null;
}

function getNotificationEmail(job: NotificationJobRecord) {
  const rawEmail = job.data?.toEmail;
  return typeof rawEmail === 'string' && rawEmail.trim() ? rawEmail : '--';
}

function getNotificationResult(job: NotificationJobRecord) {
  if (job.failedReason?.trim()) {
    return job.failedReason;
  }

  switch (job.status) {
    case 'PROCESSING':
      return 'Notification is being processed.';
    case 'PENDING':
      return 'Notification is queued for delivery.';
    case 'FAILED':
      return 'Notification delivery failed.';
    default:
      return null;
  }
}

function getStatusTone(status?: string) {
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

function formatDateTime(value?: number | null) {
  if (!value) return '--';

  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

export default function NotificationDetailPage({ params }: Readonly<{ params: Promise<{ ticketId: string }> }>) {
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [jobs, setJobs] = useState<NotificationJobRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadJobs = async (targetTicketId: string) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const notificationJobs = await operationsService.getNotificationJobs();
      const nextJobs = notificationJobs
        .filter((job) => getNotificationTicketId(job) === targetTicketId)
        .sort((left, right) => (right.timestamp ?? 0) - (left.timestamp ?? 0));

      setJobs(nextJobs);
    } catch (error) {
      setJobs([]);
      setErrorMessage(error instanceof Error ? error.message : 'Unable to load notification records.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isActive = true;

    const loadPage = async () => {
      const resolvedParams = await params;
      if (!isActive) return;

      setTicketId(resolvedParams.ticketId);

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const notificationJobs = await operationsService.getNotificationJobs();
        if (!isActive) return;

        const nextJobs = notificationJobs
          .filter((job) => getNotificationTicketId(job) === resolvedParams.ticketId)
          .sort((left, right) => (right.timestamp ?? 0) - (left.timestamp ?? 0));

        setJobs(nextJobs);
      } catch (error) {
        if (!isActive) return;

        setJobs([]);
        setErrorMessage(error instanceof Error ? error.message : 'Unable to load notification records.');
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    void loadPage();

    return () => {
      isActive = false;
    };
  }, [params]);

  const latestStatus = jobs[0]?.status ?? 'NO_RECORDS';

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
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-primary">Notification ticket detail</h1>
              <p className="mt-3 text-sm leading-6 text-muted">
                Read-only delivery history for the selected ticket.
              </p>
            </div>
          </div>
          <a href={queueDashboardHref} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-surface">
            <ArrowSquareOut size={16} />
            Open queue board
          </a>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-[28px] border border-border bg-surface p-5 shadow-sm">
          <p className="text-sm font-medium text-muted">Ticket ID</p>
          <p className="mt-3 break-all font-mono text-sm leading-6 text-primary">{ticketId ?? '--'}</p>
        </div>
        <div className="rounded-[28px] border border-border bg-surface p-5 shadow-sm">
          <p className="text-sm font-medium text-muted">Jobs found</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-primary">{jobs.length}</p>
        </div>
        <div className="rounded-[28px] border border-border bg-surface p-5 shadow-sm">
          <p className="text-sm font-medium text-muted">Latest status</p>
          <div className="mt-3">
            <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ${getStatusTone(latestStatus)}`}>
              {latestStatus === 'NO_RECORDS' ? 'NO RECORDS' : latestStatus}
            </span>
          </div>
        </div>
      </div>

      <section className="rounded-[28px] border border-border bg-surface p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-border bg-background p-3 text-primary">
              <BellRinging size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-primary">Notification records</h2>
              <p className="text-sm text-muted">Each row maps the delivery email, ticket id, and backend result for this ticket.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (ticketId) {
                void loadJobs(ticketId);
              }
            }}
            disabled={isLoading || !ticketId}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border bg-background px-4 py-2.5 text-sm font-medium text-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? <SpinnerGap size={16} className="animate-spin" /> : <ArrowClockwise size={16} />}
            Refresh
          </button>
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-background">
          <div className="w-full overflow-x-auto">
            <table className="min-w-[1220px] w-full text-center text-sm">
              <thead className="bg-surface/80 text-muted">
                <tr>
                  <th className="px-4 py-3 text-center font-medium whitespace-nowrap">Email</th>
                  <th className="px-4 py-3 text-center font-medium whitespace-nowrap">Ticket ID</th>
                  <th className="px-4 py-3 text-center font-medium whitespace-nowrap">Result</th>
                  <th className="px-4 py-3 text-center font-medium whitespace-nowrap">Job</th>
                  <th className="px-4 py-3 text-center font-medium whitespace-nowrap">Attempts</th>
                  <th className="px-4 py-3 text-center font-medium whitespace-nowrap">Created</th>
                  <th className="px-4 py-3 text-center font-medium whitespace-nowrap">Finished</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-muted">
                      <div className="inline-flex items-center gap-2">
                        <SpinnerGap size={16} className="animate-spin" />
                        Loading notification records...
                      </div>
                    </td>
                  </tr>
                ) : errorMessage ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-red-800">
                      {errorMessage}
                    </td>
                  </tr>
                ) : jobs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-muted">
                      No notification records found for this ticket.
                    </td>
                  </tr>
                ) : (
                  jobs.map((job) => {
                    const notificationEmail = getNotificationEmail(job);
                    const notificationTicketId = getNotificationTicketId(job) ?? '--';
                    const notificationResult = getNotificationResult(job);
                    const jobName = job.name ?? '--';

                    return (
                    <tr key={String(job.id)} className="align-top">
                      <td className="px-4 py-4 text-center whitespace-nowrap text-primary">{notificationEmail}</td>
                      <td className="px-4 py-4 text-center">
                        <span className="whitespace-nowrap font-mono text-[12px] leading-6 text-primary">
                          {notificationTicketId}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="flex flex-col items-center space-y-2">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.16em] ${getStatusTone(job.status)}`}>
                            {job.status ?? 'UNKNOWN'}
                          </span>
                          {notificationResult ? (
                            <p className="max-w-[280px] break-words leading-6 text-muted">
                              {notificationResult}
                            </p>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center whitespace-nowrap text-muted">{jobName}</td>
                      <td className="px-4 py-4 text-center whitespace-nowrap text-muted">{job.attemptsMade ?? 0}</td>
                      <td className="px-4 py-4 text-center text-muted">
                        <span className="whitespace-nowrap">{formatDateTime(job.timestamp)}</span>
                      </td>
                      <td className="px-4 py-4 text-center text-muted">
                        <span className="whitespace-nowrap">{formatDateTime(job.finishedOn)}</span>
                      </td>
                    </tr>
                  )})
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
