'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowSquareOut, BellRinging, SpinnerGap } from '@phosphor-icons/react';
import { operationsService } from '@/lib/services/operations.service';

const queueDashboardHref = (() => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
  return apiUrl.replace(/\/api\/v1\/?$/, '') + '/admin/queues';
})();

export default function NotificationDetailPage({ params }: Readonly<{ params: Promise<{ ticketId: string }> }>) {
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [initId, setInitId] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    const load = async () => {
      const resolved = await params;
      if (!isActive) return;
      setTicketId(resolved.ticketId);
    };

    void load();

    return () => {
      isActive = false;
    };
  }, [params]);

  const handleProbe = async () => {
    if (!ticketId || !email.trim()) {
      setErrorMessage('Please enter email for the probe.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setMessage(null);

    try {
      const result = await operationsService.sendNotificationProbe({
        email: email.trim(),
        ticketId,
      });
      setInitId(result.message ? ticketId : null);
      setMessage(result.message ?? 'Notification probe submitted.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to submit notification probe.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-[32px] border border-border bg-surface p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="max-w-2xl space-y-3">
            <Link href="/operations/notifications" className="inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-primary">
              <ArrowLeft size={16} />
              Back to notifications
            </Link>
            <div>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-primary">Notification ticket detail</h1>
              <p className="mt-3 text-sm leading-6 text-muted">
                This detail view keeps the notification contract visible for one ticket and uses the live probe endpoint instead of a fake retry action.
              </p>
            </div>
          </div>
          <a href={queueDashboardHref} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-surface">
            <ArrowSquareOut size={16} />
            Open Bull Board
          </a>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <section className="rounded-[28px] border border-border bg-surface p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-border bg-background p-3 text-primary">
              <BellRinging size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-primary">Probe a ticket</h2>
              <p className="text-sm text-muted">Uses `/notifications/test-confirmation` with the current ticket id.</p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-primary">Ticket ID</span>
                <input
                  value={ticketId ?? ''}
                  onChange={(event) => setTicketId(event.target.value)}
                  placeholder="ticket_123"
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-primary outline-none focus:border-primary"
                />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-primary">Email</span>
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="ops@ticketbox.vn"
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-primary outline-none focus:border-primary"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={handleProbe}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-surface sm:w-auto"
            >
              {isSubmitting ? <SpinnerGap size={16} className="animate-spin" /> : <BellRinging size={16} />}
              Send probe
            </button>
            {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{message}</div> : null}
            {errorMessage ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{errorMessage}</div> : null}
            {initId ? <div className="rounded-2xl border border-border bg-background p-4 text-sm text-muted">Probe tracked for ticket: {initId}</div> : null}
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-[28px] border border-border bg-surface p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-primary">Retry contract</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Retry remains in the Bull Board. The backend log enforces unique `(ticketId, type, channel)` to stop duplicate delivery.
            </p>
            <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-background">
              <table className="min-w-full text-left text-sm">
                <tbody className="divide-y divide-border">
                  <tr>
                    <th className="w-40 px-4 py-3 font-medium text-primary">Queue</th>
                    <td className="px-4 py-3 text-muted">notification</td>
                  </tr>
                  <tr>
                    <th className="w-40 px-4 py-3 font-medium text-primary">Job name</th>
                    <td className="px-4 py-3 text-muted">notification.ticket_confirmation</td>
                  </tr>
                  <tr>
                    <th className="w-40 px-4 py-3 font-medium text-primary">Unique key</th>
                    <td className="px-4 py-3 text-muted">ticketId + type + channel</td>
                  </tr>
                  <tr>
                    <th className="w-40 px-4 py-3 font-medium text-primary">Retry path</th>
                    <td className="px-4 py-3 text-muted">Bull Board /admin/queues</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-[28px] border border-border bg-surface p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-primary">Failure triage</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Failed jobs need a reason before retrying. This page does not invent a fake queue list, but it shows the checks an admin should use when a notification fails.
            </p>
            <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-background">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-surface/80 text-muted">
                  <tr>
                    <th className="px-4 py-3 font-medium">Possible cause</th>
                    <th className="px-4 py-3 font-medium">What to check</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    ['Provider rejection', 'Check SendGrid sandbox credentials and recipient address'],
                    ['Queue worker error', 'Open Bull Board and inspect the failed job payload / stack trace'],
                    ['Duplicate delivery blocked', 'Verify `notification_logs` unique key before retrying'],
                    ['Missing ticket data', 'Confirm the ticketId exists in the backend before enqueueing again'],
                  ].map(([cause, check]) => (
                    <tr key={cause}>
                      <td className="px-4 py-3 font-medium text-primary">{cause}</td>
                      <td className="px-4 py-3 text-muted">{check}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-[28px] border border-border bg-surface p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-primary">Manual retry flow</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              The retry action stays in Bull Board so it can operate on the real job and queue state without creating duplicate jobs in the UI.
            </p>
            <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-background">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-surface/80 text-muted">
                  <tr>
                    <th className="px-4 py-3 font-medium">Step</th>
                    <th className="px-4 py-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    ['1', 'Open Bull Board `/admin/queues`'],
                    ['2', 'Inspect the failed `notification` job payload and stack trace'],
                    ['3', 'Confirm `ticketId`, email, and dedupe key before retrying'],
                    ['4', 'Retry once from the queue board, not from a fake UI button'],
                  ].map(([step, action]) => (
                    <tr key={step}>
                      <td className="px-4 py-3 font-medium text-primary">{step}</td>
                      <td className="px-4 py-3 text-muted">{action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-[28px] border border-border bg-surface p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-primary">How it maps</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              The notification log model is the source of truth for dedupe; this page mirrors that contract instead of pretending to manage retries itself.
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
                    ['QUEUED', 'Waiting in queue'],
                    ['SENT', 'Delivered to provider'],
                    ['FAILED', 'Worker failure or provider rejection'],
                    ['BOUNCED', 'Delivery bounced after send'],
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
        </section>
      </div>
    </div>
  );
}
