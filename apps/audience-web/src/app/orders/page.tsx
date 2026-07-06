'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import {
  ArrowClockwise,
  CalendarBlank,
  CurrencyDollar,
  Receipt,
  Ticket,
  Timer,
} from '@phosphor-icons/react';
import { Header } from '@/components/Header';
import { hasStoredSession } from '@/lib/auth-store';
import { extractApiMessages } from '@/lib/api-errors';
import { ordersService } from '@/lib/services/orders.service';
import { paymentsService } from '@/lib/services/payments.service';
import type { AudienceOrder } from '@/lib/types';

type LoadState = 'loading' | 'ready' | 'empty' | 'error';

const moneyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

const statusClasses: Record<AudienceOrder['status'], string> = {
  PENDING_PAYMENT: 'border-amber-400/20 bg-amber-400/10 text-amber-100',
  PAID: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-50',
  EXPIRED: 'border-white/10 bg-white/5 text-white',
  PAYMENT_FAILED: 'border-rose-400/20 bg-rose-400/10 text-rose-50',
};

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

function OrderCard({
  order,
}: Readonly<{
  order: AudienceOrder;
}>) {
  const [isOpeningPayment, setIsOpeningPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const handleOpenSandboxPayment = async () => {
    try {
      setIsOpeningPayment(true);
      setPaymentError(null);
      const result = await paymentsService.initiatePayment(order.id, crypto.randomUUID());
      const paymentUrl = result.paymentUrl ?? result.redirectUrl ?? result.url ?? null;

      if (!paymentUrl) {
        setPaymentError('Backend chưa trả payment URL cho order này.');
        return;
      }

      window.location.assign(paymentUrl);
    } catch (error) {
      setPaymentError(extractApiMessages(error, 'Không thể mở cổng thanh toán.').join(' '));
    } finally {
      setIsOpeningPayment(false);
    }
  };

  return (
    <article className="rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.18)] backdrop-blur-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/55">Order</p>
          <h3 className="mt-2 text-xl font-semibold tracking-tight text-white">{order.id}</h3>
        </div>
        <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${statusClasses[order.status]}`}>
          {order.status}
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Concert / Ticket Type</p>
          <p className="mt-2 text-sm font-semibold text-white">{order.concertId}</p>
          <p className="mt-1 text-sm text-white/65">{order.ticketTypeId}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Quantity</p>
          <p className="mt-2 text-sm font-semibold text-white">{order.quantity}</p>
          <p className="mt-1 text-sm text-white/65">Total: {moneyFormatter.format(Number(order.totalAmount))}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Created</p>
          <p className="mt-2 text-sm font-semibold text-white">{formatDate(order.createdAt)}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Hold expires</p>
          <p className="mt-2 text-sm font-semibold text-white">{formatDate(order.expiresAt)}</p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {order.status === 'PENDING_PAYMENT' && (
          <>
            <button
              type="button"
              onClick={() => void handleOpenSandboxPayment()}
              disabled={isOpeningPayment}
              className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-zinc-950 transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <CurrencyDollar size={16} />
              {isOpeningPayment ? 'Đang mở thanh toán...' : 'Mở thanh toán'}
            </button>
            <Link
              href={`/payments/return?orderId=${encodeURIComponent(order.id)}&status=pending`}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              <CurrencyDollar size={16} />
              Kiểm tra thanh toán
            </Link>
          </>
        )}
        <Link
          href={`/concerts/${order.concertId}`}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10"
        >
          <Ticket size={16} />
          Quay lại sự kiện
        </Link>
      </div>

      {paymentError ? (
        <p className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm leading-6 text-rose-50">
          {paymentError}
        </p>
      ) : null}
    </article>
  );
}

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<AudienceOrder[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [errorMessage, setErrorMessage] = useState('Không thể tải danh sách order.');

  const loadOrders = async () => {
    setState('loading');
    try {
      const data = await ordersService.getMyOrders();
      setOrders(data);
      setState(data.length === 0 ? 'empty' : 'ready');
    } catch (error: unknown) {
      setOrders([]);
      setErrorMessage(extractApiMessages(error, 'Không thể kết nối API order.').join(' '));
      setState('error');
    }
  };

  useEffect(() => {
    if (!hasStoredSession()) {
      router.replace('/login?next=/orders');
      return;
    }

    const timer = window.setTimeout(() => {
      void loadOrders();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [router]);

  const activeOrders = useMemo(() => orders.filter((order) => order.status === 'PENDING_PAYMENT'), [orders]);
  const orderedOrders = useMemo(
    () =>
      [...orders].sort((left, right) => {
        if (left.status === right.status) {
          return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
        }

        if (left.status === 'PENDING_PAYMENT') return -1;
        if (right.status === 'PENDING_PAYMENT') return 1;
        if (left.status === 'PAID') return -1;
        if (right.status === 'PAID') return 1;
        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      }),
    [orders],
  );

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
              <Receipt size={14} />
              Đơn hàng của tôi
            </div>
            <h1 className="mt-5 text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl">
              Lịch sử đơn hàng của bạn
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/72 sm:text-lg">
              Theo dõi các đơn hàng đang chờ thanh toán, đã thanh toán hoặc đã hết hạn trong cùng một nơi.
            </p>
          </motion.div>

          {state === 'loading' && (
            <div className="mt-10 rounded-[32px] border border-white/10 bg-white/5 p-10 text-center backdrop-blur-xl">
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white" />
              <p className="mt-4 text-sm text-white/65">Đang tải orders của bạn...</p>
            </div>
          )}

          {state === 'error' && (
            <div className="mt-10 rounded-[32px] border border-rose-500/20 bg-rose-500/10 p-8 text-center backdrop-blur-xl">
              <h2 className="text-2xl font-semibold text-white">Không tải được order</h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/68">{errorMessage}</p>
              <button
                onClick={() => void loadOrders()}
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-zinc-950 transition-transform hover:-translate-y-0.5"
              >
                <ArrowClockwise size={16} weight="bold" />
                Thử lại
              </button>
            </div>
          )}

          {state === 'empty' && (
            <div className="mt-10 rounded-[32px] border border-white/10 bg-white/5 p-10 text-center backdrop-blur-xl">
              <Timer size={32} className="mx-auto text-white/65" />
              <h2 className="mt-5 text-2xl font-semibold text-white">Chưa có order nào</h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/68">
                Khi bạn đặt vé, đơn hàng sẽ xuất hiện ở đây để bạn tiện theo dõi trạng thái thanh toán.
              </p>
              <Link
                href="/concerts"
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-zinc-950 transition-transform hover:-translate-y-0.5"
              >
                <CalendarBlank size={16} />
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
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Đơn hàng hiện có</h2>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-white/55">Chờ thanh toán</p>
                      <p className="mt-1 text-xl font-semibold text-white">{activeOrders.length}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void loadOrders()}
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                    >
                      <ArrowClockwise size={16} />
                      Làm mới
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid gap-6">
                {orderedOrders.map((order) => (
                  <OrderCard key={order.id} order={order} />
                ))}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
