'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import {
  ArrowClockwise,
  QrCode,
  Ticket,
} from '@phosphor-icons/react';
import { Header } from '@/components/Header';
import { hasStoredSession } from '@/lib/auth-store';
import { extractApiMessages } from '@/lib/api-errors';
import { ticketsService } from '@/lib/services/tickets.service';
import type { AudienceTicket } from '@/lib/types';

type LoadState = 'loading' | 'ready' | 'empty' | 'error';

const statusMap: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: 'ACTIVE', className: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-50' },
  USED: { label: 'CHECKED_IN', className: 'border-white/10 bg-white/5 text-white' },
  CANCELLED: { label: 'CANCELLED', className: 'border-rose-400/20 bg-rose-400/10 text-rose-50' },
  TRANSFERRED: { label: 'TRANSFERRED', className: 'border-amber-400/20 bg-amber-400/10 text-amber-100' },
};

function hashToken(token: string) {
  let hash = 2166136261;
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return hash >>> 0;
}

function buildMatrix(token: string, size = 21) {
  const totalCells = size * size;
  const seed = hashToken(token);
  const matrix = Array.from({ length: totalCells }, (_, index) => {
    const rotated = ((seed >> (index % 24)) ^ (seed * (index + 1))) >>> 0;
    return (rotated & 1) === 1;
  });

  const paintFinder = (startRow: number, startColumn: number) => {
    for (let row = 0; row < 7; row += 1) {
      for (let column = 0; column < 7; column += 1) {
        const globalRow = startRow + row;
        const globalColumn = startColumn + column;
        const index = globalRow * size + globalColumn;
        const isBorder = row === 0 || row === 6 || column === 0 || column === 6;
        const isCenter = row >= 2 && row <= 4 && column >= 2 && column <= 4;
        matrix[index] = isBorder || isCenter;
      }
    }
  };

  paintFinder(0, 0);
  paintFinder(0, size - 7);
  paintFinder(size - 7, 0);

  return matrix;
}

function QrPreview({ token }: Readonly<{ token: string }>) {
  const matrix = useMemo(() => buildMatrix(token), [token]);

  return (
    <div className="rounded-[28px] border border-white/10 bg-zinc-950 p-4">
      <div className="mx-auto grid aspect-square max-w-[280px] gap-[2px]" style={{ gridTemplateColumns: 'repeat(21, minmax(0, 1fr))' }}>
        {matrix.map((filled, index) => (
          <span
            key={`${token}-${String(index)}`}
            className={`aspect-square rounded-[1px] ${filled ? 'bg-white' : 'bg-white/10'}`}
          />
        ))}
      </div>
      <p className="mt-4 text-center text-xs uppercase tracking-[0.22em] text-white/55">
        Mã QR vé điện tử
      </p>
    </div>
  );
}

function formatDate(value?: string) {
  if (!value) return 'Đang cập nhật';
  const formatter = new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  return formatter.format(new Date(value));
}

function formatTicketStatus(status: AudienceTicket['status']) {
  return statusMap[status] ?? { label: status, className: 'border-white/10 bg-white/5 text-white' };
}

