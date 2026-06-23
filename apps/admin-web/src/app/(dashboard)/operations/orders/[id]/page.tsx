'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowSquareOut, SpinnerGap, Ticket } from '@phosphor-icons/react';
import { Permission } from '@/lib/permissions';
import { useAuthStore } from '@/lib/auth-store';
import { operationsService, type OrderDetails, type PaymentHistoryRecord } from '@/lib/services/operations.service';

function formatCurrency(value?: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '--';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateTime(value?: string) {
  if (!value) return '--';
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function statusTone(status: OrderDetails['status']) {
  switch (status) {
    case 'PAID':
      return 'border-emerald-200 bg-emerald-50 text-emerald-800';
    case 'PENDING_PAYMENT':
      return 'border-amber-200 bg-amber-50 text-amber-800';
    case 'EXPIRED':
    case 'PAYMENT_FAILED':
      return 'border-red-200 bg-red-50 text-red-800';
    default:
      return 'border-border bg-background text-muted';
  }
}

const queueDashboardHref = (() => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
  return apiUrl.replace(/\/api\/v1\/?$/, '') + '/admin/queues';
})();

export default function OrderDetailPage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const permissions = useAuthStore((state) => state.permissions);
  const canViewPaymentHistory = permissions.includes(Permission.REPORT_VIEW) || permissions.includes(Permission.RBAC_MANAGE);
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resolvedOrderId, setResolvedOrderId] = useState<string | null>(null);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [paymentMessage, setPaymentMessage] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [isInitiatingPayment, setIsInitiatingPayment] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistoryRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    const load = async () => {
      try {
        const { id } = await params;
        const data = await operationsService.getOrderById(id);

        if (!isActive) return;

        setOrder(data);
        setResolvedOrderId(id);
      } catch (error) {
        if (!isActive) return;
        setErrorMessage(error instanceof Error ? error.message : 'Không thể tải chi tiết đơn hàng.');
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      isActive = false;
    };
  }, [params]);

  useEffect(() => {
    if (!resolvedOrderId || !canViewPaymentHistory) {
      return;
    }

    let isActive = true;

    const loadHistory = async () => {
      setIsLoadingHistory(true);
      setHistoryError(null);

      try {
        const history = await operationsService.getPaymentHistory(resolvedOrderId);
        if (!isActive) return;
        setPaymentHistory(history);
      } catch (error) {
        if (!isActive) return;
        setHistoryError(error instanceof Error ? error.message : 'Unable to load payment history.');
      } finally {
        if (isActive) {
          setIsLoadingHistory(false);
        }
      }
    };

    void loadHistory();

    return () => {
      isActive = false;
    };
  }, [canViewPaymentHistory, resolvedOrderId]);

  const handleInitiatePayment = async () => {
    if (!order) return;

    setIsInitiatingPayment(true);
    setPaymentError(null);
    setPaymentMessage(null);

    try {
      const result = await operationsService.initiatePayment(order.id);
      setPaymentUrl(result.paymentUrl ?? null);
      setPaymentMessage(result.paymentId ? `Payment record ${result.paymentId} created.` : 'Payment initiation completed.');
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : 'Unable to initiate payment.');
    } finally {
      setIsInitiatingPayment(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-[32px] border border-border bg-surface p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl space-y-3">
            <Link href="/operations/orders" className="inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-primary">
              <ArrowLeft size={16} />
              Back to order list
            </Link>
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-muted">Request 13</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-primary">Order detail</h1>
              <p className="mt-3 text-sm leading-6 text-muted">
                A focused view for a single order so organizers can inspect the payment state, expiry, and payment history from the backend audit API.
              </p>
            </div>
          </div>
          <a href={queueDashboardHref} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-surface">
            <ArrowSquareOut size={16} />
            Open queue board
          </a>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[28px] border border-border bg-surface p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-border bg-background p-3 text-primary">
              <Ticket size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-primary">Order summary</h2>
              <p className="text-sm text-muted">Live data from `GET /orders/:id`.</p>
            </div>
          </div>

          <div className="mt-5">
            {isLoading ? (
              <div className="inline-flex items-center gap-2 text-sm text-muted">
                <SpinnerGap size={16} className="animate-spin" />
                Loading order...
              </div>
            ) : errorMessage ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                {errorMessage}
              </div>
            ) : order ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-border bg-background p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Order ID</p>
                  <p className="mt-2 break-words text-sm font-semibold text-primary">{order.id}</p>
                </div>
                <div className="rounded-2xl border border-border bg-background p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Status</p>
                  <span className={`mt-2 inline-flex rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ${statusTone(order.status)}`}>
                    {order.status}
                  </span>
                </div>
                <div className="rounded-2xl border border-border bg-background p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Total amount</p>
                  <p className="mt-2 text-lg font-semibold text-primary">{formatCurrency(Number(order.totalAmount))}</p>
                </div>
                <div className="rounded-2xl border border-border bg-background p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Quantity</p>
                  <p className="mt-2 text-lg font-semibold text-primary">{order.quantity}</p>
                </div>
                <div className="rounded-2xl border border-border bg-background p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Expires at</p>
                  <p className="mt-2 text-sm text-primary">{formatDateTime(order.expiresAt)}</p>
                </div>
                <div className="rounded-2xl border border-border bg-background p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Created at</p>
                  <p className="mt-2 text-sm text-primary">{formatDateTime(order.createdAt)}</p>
                </div>
                <div className="rounded-2xl border border-border bg-background p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Concert ID</p>
                  <p className="mt-2 break-words text-sm text-primary">{order.concertId}</p>
                </div>
                <div className="rounded-2xl border border-border bg-background p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Ticket type ID</p>
                  <p className="mt-2 break-words text-sm text-primary">{order.ticketTypeId}</p>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-[28px] border border-border bg-surface p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-primary">Payment context</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              The backend exposes payment initiation, callback handling, and payment history for audit and support.
            </p>
            {order?.status === 'PENDING_PAYMENT' ? (
              <button
                type="button"
                onClick={handleInitiatePayment}
                className="mt-4 inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-surface"
              >
                {isInitiatingPayment ? <SpinnerGap size={16} className="animate-spin" /> : <ArrowSquareOut size={16} />}
                Initiate payment
              </button>
            ) : (
              <div className="mt-4 rounded-2xl border border-border bg-background p-4 text-sm leading-6 text-muted">
                Payment initiation is only available for orders waiting for payment.
              </div>
            )}

            <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-background">
              <table className="min-w-full text-left text-sm">
                <tbody className="divide-y divide-border">
                  <tr>
                    <th className="w-44 px-4 py-3 font-medium text-primary">Initiate endpoint</th>
                    <td className="px-4 py-3 text-muted">POST /payments/:orderId/initiate</td>
                  </tr>
                  <tr>
                    <th className="w-44 px-4 py-3 font-medium text-primary">Callback endpoint</th>
                    <td className="px-4 py-3 text-muted">GET /payments/callback/vnpay</td>
                  </tr>
                  <tr>
                    <th className="w-44 px-4 py-3 font-medium text-primary">Audit focus</th>
                    <td className="px-4 py-3 text-muted">Expired, failed, and callback reconciliation</td>
                  </tr>
                  <tr>
                    <th className="w-44 px-4 py-3 font-medium text-primary">Manual edit</th>
                    <td className="px-4 py-3 text-muted">No manual success override in the frontend</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-background">
              <div className="border-b border-border px-4 py-3">
                <h3 className="text-sm font-semibold text-primary">Payment lifecycle</h3>
                <p className="mt-1 text-xs text-muted">How this order moves through the payment flow.</p>
              </div>
              <table className="min-w-full text-left text-sm">
                <tbody className="divide-y divide-border">
                  {[
                    ['Pending payment', 'Order is waiting for provider initiation'],
                    ['Provider initiated', 'Backend returned a payment URL / record'],
                    ['Callback received', 'VNPay callback reconciles provider state'],
                    ['Expired / failed', 'Order history stays visible for audit and support'],
                  ].map(([stage, meaning]) => (
                    <tr key={stage}>
                      <th className="w-44 px-4 py-3 font-medium text-primary">{stage}</th>
                      <td className="px-4 py-3 text-muted">{meaning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {paymentMessage ? <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{paymentMessage}</div> : null}
            {paymentError ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{paymentError}</div> : null}
            {paymentUrl ? (
              <a
                href={paymentUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center justify-center gap-2 rounded-full border border-border bg-background px-4 py-2.5 text-sm font-medium text-primary"
              >
                <ArrowSquareOut size={16} />
                Open payment URL
              </a>
            ) : null}
          </div>

          <div className="rounded-[28px] border border-border bg-surface p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-primary">Backend note</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              {resolvedOrderId ? `Loaded order ${resolvedOrderId}.` : 'No order loaded yet.'} The view shows real payment history and avoids inventing callback history.
            </p>
          </div>

          {canViewPaymentHistory ? (
            <div className="rounded-[28px] border border-border bg-surface p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-primary">Payment history</h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                History is loaded from the backend audit endpoint so callback processing, retries, and duplicate events are visible to organizers.
              </p>
              <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-background">
                <div className="overflow-x-auto">
                  <table className="min-w-full whitespace-nowrap text-left text-sm">
                    <thead className="bg-surface/80 text-muted">
                      <tr>
                        <th className="px-4 py-3 font-medium">Payment</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Provider</th>
                        <th className="px-4 py-3 font-medium">Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {isLoadingHistory ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-muted">
                            Loading payment history...
                          </td>
                        </tr>
                      ) : historyError ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-red-800">
                            {historyError}
                          </td>
                        </tr>
                      ) : paymentHistory.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-muted">
                            No payment history found for this order.
                          </td>
                        </tr>
                      ) : (
                        paymentHistory.map((item, index) => (
                          <tr key={String(item.id ?? index)}>
                            <td className="px-4 py-3 font-medium text-primary">{item.id ?? '--'}</td>
                            <td className="px-4 py-3 text-muted">{item.status ?? '--'}</td>
                            <td className="px-4 py-3 text-muted">{item.provider ?? '--'}</td>
                            <td className="px-4 py-3 text-muted">{formatDateTime(item.createdAt)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-[28px] border border-border bg-surface p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-primary">Payment history</h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                Payment history is available to users with `report:view` or `rbac:manage`.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
