'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion } from 'motion/react';
import {
  ArrowClockwise,
  CheckCircle,
  Clock,
  CreditCard,
  Timer,
  WarningCircle,
} from '@phosphor-icons/react';
import { Header } from '@/components/Header';
import { extractApiMessages } from '@/lib/api-errors';
import { ordersService } from '@/lib/services/orders.service';
import type { AudienceOrder, PaymentReturnStatus } from '@/lib/types';

const statusConfig: Record<PaymentReturnStatus, { title: string; description: string; icon: React.ReactNode; accent: string }> = {
  pending: {
    title: 'Thanh toán đang chờ xử lý',
    description: 'Backend chưa xác nhận xong trạng thái giao dịch hoặc gateway đang callback.',
    icon: <Clock size={24} />,
    accent: 'border-amber-400/20 bg-amber-400/10 text-amber-100',
  },
  success: {
    title: 'Thanh toán thành công',
    description: 'Backend đã xác nhận order và có thể phát hành vé.',
    icon: <CheckCircle size={24} />,
    accent: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-50',
  },
  failed: {
    title: 'Thanh toán thất bại',
    description: 'Gateway hoặc backend trả trạng thái không thành công cho order này.',
    icon: <WarningCircle size={24} />,
    accent: 'border-rose-400/20 bg-rose-400/10 text-rose-50',
  },
  expired: {
    title: 'Order đã hết hạn',
    description: 'Hạn giữ vé đã trôi qua trước khi payment xác nhận.',
    icon: <Timer size={24} />,
    accent: 'border-white/10 bg-white/5 text-white',
  },
};

function normalizeStatus(value: string | null): PaymentReturnStatus {
  const lower = value?.toLowerCase();
  if (lower === 'success' || lower === 'paid' || lower === 'confirmed') return 'success';
  if (lower === 'failed' || lower === 'failure' || lower === 'cancelled') return 'failed';
  if (lower === 'expired' || lower === 'timeout') return 'expired';
  return 'pending';
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
}

function PaymentOrderSummary({ order }: Readonly<{ order: AudienceOrder }>) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Order ID</p>
        <p className="mt-2 break-all text-sm font-semibold text-white">{order.id}</p>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Status</p>
        <p className="mt-2 text-sm font-semibold text-white">{order.status}</p>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Quantity</p>
        <p className="mt-2 text-sm font-semibold text-white">{order.quantity}</p>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Total</p>
        <p className="mt-2 text-sm font-semibold text-white">{formatMoney(Number(order.totalAmount))}</p>
      </div>
    </div>
  );
}

