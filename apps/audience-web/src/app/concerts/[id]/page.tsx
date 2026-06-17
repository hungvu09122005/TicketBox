'use client';
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'motion/react';
import {
  ArrowClockwise,
  CalendarBlank,
  CurrencyDollar,
  Ticket,
  WarningCircle,
} from '@phosphor-icons/react';
import { Header } from '@/components/Header';
import { hasStoredSession } from '@/lib/auth-store';
import { extractApiMessages } from '@/lib/api-errors';
import { concertService } from '@/lib/services/concert.service';
import { ticketTypesService } from '@/lib/services/ticket-types.service';
import { ordersService } from '@/lib/services/orders.service';
import { paymentsService } from '@/lib/services/payments.service';
import type { PublicConcert, TicketTypeAvailability } from '@/lib/types';

type LoadState = 'loading' | 'ready' | 'empty' | 'error';

const dateFormatter = new Intl.DateTimeFormat('vi-VN', {
  weekday: 'short',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const timeFormatter = new Intl.DateTimeFormat('vi-VN', {
  hour: '2-digit',
  minute: '2-digit',
});

const moneyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

function formatSchedule(concert: PublicConcert) {
  const start = new Date(concert.startsAt);
  const end = new Date(concert.endsAt);
  return `${dateFormatter.format(start)} • ${timeFormatter.format(start)} - ${timeFormatter.format(end)}`;
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Đang cập nhật';
  return `${dateFormatter.format(new Date(value))} • ${timeFormatter.format(new Date(value))}`;
}

function getUuidFallback() {
  return globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function ConcertDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const concertId = params.id;
  const hasSession = hasStoredSession();

  const [concert, setConcert] = useState<PublicConcert | null>(null);
  const [ticketTypes, setTicketTypes] = useState<TicketTypeAvailability[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [errorMessage, setErrorMessage] = useState('Không thể tải thông tin concert.');
  const [selectedTicketTypeId, setSelectedTicketTypeId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutNote, setCheckoutNote] = useState<string | null>(null);
  const [orderSummary, setOrderSummary] = useState<{
    orderId: string;
    paymentUrl?: string | null;
    paymentId?: string;
    status?: string;
    message?: string;
  } | null>(null);

  const selectedTicketType = useMemo(
    () => ticketTypes.find((ticketType) => ticketType.id === selectedTicketTypeId) ?? null,
    [selectedTicketTypeId, ticketTypes],
  );

  const loadConcert = useCallback(async () => {
    setState('loading');
    setCheckoutNote(null);
    try {
      const [concertData, availabilityData] = await Promise.all([
        concertService.getConcert(concertId),
        ticketTypesService.getAvailability(concertId),
      ]);

      setConcert(concertData);
      setTicketTypes(availabilityData);

      const firstAvailable = availabilityData.find((ticketType) => ticketType.status === 'AVAILABLE') ?? availabilityData[0] ?? null;
      setSelectedTicketTypeId(firstAvailable?.id ?? '');
      setQuantity(1);
      setState('ready');
    } catch (error: unknown) {
      setConcert(null);
      setTicketTypes([]);
      setState('error');
      setErrorMessage(extractApiMessages(error, 'Không thể kết nối API concert hoặc ticket type.').join(' '));
    }
  }, [concertId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadConcert();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadConcert]);

  const handleCheckout = async () => {
    if (!concert || !selectedTicketType) {
      return;
    }

    if (!hasSession) {
      router.push(`/login?next=${encodeURIComponent(`/concerts/${concertId}`)}`);
      return;
    }

    if (selectedTicketType.availableQuantity <= 0) {
      setCheckoutNote('Hạng vé này đã hết vé. Vui lòng chọn hạng khác.');
      return;
    }

    setIsSubmitting(true);
    setCheckoutNote(null);
    setOrderSummary(null);

    const idempotencyKey = getUuidFallback();

    try {
      const order = await ordersService.createOrder(
        {
          concertId: concert.id,
          ticketTypeId: selectedTicketType.id,
          quantity,
        },
        idempotencyKey,
      );

      const payment = await paymentsService.initiatePayment(order.id, idempotencyKey);
      setOrderSummary({
        orderId: order.id,
        paymentUrl: payment.paymentUrl ?? null,
        paymentId: payment.paymentId,
        status: payment.status,
        message: payment.message,
      });

      if (payment.paymentUrl) {
        setCheckoutNote('Đang chuyển bạn tới cổng thanh toán sandbox thật.');
        window.setTimeout(() => {
          window.location.assign(payment.paymentUrl as string);
        }, 700);
      } else {
        setCheckoutNote('Đơn hàng đã được tạo. Hãy kiểm tra trạng thái thanh toán ở trang kết quả.');
      }
    } catch (error: unknown) {
      setCheckoutNote(extractApiMessages(error, 'Không thể tạo order hoặc khởi tạo thanh toán.').join(' '));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050816] text-white selection:bg-amber-300/30">
      <Header />

      <main className="relative overflow-hidden pt-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(249,115,22,0.22),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.18),_transparent_28%),linear-gradient(180deg,_#020617_0%,_#050816_45%,_#09090b_100%)]" />
        <div className="absolute inset-x-0 top-0 h-[420px] bg-[linear-gradient(180deg,rgba(255,255,255,0.06),transparent)]" />

        <section className="relative mx-auto max-w-[1400px] px-6 pb-24 pt-10 lg:px-8 lg:pt-14">
          {state === 'loading' && (
            <div className="rounded-[32px] border border-white/10 bg-white/5 p-10 text-center backdrop-blur-xl">
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white" />
              <p className="mt-4 text-sm text-white/65">Đang tải concert và availability thật từ API...</p>
            </div>
          )}

          {state === 'error' && (
            <div className="rounded-[32px] border border-rose-500/20 bg-rose-500/10 p-8 text-center backdrop-blur-xl">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-rose-200">Error</p>
              <h1 className="mt-3 text-2xl font-semibold text-white">Không tải được concert</h1>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/68">{errorMessage}</p>
              <button
                onClick={() => void loadConcert()}
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-zinc-950 transition-transform hover:-translate-y-0.5"
              >
                <ArrowClockwise size={16} weight="bold" />
                Thử lại
              </button>
            </div>
          )}

          {state === 'ready' && concert && (
            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <motion.section
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden rounded-[32px] border border-white/10 bg-white/5 shadow-[0_24px_80px_rgba(15,23,42,0.22)] backdrop-blur-xl"
              >
                <div className="relative aspect-[16/9] overflow-hidden bg-zinc-900">
                  {concert.bannerUrl ? (
                    <img
                      src={concert.bannerUrl}
                      alt={concert.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,#f97316_0%,#0f172a_42%,#020617_100%)]">
                      <Ticket size={72} weight="light" className="text-white/70" />
                    </div>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/30 to-transparent" />

                  <div className="absolute left-5 top-5 flex items-center gap-2 rounded-full border border-white/15 bg-black/30 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/90 backdrop-blur-md">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    {concert.status}
                  </div>

                  <div className="absolute inset-x-0 bottom-0 p-6">
                    <p className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-white/72">
                      <CalendarBlank size={14} />
                      {formatSchedule(concert)}
                    </p>
                    <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                      {concert.name}
                    </h1>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-white/72 sm:text-base">
                      {concert.description || 'Đang cập nhật mô tả chương trình.'}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 p-6 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Artist</p>
                    <p className="mt-2 text-sm font-semibold text-white">{concert.artist.name}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Venue</p>
                    <p className="mt-2 line-clamp-2 text-sm font-semibold text-white">{concert.venue || 'Địa điểm đang cập nhật'}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Sale window</p>
                    <p className="mt-2 text-sm font-semibold text-white">{formatDateTime(concert.saleStartsAt)}</p>
                    <p className="mt-1 text-xs text-white/60">to {formatDateTime(concert.saleEndsAt)}</p>
                  </div>
                </div>

                <div className="border-t border-white/10 p-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                      <WarningCircle size={22} className="text-amber-300" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Idempotency and double-submit protection</p>
                      <p className="text-sm leading-6 text-white/65">
                        Every checkout request sends a UUID through `Idempotency-Key` and the submit button is disabled while the request is in flight.
                      </p>
                    </div>
                  </div>
                </div>
              </motion.section>

              <motion.aside
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-6"
              >
                <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.18)] backdrop-blur-xl">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/55">Checkout</p>
                      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Chọn hạng vé và thanh toán</h2>
                    </div>
                    <CurrencyDollar size={28} className="text-emerald-300" />
                  </div>

                  {!hasSession && (
                    <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm leading-6 text-amber-100">
                      Bạn cần đăng nhập để tạo order và khởi tạo payment thật.
                      <div className="mt-3">
                        <Link
                          href={`/login?next=${encodeURIComponent(`/concerts/${concertId}`)}`}
                          className="inline-flex items-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-zinc-950 transition-transform hover:-translate-y-0.5"
                        >
                          Đăng nhập để đặt vé
                        </Link>
                      </div>
                    </div>
                  )}

                  <div className="mt-5 space-y-3">
                    {ticketTypes.length === 0 ? (
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-white/70">
                        Chưa có ticket type nào được cấu hình cho concert này.
                      </div>
                    ) : (
                      ticketTypes.map((ticketType) => {
                        const isSelected = ticketType.id === selectedTicketTypeId;
                        const isSoldOut = ticketType.status === 'SOLD_OUT';
                        return (
                          <button
                            key={ticketType.id}
                            type="button"
                            onClick={() => {
                              setSelectedTicketTypeId(ticketType.id);
                              setQuantity(1);
                            }}
                            className={`w-full rounded-2xl border p-4 text-left transition-colors ${
                              isSelected
                                ? 'border-emerald-400/40 bg-emerald-400/10'
                                : 'border-white/10 bg-white/5 hover:border-white/20'
                            } ${isSoldOut ? 'opacity-70' : ''}`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <p className="text-base font-semibold text-white">{ticketType.name}</p>
                                <p className="mt-1 text-sm text-white/70">
                                  {moneyFormatter.format(Number(ticketType.price))} · Max {ticketType.maxPerUser}/user
                                </p>
                              </div>
                              <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                                ticketType.status === 'AVAILABLE'
                                  ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100'
                                  : 'border-white/10 bg-white/5 text-white/55'
                              }`}>
                                {ticketType.availableQuantity} left
                              </span>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>

                  <div className="mt-6 grid gap-4 sm:grid-cols-[1fr_160px]">
                    <div>
                      <label htmlFor="quantity" className="block text-sm font-medium text-white">
                        Quantity
                      </label>
                      <input
                        id="quantity"
                        type="number"
                        min={1}
                        max={selectedTicketType ? Math.min(selectedTicketType.maxPerUser, selectedTicketType.availableQuantity || 1) : 1}
                        value={quantity}
                        onChange={(event) => {
                          const nextValue = Number(event.target.value);
                          if (!selectedTicketType) {
                            setQuantity(nextValue);
                            return;
                          }

                          const maxQuantity = Math.min(
                            selectedTicketType.maxPerUser,
                            Math.max(selectedTicketType.availableQuantity, 1),
                          );
                          setQuantity(Math.min(Math.max(nextValue || 1, 1), maxQuantity));
                        }}
                        className="mt-2 w-full rounded-2xl border border-white/10 bg-background px-4 py-3 text-sm text-primary outline-none transition-colors placeholder:text-muted focus:border-primary"
                      />
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Subtotal</p>
                      <p className="mt-2 text-lg font-semibold text-white">
                        {selectedTicketType ? moneyFormatter.format(Number(selectedTicketType.price) * quantity) : '0 đ'}
                      </p>
                      <p className="mt-1 text-xs text-white/60">
                        Idempotency-Key is generated client-side per submit.
                      </p>
                    </div>
                  </div>

                  {checkoutNote && (
                    <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-white/75">
                      {checkoutNote}
                    </div>
                  )}

                  {orderSummary && (
                    <div className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm leading-6 text-emerald-50">
                      <p className="font-semibold">Order created: {orderSummary.orderId}</p>
                      <p className="mt-1">Payment status: {orderSummary.status ?? 'PENDING'}</p>
                      {orderSummary.paymentId && <p className="mt-1">Payment ID: {orderSummary.paymentId}</p>}
                      {orderSummary.message && <p className="mt-1">{orderSummary.message}</p>}
                      {!orderSummary.paymentUrl && (
                        <div className="mt-3">
                          <Link
                            href={`/payments/return?orderId=${encodeURIComponent(orderSummary.orderId)}&status=pending`}
                            className="inline-flex items-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-zinc-950 transition-transform hover:-translate-y-0.5"
                          >
                            Open payment result
                          </Link>
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => void handleCheckout()}
                    disabled={isSubmitting || !selectedTicketType || ticketTypes.length === 0 || selectedTicketType?.availableQuantity === 0}
                    className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-zinc-950 transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                  >
                    {isSubmitting ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-400 border-t-zinc-950" />
                        Đang xử lý...
                      </>
                    ) : (
                      <>
                        <Ticket size={18} weight="bold" />
                        Create order and initiate payment
                      </>
                    )}
                  </button>
                </div>

                <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.18)] backdrop-blur-xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/55">Availability notes</p>
                  <div className="mt-4 space-y-3 text-sm leading-6 text-white/70">
                    <p>• The page reads live ticket availability from the public API.</p>
                    <p>• The checkout request is protected with a client-generated UUID header.</p>
                    <p>• If paymentUrl is returned, the browser is redirected to the sandbox gateway instead of faking success in the frontend.</p>
                  </div>
                </div>
              </motion.aside>
            </div>
          )}

          {state === 'empty' && (
            <div className="rounded-[32px] border border-white/10 bg-white/5 p-10 text-center backdrop-blur-xl">
              <h2 className="text-2xl font-semibold text-white">Chưa có dữ liệu concert</h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/68">
                Khi backend trả về concert PUBLISHED thật cùng availability, trang chi tiết này sẽ hiển thị toàn bộ checkout flow.
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
