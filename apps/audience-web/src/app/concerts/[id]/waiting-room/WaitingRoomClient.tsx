'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowClockwise, ArrowLeft, Timer, WarningCircle } from '@phosphor-icons/react';
import { Header } from '@/components/Header';
import { extractApiMessages } from '@/lib/api-errors';
import { hasStoredSession } from '@/lib/auth-store';
import { ordersService } from '@/lib/services/orders.service';
import { paymentsService } from '@/lib/services/payments.service';
import type { CreateOrderPayload } from '@/lib/types';

type QueueDraft = CreateOrderPayload & {
  queueToken: string;
  idempotencyKey: string;
};

const POLL_INTERVAL_MS = 7000;

function buildDraftStorageKey(concertId: string) {
  return `ticketbox:waiting-room:${concertId}`;
}

function buildFallbackDraft(searchParams: URLSearchParams, concertId: string): QueueDraft | null {
  const ticketTypeId = searchParams.get('ticketTypeId') ?? '';
  const queueToken = searchParams.get('queueToken') ?? '';
  const quantity = Number(searchParams.get('quantity') ?? '0');

  if (!ticketTypeId || !queueToken || !Number.isFinite(quantity) || quantity < 1) {
    return null;
  }

  return {
    concertId,
    ticketTypeId,
    quantity,
    queueToken,
    idempotencyKey: crypto.randomUUID(),
  };
}

function formatWaitTime(seconds?: number) {
  if (!seconds || seconds <= 0) {
    return '--';
  }

  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return `${minutes} phút`;
}

