'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowSquareOut, BellRinging, SpinnerGap } from '@phosphor-icons/react';
import { Permission } from '@/lib/permissions';
import { useAuthStore } from '@/lib/auth-store';
import { operationsService } from '@/lib/services/operations.service';

const queueDashboardHref = (() => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
  return apiUrl.replace(/\/api\/v1\/?$/, '') + '/admin/queues';
})();

export default function NotificationsPage() {
  const permissions = useAuthStore((state) => state.permissions);
  const canViewNotifications = permissions.includes(Permission.REPORT_VIEW) || permissions.includes(Permission.RBAC_MANAGE);
  const [email, setEmail] = useState('');
  const [ticketId, setTicketId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl space-y-3">
            <Link href="/operations" className="inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-primary">
              <ArrowLeft size={16} />
              Back to operations hub
            </Link>
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-muted">Request 14</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-primary">Failed notification jobs and retry</h1>
              <p className="mt-3 text-sm leading-6 text-muted">
                The real retry action lives in the backend Bull Board. This page keeps the queue visible and gives a live probe path for notification delivery.
              </p>
            </div>
          </div>
          <a href={queueDashboardHref} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-surface">
            <ArrowSquareOut size={16} />
            Open Bull Board
          </a>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <section className="rounded-[28px] border border-border bg-surface p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-border bg-background p-3 text-primary">
              <BellRinging size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-primary">Notification probe</h2>
              <p className="text-sm text-muted">Uses the real `/notifications/test-confirmation` endpoint.</p>
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

        <div className="space-y-4">
          <section className="rounded-[28px] border border-border bg-surface p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-primary">Retry path</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Failed job retry is intentionally delegated to the backend queue dashboard so the retry action operates on the real queue, not on a fake UI copy.
            </p>
            <div className="mt-4 rounded-2xl border border-border bg-background p-4 text-sm leading-6 text-muted">
              <p>Queue: notification</p>
              <p className="mt-1">Job name: notification.ticket_confirmation</p>
              <p className="mt-1">Idempotency: UNIQUE(ticketId, type, channel)</p>
            </div>
          </section>

          <section className="rounded-[28px] border border-border bg-surface p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-primary">Backend queue map</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              The backend registers notification, csv, ai, maintenance, and order-expiry in Bull Board.
            </p>
            <div className="mt-4 rounded-2xl border border-border bg-background p-4 text-sm leading-6 text-muted">
              <p>/admin/queues</p>
              <p className="mt-1">notification, csv, ai, maintenance, order-expiry</p>
            </div>
          </section>

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
      </div>
    </div>
  );
}
