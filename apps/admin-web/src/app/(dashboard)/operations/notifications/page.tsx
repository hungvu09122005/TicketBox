'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowSquareOut, BellRinging, CheckCircle, SpinnerGap, ArrowClockwise } from '@phosphor-icons/react';
import { Permission } from '@/lib/permissions';
import { useAuthStore } from '@/lib/auth-store';
import { operationsService, type NotificationJobRecord } from '@/lib/services/operations.service';

const queueDashboardHref = (() => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
  return `${apiUrl.replace(/\/$/, '')}/admin/queues`;
})();

type JobFilter = 'all' | 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED';

function jobTone(status?: string) {
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

function formatDateTime(value?: number) {
  if (!value) return '--';
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function NotificationsPage() {
  const permissions = useAuthStore((state) => state.permissions);
  const canViewNotifications = permissions.includes(Permission.REPORT_VIEW) || permissions.includes(Permission.RBAC_MANAGE);
  const canRetryNotifications = permissions.includes(Permission.RBAC_MANAGE);
  const [email, setEmail] = useState('');
  const [ticketId, setTicketId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [jobFilter, setJobFilter] = useState<JobFilter>('FAILED');
  const [jobs, setJobs] = useState<NotificationJobRecord[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [retryingJobId, setRetryingJobId] = useState<string | number | null>(null);

  useEffect(() => {
    let isActive = true;

    const loadJobs = async () => {
      setJobsLoading(true);
      setJobsError(null);

      try {
        const data = await operationsService.getNotificationJobs(jobFilter === 'all' ? undefined : jobFilter);
        if (!isActive) return;
        setJobs(data);
      } catch (error) {
        if (!isActive) return;
        setJobsError(error instanceof Error ? error.message : 'Unable to load notification jobs.');
      } finally {
        if (isActive) {
          setJobsLoading(false);
        }
      }
    };

    void loadJobs();

    return () => {
      isActive = false;
    };
  }, [jobFilter]);

  const handleProbe = async () => {
    if (!email.trim() || !ticketId.trim()) {
      setErrorMessage('Please enter both email and ticket ID.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await operationsService.sendNotificationProbe({
        email: email.trim(),
        ticketId: ticketId.trim(),
      });

      setMessage(result.message ?? 'Notification probe submitted.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to submit notification probe.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetry = async (jobId?: string | number) => {
    if (!jobId) return;

    setRetryingJobId(jobId);
    setJobsError(null);

    try {
      const result = await operationsService.retryNotificationJob(String(jobId));
      setMessage(result.message ?? `Job ${jobId} is being retried.`);
      const data = await operationsService.getNotificationJobs(jobFilter === 'all' ? undefined : jobFilter);
      setJobs(data);
    } catch (error) {
      setJobsError(error instanceof Error ? error.message : 'Unable to retry notification job.');
    } finally {
      setRetryingJobId(null);
    }
  };

  if (!canViewNotifications) {
    return (
      <div className="rounded-[32px] border border-border bg-surface p-6 text-sm text-muted shadow-sm">
        You do not have access to notification operations.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[32px] border border-border bg-surface p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="max-w-2xl space-y-3">
            <Link href="/operations" className="inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-primary">
              <ArrowLeft size={16} />
              Back to operations hub
            </Link>
            <div>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-primary">Failed notification jobs and retry</h1>
              <p className="mt-3 text-sm leading-6 text-muted">
                This screen now lists real notification jobs by status, shows failure reasons, and retries failed jobs through the backend API when the user has permission.
              </p>
            </div>
          </div>
          <a href={queueDashboardHref} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-surface md:self-start">
            <ArrowSquareOut size={16} />
            Open queue board
          </a>
        </div>
      </div>

      <div className="grid gap-6">
        <section className="rounded-[28px] border border-border bg-surface p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-border bg-background p-3 text-primary">
              <BellRinging size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-primary">Notification probe</h2>
              <p className="text-sm text-muted">Send a test confirmation email for a ticket.</p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-primary">Email</span>
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="ops@ticketbox.vn"
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-primary outline-none focus:border-primary"
                />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-primary">Ticket ID</span>
                <input
                  value={ticketId}
                  onChange={(event) => setTicketId(event.target.value)}
                  placeholder="ticket_123"
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-primary outline-none focus:border-primary"
                />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleProbe}
                className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-surface ${ticketId.trim() ? '' : 'sm:col-span-2'}`}
              >
                {isSubmitting ? <SpinnerGap size={16} className="animate-spin" /> : <BellRinging size={16} />}
                Send probe
              </button>
              {ticketId.trim() ? (
                <Link
                  href={`/operations/notifications/${encodeURIComponent(ticketId.trim())}`}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-border bg-background px-4 py-2.5 text-sm font-medium text-primary"
                >
                  Open ticket detail
                </Link>
              ) : null}
            </div>
            {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{message}</div> : null}
            {errorMessage ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{errorMessage}</div> : null}
          </div>
        </section>

        <section className="rounded-[28px] border border-border bg-surface p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-primary">Notification jobs</h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                Lists jobs from the backend queue with failure reasons and retry actions for failed records.
              </p>
            </div>
            <label className="block min-w-[220px] space-y-2">
              <span className="text-sm font-medium text-primary">Filter</span>
              <select
                value={jobFilter}
                onChange={(event) => setJobFilter(event.target.value as JobFilter)}
                className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm text-primary outline-none focus:border-primary"
              >
                {(['all', 'FAILED', 'PENDING', 'PROCESSING', 'SUCCESS'] as const).map((status) => (
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
                  <th className="px-4 py-3 text-left font-medium">Job</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Reason</th>
                  <th className="px-4 py-3 text-left font-medium">Attempts</th>
                  <th className="px-4 py-3 text-left font-medium">Created</th>
                  <th className="px-4 py-3 text-left font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {jobsLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted">
                      <div className="inline-flex items-center gap-2">
                        <SpinnerGap size={16} className="animate-spin" />
                        Loading jobs...
                      </div>
                    </td>
                  </tr>
                ) : jobsError ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-red-800">
                      {jobsError}
                    </td>
                  </tr>
                ) : jobs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted">
                      No jobs found for the selected status.
                    </td>
                  </tr>
                ) : (
                  jobs.map((job) => (
                    <tr key={String(job.id)}>
                      <td className="px-4 py-3 font-medium text-primary">{job.name ?? String(job.id)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ${jobTone(job.status)}`}>
                          {job.status ?? 'UNKNOWN'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted">{job.failedReason ?? '--'}</td>
                      <td className="px-4 py-3 text-muted">{job.attemptsMade ?? 0}</td>
                      <td className="px-4 py-3 text-muted">{formatDateTime(job.timestamp)}</td>
                      <td className="px-4 py-3">
                        {job.status === 'FAILED' && canRetryNotifications ? (
                          <div className="flex justify-center">
                            <button
                              type="button"
                              onClick={() => handleRetry(job.id)}
                              disabled={retryingJobId === job.id}
                              className="inline-flex min-w-[110px] items-center justify-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-xs font-medium text-primary disabled:opacity-60"
                            >
                              {retryingJobId === job.id ? <SpinnerGap size={14} className="animate-spin" /> : <ArrowClockwise size={14} />}
                              Retry
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted">{canRetryNotifications ? 'No action' : 'Retry locked'}</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {canRetryNotifications ? null : (
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
            <CheckCircle size={18} className="mt-0.5 shrink-0" />
            <p className="text-sm leading-6">
              Retry is hidden unless the user has `rbac:manage`.
            </p>
          </div>
        )}
      </section>
      </div>

      <section className="rounded-[28px] border border-border bg-surface p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-primary">Live queue board</h2>
        <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-background">
          <iframe
            title="Bull Board queue dashboard"
            src={queueDashboardHref}
            className="h-[420px] w-full"
          />
        </div>
      </section>
    </div>
  );
}
