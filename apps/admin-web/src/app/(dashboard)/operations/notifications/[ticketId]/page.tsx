'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowSquareOut, BellRinging, SpinnerGap } from '@phosphor-icons/react';
import { operationsService } from '@/lib/services/operations.service';

const queueDashboardHref = (() => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
  return `${apiUrl.replace(/\/$/, '')}/admin/queues`;
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
            <Link href="/operations/jobs" className="inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-primary">
              <ArrowLeft size={16} />
              Back to job monitor
            </Link>
            <div>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-primary">Notification ticket detail</h1>
              <p className="mt-3 text-sm leading-6 text-muted">
                Check notification delivery for a specific ticket.
              </p>
            </div>
          </div>
          <a href={queueDashboardHref} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-surface">
            <ArrowSquareOut size={16} />
            Open queue board
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

      </div>
    </div>
  );
}