export default function TicketsPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<AudienceTicket[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [errorMessage, setErrorMessage] = useState('Không thể tải danh sách vé.');

  const loadTickets = async () => {
    setState('loading');
    try {
      const data = await ticketsService.getMyTickets();
      setTickets(data);
      setState(data.length === 0 ? 'empty' : 'ready');
    } catch (error: unknown) {
      setTickets([]);
      setErrorMessage(extractApiMessages(error, 'Không thể kết nối API ticket.').join(' '));
      setState('error');
    }
  };

  const summary = useMemo(
    () => ({
      active: tickets.filter((ticket) => ticket.status === 'ACTIVE').length,
      checkedIn: tickets.filter((ticket) => ticket.status === 'USED').length,
      cancelled: tickets.filter((ticket) => ticket.status === 'CANCELLED').length,
    }),
    [tickets],
  );

  useEffect(() => {
    if (!hasStoredSession()) {
      router.replace('/login?next=/tickets');
      return;
    }

    const timer = window.setTimeout(() => {
      void loadTickets();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen bg-[#050816] text-white selection:bg-amber-300/30">
      <Header />

      <main className="relative overflow-hidden pt-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(249,115,22,0.22),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.18),_transparent_28%),linear-gradient(180deg,_#020617_0%,_#050816_45%,_#09090b_100%)]" />
        <div className="absolute inset-x-0 top-0 h-[420px] bg-[linear-gradient(180deg,rgba(255,255,255,0.06),transparent)]" />

        <section className="relative mx-auto max-w-[1400px] px-6 pb-24 pt-12 lg:px-8 lg:pt-16">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-3xl"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium uppercase tracking-[0.22em] text-white/75 backdrop-blur-md">
              <QrCode size={14} />
              Vé của tôi
            </div>
            <h1 className="mt-5 text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl">
              Kho vé điện tử của bạn
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/72 sm:text-lg">
              Xem lại toàn bộ vé đã phát hành, trạng thái sử dụng và mã QR cho từng lần tham dự.
            </p>
          </motion.div>

          {state === 'loading' && (
            <div className="mt-10 rounded-[32px] border border-white/10 bg-white/5 p-10 text-center backdrop-blur-xl">
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white" />
              <p className="mt-4 text-sm text-white/65">Đang tải tickets của bạn...</p>
            </div>
          )}

          {state === 'error' && (
            <div className="mt-10 rounded-[32px] border border-rose-500/20 bg-rose-500/10 p-8 text-center backdrop-blur-xl">
              <h2 className="text-2xl font-semibold text-white">Không tải được vé</h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/68">{errorMessage}</p>
              <button
                onClick={() => void loadTickets()}
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-zinc-950 transition-transform hover:-translate-y-0.5"
              >
                <ArrowClockwise size={16} weight="bold" />
                Thử lại
              </button>
            </div>
          )}

          {state === 'empty' && (
            <div className="mt-10 rounded-[32px] border border-white/10 bg-white/5 p-10 text-center backdrop-blur-xl">
              <Ticket size={32} className="mx-auto text-white/65" />
              <h2 className="mt-5 text-2xl font-semibold text-white">Chưa có vé nào</h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/68">
                Sau khi thanh toán thành công, vé điện tử của bạn sẽ xuất hiện tại đây.
              </p>
              <Link
                href="/concerts"
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-zinc-950 transition-transform hover:-translate-y-0.5"
              >
                <Ticket size={16} />
                Browse concerts
              </Link>
            </div>
          )}

          {state === 'ready' && (
            <div className="mt-10 grid gap-6">
              <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/55">Tổng quan</p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Vé hiện có</h2>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Active</p>
                      <p className="mt-1 text-xl font-semibold text-white">{summary.active}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Checked in</p>
                      <p className="mt-1 text-xl font-semibold text-white">{summary.checkedIn}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Cancelled</p>
                      <p className="mt-1 text-xl font-semibold text-white">{summary.cancelled}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-2">
                {tickets.map((ticket) => {
                  const badge = formatTicketStatus(ticket.status);
                  return (
                    <article
                      key={ticket.id}
                      className="rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.18)] backdrop-blur-xl"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/55">Ticket</p>
                          <h3 className="mt-2 break-all text-xl font-semibold tracking-tight text-white">{ticket.id}</h3>
                        </div>
                        <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${badge.className}`}>
                          {badge.label}
                        </span>
                      </div>

                      <div className="mt-5 grid gap-5 lg:grid-cols-[220px_1fr]">
                        <QrPreview token={ticket.qrToken} />
                        <div className="space-y-4">
                          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Concert / Ticket Type</p>
                            <p className="mt-2 text-sm font-semibold text-white">{ticket.concertId}</p>
                            <p className="mt-1 text-sm text-white/65">{ticket.ticketTypeId}</p>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">QR token</p>
                            <p className="mt-2 break-all font-mono text-xs leading-6 text-white/75">{ticket.qrToken}</p>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Created</p>
                            <p className="mt-2 text-sm font-semibold text-white">{formatDate(ticket.createdAt)}</p>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