export default function PaymentReturnPage() {
  const searchParams = useSearchParams();
  const paymentStatus = normalizeStatus(searchParams.get('status') ?? searchParams.get('paymentStatus') ?? searchParams.get('orderStatus'));
  const orderId = searchParams.get('orderId') ?? searchParams.get('order_id') ?? '';
  const paymentId = searchParams.get('paymentId') ?? searchParams.get('payment_id') ?? '';
  const message = searchParams.get('message') ?? searchParams.get('error') ?? '';
  const [order, setOrder] = useState<AudienceOrder | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(orderId));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadOrder = useCallback(async () => {
    if (!orderId) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await ordersService.getOrderById(orderId);
      setOrder(data);
    } catch (error: unknown) {
      setErrorMessage(extractApiMessages(error, 'Không thể tải lại trạng thái order.').join(' '));
    } finally {
      setIsLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (orderId) {
      const timer = window.setTimeout(() => {
        void loadOrder();
      }, 0);

      return () => window.clearTimeout(timer);
    }
  }, [loadOrder, orderId]);

  const derivedStatus = useMemo<PaymentReturnStatus>(() => {
    if (order?.status === 'PAID') return 'success';
    if (order?.status === 'EXPIRED') return 'expired';
    if (order?.status === 'PAYMENT_FAILED') return 'failed';
    if (order?.status === 'PENDING_PAYMENT') return 'pending';
    return paymentStatus;
  }, [order?.status, paymentStatus]);

  const derivedConfig = statusConfig[derivedStatus];

  return (
    <div className="min-h-screen bg-[#050816] text-white selection:bg-amber-300/30">
      <Header />

      <main className="relative overflow-hidden pt-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(249,115,22,0.22),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.18),_transparent_28%),linear-gradient(180deg,_#020617_0%,_#050816_45%,_#09090b_100%)]" />
        <div className="absolute inset-x-0 top-0 h-[420px] bg-[linear-gradient(180deg,rgba(255,255,255,0.06),transparent)]" />

        <section className="relative mx-auto max-w-4xl px-6 pb-24 pt-12 lg:px-8 lg:pt-16">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className={`rounded-[32px] border p-8 shadow-[0_24px_80px_rgba(15,23,42,0.22)] backdrop-blur-xl ${derivedConfig.accent}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-2xl">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/10">
                    {derivedConfig.icon}
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/60">Payment return</p>
                    <h1 className="mt-1 text-3xl font-semibold tracking-tight">{derivedConfig.title}</h1>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-6 text-white/75">{derivedConfig.description}</p>
                {message && <p className="mt-3 text-sm leading-6 text-white/85">{message}</p>}
                {paymentId && <p className="mt-3 text-xs uppercase tracking-[0.22em] text-white/55">Payment ID: {paymentId}</p>}
              </div>
              <Link
                href="/orders"
                className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-zinc-950 transition-transform hover:-translate-y-0.5"
              >
                <CreditCard size={16} />
                Open orders
              </Link>
            </div>
          </motion.div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.18)] backdrop-blur-xl">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/55">Authoritative check</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Re-check backend order status</h2>
                </div>
                <button
                  type="button"
                  onClick={() => void loadOrder()}
                  disabled={!orderId || isLoading}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ArrowClockwise size={16} />
                  {isLoading ? 'Refreshing...' : 'Recheck'}
                </button>
              </div>

              <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-white/75">
                {orderId ? (
                  <p>
                    The frontend never simulates success or failure. It reads the query parameters from the return URL and, when possible, pulls the latest order state from the backend.
                  </p>
                ) : (
                  <p>
                    No order ID is present in the return URL. The page can still show the payment status from the query string, but it cannot verify a specific order without the backend reference.
                  </p>
                )}
              </div>

              {errorMessage && (
                <div className="mt-5 rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm leading-6 text-rose-50">
                  {errorMessage}
                </div>
              )}

              {order && (
                <div className="mt-5">
                  <PaymentOrderSummary order={order} />
                </div>
              )}

              {!order && isLoading && orderId && (
                <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
                  Loading order from backend...
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.18)] backdrop-blur-xl">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/55">What happens next</p>
                <div className="mt-4 space-y-3 text-sm leading-6 text-white/70">
                  <p>• If the status is pending, wait for the gateway or backend callback.</p>
                  <p>• If the status is success, the order should be eligible for ticket issuance.</p>
                  <p>• If the status is expired or failed, return to the concert page and create a new order.</p>
                </div>
              </div>

              <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.18)] backdrop-blur-xl">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/55">Quick links</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link href="/concerts" className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-zinc-950 transition-transform hover:-translate-y-0.5">
                    Back to concerts
                  </Link>
                  <Link href="/tickets" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10">
                    My tickets
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-[32px] border border-white/10 bg-white/5 p-6 text-sm leading-6 text-white/70 shadow-[0_24px_80px_rgba(15,23,42,0.18)] backdrop-blur-xl">
            <p className="font-semibold text-white">Status used on this page</p>
            <p className="mt-2">
              The return URL accepts <span className="font-medium text-white">pending</span>, <span className="font-medium text-white">success</span>, <span className="font-medium text-white">failed</span>, and <span className="font-medium text-white">expired</span>. The order snapshot from the backend takes precedence whenever the current user is allowed to read it.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