export default function WaitingRoomClient({ concertId }: Readonly<{ concertId: string }>) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mountedRef = useRef(false);
  const redirectLockRef = useRef(false);
  const [draft, setDraft] = useState<QueueDraft | null>(null);
  const [status, setStatus] = useState<'loading' | 'queued' | 'active' | 'error'>('loading');
  const [position, setPosition] = useState<number | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);

  useEffect(() => {
    if (!hasStoredSession()) {
      router.replace('/login?next=' + encodeURIComponent(`/concerts/${concertId}/waiting-room`));
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    mountedRef.current = true;

    const storageKey = buildDraftStorageKey(concertId);
    const storedDraftRaw = window.sessionStorage.getItem(storageKey);

    if (storedDraftRaw) {
      try {
        const parsed = JSON.parse(storedDraftRaw) as QueueDraft;
        if (parsed?.concertId === concertId && parsed.queueToken && parsed.ticketTypeId && parsed.quantity > 0) {
          setDraft(parsed);
          setErrorMessage(null);
          return;
        }
      } catch {
        window.sessionStorage.removeItem(storageKey);
      }
    }

    const fallbackDraft = buildFallbackDraft(new URLSearchParams(searchParams.toString()), concertId);
    if (fallbackDraft) {
      setDraft(fallbackDraft);
      window.sessionStorage.setItem(storageKey, JSON.stringify(fallbackDraft));
      setErrorMessage(null);
      return;
    }

    setStatus('error');
    setErrorMessage('Không tìm thấy thông tin hàng đợi hợp lệ. Hãy quay lại concert và thử checkout lại.');
  }, [concertId, router, searchParams]);

  useEffect(() => {
    if (!draft || status === 'error') {
      return;
    }

    let isActive = true;
    let intervalId: number | undefined;

    const clearDraft = () => {
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(buildDraftStorageKey(concertId));
      }
    };

    const initiateCheckout = async () => {
      if (redirectLockRef.current) {
        return;
      }

      redirectLockRef.current = true;
      setIsCreatingOrder(true);

      try {
        const orderResult = await ordersService.createOrder(
          {
            concertId: draft.concertId,
            ticketTypeId: draft.ticketTypeId,
            quantity: draft.quantity,
            queueToken: draft.queueToken,
          },
          draft.idempotencyKey,
        );

        if (!('id' in orderResult)) {
          throw new Error(orderResult.message ?? 'Backend did not accept the queue token.');
        }

        const paymentResult = await paymentsService.initiatePayment(orderResult.id, draft.idempotencyKey);
        const paymentUrl = paymentResult.paymentUrl ?? paymentResult.redirectUrl ?? paymentResult.url ?? null;

        clearDraft();

        if (paymentUrl) {
          window.location.assign(paymentUrl);
          return;
        }

        router.replace(`/payments/return?orderId=${encodeURIComponent(orderResult.id)}&status=pending`);
      } catch (error) {
      setErrorMessage(extractApiMessages(error, 'Không thể tạo order khi lượt của bạn đã mở.').join(' '));
        setStatus('error');
      } finally {
        setIsCreatingOrder(false);
        redirectLockRef.current = false;
      }
    };

    const loadStatus = async () => {
      if (!isActive || !mountedRef.current) {
        return;
      }

      try {
        const nextStatus = await ordersService.getQueueStatus(concertId);
        if (!isActive) return;

        setLastCheckedAt(new Date().toISOString());
        if (nextStatus.status === 'QUEUED' && nextStatus.position === -1) {
          setPosition(null);
          setStatus('error');
          setErrorMessage('Queue token đã hết hạn hoặc không còn hợp lệ. Vui lòng quay lại concert và tạo checkout mới.');
          return;
        }

        setPosition(nextStatus.position ?? null);
        setStatus(nextStatus.status === 'ACTIVE' ? 'active' : 'queued');

        if (nextStatus.status === 'ACTIVE') {
          await initiateCheckout();
        }
      } catch (error) {
        if (!isActive) return;
        setStatus('error');
        setErrorMessage(extractApiMessages(error, 'Không thể kiểm tra trạng thái hàng đợi.').join(' '));
      }
    };

    void loadStatus();
    intervalId = window.setInterval(() => {
      void loadStatus();
    }, POLL_INTERVAL_MS);

    return () => {
      isActive = false;
      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, [concertId, draft, router, status]);

  const estimatedWait = useMemo(() => {
    if (typeof position !== 'number' || position <= 0) {
      return null;
    }

    return position * Math.ceil(POLL_INTERVAL_MS / 1000);
  }, [position]);

  if (!hasStoredSession()) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#050816] text-white selection:bg-amber-300/30">
      <Header />

      <main className="relative overflow-hidden pt-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(249,115,22,0.22),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.18),_transparent_28%),linear-gradient(180deg,_#020617_0%,_#050816_45%,_#09090b_100%)]" />

        <section className="relative mx-auto max-w-4xl px-6 pb-24 pt-12 lg:px-8 lg:pt-16">
          <Link
            href={`/concerts/${concertId}`}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/75 backdrop-blur-md transition-colors hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft size={16} />
            Quay lại concert
          </Link>

          <div className="mt-6 rounded-[32px] border border-white/10 bg-white/5 p-6 backdrop-blur-xl md:p-8">
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_max-content] md:grid-rows-[auto_auto] md:items-start">
              <div className="md:col-start-1 md:row-start-1">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/55">Waiting room</p>
                <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
                  Đang giữ chỗ trong hàng đợi
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-6 text-white/68">
                  Hệ thống sẽ tự động cập nhật vị trí của bạn sau mỗi {Math.round(POLL_INTERVAL_MS / 1000)} giây và chuyển sang bước thanh toán khi đến lượt.
                </p>
              </div>
              <div className="inline-flex w-fit flex-col rounded-[20px] border border-white/10 bg-white/5 px-3 py-2.5 text-left md:col-start-2 md:row-start-1 md:justify-self-end md:self-start">
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/55">Concert</p>
                <p className="mt-1 whitespace-nowrap text-xs font-semibold text-white sm:text-sm">{concertId}</p>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_0.9fr]">
            <section className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/55">Queue status</p>

              {status === 'loading' ? (
                <div className="mt-5 rounded-[24px] border border-white/10 bg-white/5 p-5 text-sm text-white/68">
                  Đang tải thông tin hàng đợi...
                </div>
              ) : null}

              {status === 'queued' ? (
                <div className="mt-5 space-y-4">
                  <div className="rounded-[24px] border border-amber-400/20 bg-amber-400/10 p-5">
                    <p className="text-sm font-medium text-amber-50">Bạn đang ở trong hàng đợi.</p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Position</p>
                        <p className="mt-2 text-2xl font-semibold text-white">{position ?? '--'}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Estimated wait</p>
                        <p className="mt-2 text-2xl font-semibold text-white">{formatWaitTime(estimatedWait ?? undefined)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-white/10 bg-white/5 p-5 text-sm leading-6 text-white/68">
                    <p>Hệ thống sẽ giữ chỗ của bạn trong hàng đợi và kiểm tra lại tự động.</p>
                    <p className="mt-2">Khi đến lượt, bạn sẽ được chuyển tiếp sang bước đặt vé tiếp theo.</p>
                  </div>
                </div>
              ) : null}

              {status === 'active' ? (
                <div className="mt-5 rounded-[24px] border border-emerald-400/20 bg-emerald-400/10 p-5">
                  <p className="text-sm font-medium text-emerald-50">Đã đến lượt bạn.</p>
                  <p className="mt-2 text-sm leading-6 text-emerald-50/85">
                    Đang tạo order và chuyển sang thanh toán thật...
                  </p>
                </div>
              ) : null}

              {status === 'error' ? (
                <div className="mt-5 rounded-[24px] border border-rose-400/20 bg-rose-400/10 p-5">
                  <p className="inline-flex items-center gap-2 text-sm font-medium text-rose-50">
                    <WarningCircle size={16} />
                    Không thể theo dõi hàng đợi
                  </p>
                  <p className="mt-2 text-sm leading-6 text-rose-50/85">{errorMessage}</p>
                </div>
              ) : null}

              {message ? (
                <div className="mt-5 rounded-[24px] border border-white/10 bg-white/5 p-4 text-sm leading-6 text-white/68">
                  {message}
                </div>
              ) : null}

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                >
                  <ArrowClockwise size={16} />
                  Làm mới ngay
                </button>
                <span className="text-xs uppercase tracking-[0.18em] text-white/45">
                  Cập nhật lần cuối {lastCheckedAt ? new Intl.DateTimeFormat('vi-VN', { timeStyle: 'medium' }).format(new Date(lastCheckedAt)) : '--'}
                </span>
              </div>
            </section>

            <aside className="space-y-4 rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/55">Thông tin lượt đặt vé</p>
              <div className="rounded-[24px] border border-white/10 bg-white/5 p-4 text-sm leading-6 text-white/72">
                <p>Hạng vé: {draft?.ticketTypeId ?? searchParams.get('ticketTypeId') ?? '--'}</p>
                <p className="mt-1">Số lượng: {draft?.quantity ?? searchParams.get('quantity') ?? '--'}</p>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/5 p-4 text-sm leading-6 text-white/72">
                <p className="font-medium text-white">Tiếp theo</p>
                <p className="mt-2">
                  Khi đến lượt, hệ thống sẽ tự động tiếp tục sang bước thanh toán cho bạn.
                </p>
              </div>
              {isCreatingOrder ? (
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/68">
                  <Timer size={16} className="animate-spin" />
                  Creating order...
                </div>
              ) : null}
            </aside>
          </div>
        </section>
      </main>
    </div>
  );
}
