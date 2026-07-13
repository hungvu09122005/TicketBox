'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
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
import { paymentsService } from '@/lib/services/payments.service';
import type { AudienceOrder, PaymentReturnStatus } from '@/lib/types';

const statusConfig: Record<PaymentReturnStatus, { title: string; description: string; icon: React.ReactNode; accent: string }> = {
  pending: {
    title: 'Thanh toán đang chờ xử lý',
    description: 'Giao dịch của bạn đang được xử lý. Vui lòng đợi thêm trong giây lát.',
    icon: <Clock size={24} />,
    accent: 'border-amber-400/20 bg-amber-400/10 text-amber-100',
  },
  success: {
    title: 'Thanh toán thành công',
    description: 'Đơn hàng đã được xác nhận thành công và đang sẵn sàng phát hành vé.',
    icon: <CheckCircle size={24} />,
    accent: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-50',
  },
  failed: {
    title: 'Thanh toán thất bại',
    description: 'Giao dịch chưa hoàn tất thành công cho đơn hàng này.',
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

function PaymentReturnPageContent() {
  const searchParams = useSearchParams();
  const paymentStatus = normalizeStatus(searchParams.get('status') ?? searchParams.get('paymentStatus') ?? searchParams.get('orderStatus'));
  const vnpTxnRef = searchParams.get('vnp_TxnRef');
  const orderId = searchParams.get('orderId') ?? searchParams.get('order_id') ?? vnpTxnRef ?? '';
  const paymentId = searchParams.get('paymentId') ?? searchParams.get('payment_id') ?? '';
  const message = searchParams.get('message') ?? searchParams.get('error') ?? '';
  const [order, setOrder] = useState<AudienceOrder | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(orderId));
  const [isProcessingCallback, setIsProcessingCallback] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isOpeningPayment, setIsOpeningPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

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
    let active = true;

    const init = async () => {
      if (!orderId) return;

      setIsLoading(true);
      setErrorMessage(null);

      try {
        if (vnpTxnRef) {
          setIsProcessingCallback(true);
          const queryString = window.location.search.substring(1);
          await paymentsService.handleVnpayCallback(queryString);
        }
        
        const data = await ordersService.getOrderById(orderId);
        if (active) {
          setOrder(data);
        }
      } catch (error: unknown) {
        if (active) {
          setErrorMessage(extractApiMessages(error, 'Không thể xử lý thông tin đơn hàng.').join(' '));
        }
      } finally {
        if (active) {
          setIsLoading(false);
          setIsProcessingCallback(false);
        }
      }
    };

    void init();

    return () => {
      active = false;
    };
  }, [orderId, vnpTxnRef]);


  const derivedStatus = useMemo<PaymentReturnStatus>(() => {
    if (order?.status === 'PAID') return 'success';
    if (order?.status === 'EXPIRED') return 'expired';
    if (order?.status === 'PAYMENT_FAILED') return 'failed';
    if (order?.status === 'PENDING_PAYMENT') return 'pending';
    return paymentStatus;
  }, [order?.status, paymentStatus]);

  const derivedConfig = statusConfig[derivedStatus];
  const statusPills: Record<PaymentReturnStatus, string> = {
    pending: 'đang chờ xử lý',
    success: 'đã thanh toán thành công',
    failed: 'thanh toán chưa thành công',
    expired: 'đơn đã hết hạn giữ vé',
  };

  useEffect(() => {
    if (!orderId || derivedStatus !== 'pending') {
      return;
    }

    const timer = window.setInterval(() => {
      void loadOrder();
    }, 15000);

    return () => window.clearInterval(timer);
  }, [derivedStatus, loadOrder, orderId]);

  const handleOpenSandboxPayment = async () => {
    if (!orderId) {
      return;
    }

    try {
      setIsOpeningPayment(true);
      setPaymentError(null);
      const result = await paymentsService.initiatePayment(orderId, crypto.randomUUID());
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
                <p className="mt-3 inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.18em] text-white/65">
                  {statusPills[derivedStatus]}
                </p>
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

          <div className="mt-6">
            <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.18)] backdrop-blur-xl">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/55">Kiểm tra đơn hàng</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Cập nhật trạng thái thanh toán</h2>
                </div>
                <button
                  type="button"
                  onClick={() => void loadOrder()}
                  disabled={!orderId || isLoading}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ArrowClockwise size={16} />
                  {isLoading ? 'Đang cập nhật...' : 'Kiểm tra lại'}
                </button>
              </div>

              <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-white/75">
                {orderId ? (
                  <p>
                    Hệ thống sẽ đối chiếu thông tin thanh toán mới nhất để bạn biết đơn hàng đã hoàn tất, đang chờ hay cần thử lại.
                  </p>
                ) : (
                  <p>
                    Hiện chưa có mã đơn hàng trong đường dẫn, vì vậy trang chỉ có thể hiển thị trạng thái tạm thời từ kết quả trả về.
                  </p>
                )}
              </div>

              {isProcessingCallback && (
                <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100 flex items-center gap-3">
                  <ArrowClockwise className="animate-spin" size={18} />
                  <span>Đang xác thực giao dịch và xử lý kết quả thanh toán từ VNPay...</span>
                </div>
              )}

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
                  Đang tải thông tin đơn hàng...
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 rounded-[32px] border border-white/10 bg-white/5 p-6 text-sm leading-6 text-white/70 shadow-[0_24px_80px_rgba(15,23,42,0.18)] backdrop-blur-xl">
            <p className="font-semibold text-white">Trạng thái hiển thị trên trang</p>
            <p className="mt-2">
              Trang này có thể hiển thị các trạng thái <span className="font-medium text-white">pending</span>, <span className="font-medium text-white">success</span>, <span className="font-medium text-white">failed</span> và <span className="font-medium text-white">expired</span> để bạn tiện theo dõi kết quả thanh toán.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}

export default function PaymentReturnPage() {
  return (
    <Suspense
      fallback={(
        <div className="min-h-screen bg-[#050816] text-white">
          <Header />
          <main className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-4xl items-center justify-center px-6 pt-20">
            <div className="rounded-[32px] border border-white/10 bg-white/5 px-6 py-8 text-sm text-white/70">
              Loading payment return...
            </div>
          </main>
        </div>
      )}
    >
      <PaymentReturnPageContent />
    </Suspense>
  );
}
