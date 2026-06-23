'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowSquareOut, MagnifyingGlass, ShieldCheck, SpinnerGap, Ticket, Funnel } from '@phosphor-icons/react';
import { useAuthStore } from '@/lib/auth-store';
import { concertService } from '@/lib/services/concert.service';
import { operationsService, type OrderDetails } from '@/lib/services/operations.service';
import type { Concert } from '@/lib/types';
import { Permission } from '@/lib/permissions';

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

function statusClasses(status: OrderDetails['status']) {
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

export default function OrdersOperationsPage() {
  const admin = useAuthStore((state) => state.admin);
  const permissions = useAuthStore((state) => state.permissions);
  const canViewOrders = permissions.includes(Permission.ORDER_READ_ALL) || permissions.includes(Permission.ORDER_READ_OWN);

  const [orders, setOrders] = useState<OrderDetails[]>([]);
  const [concerts, setConcerts] = useState<Concert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | OrderDetails['status']>('all');
  const [concertFilter, setConcertFilter] = useState('all');

  useEffect(() => {
    let isActive = true;

    const load = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const [orderData, concertData] = await Promise.all([
          operationsService.getOrders(),
          concertService.getConcerts(admin),
        ]);

        if (!isActive) return;

        setOrders(orderData);
        setConcerts(concertData);
      } catch (error) {
        if (!isActive) return;
        setErrorMessage(error instanceof Error ? error.message : 'Không thể tải danh sách đơn hàng.');
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
  }, [admin]);

  const filteredOrders = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return orders.filter((order) => {
      if (statusFilter !== 'all' && order.status !== statusFilter) {
        return false;
      }

      if (concertFilter !== 'all' && order.concertId !== concertFilter) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return [
        order.id,
        order.concertId,
        order.ticketTypeId,
        order.status,
      ].some((value) => String(value).toLowerCase().includes(normalizedQuery));
    });
  }, [concertFilter, orders, searchQuery, statusFilter]);

  const filteredConcerts = useMemo(
    () => concerts.filter((concert) => concert.status !== 'DRAFT' || admin?.roles?.includes('SYSTEM_ADMIN')),
    [admin?.roles, concerts],
  );

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
              <p className="text-[11px] uppercase tracking-[0.22em] text-muted">Request 13</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-primary">Order and payment management</h1>
              <p className="mt-3 text-sm leading-6 text-muted">
                Filter order data by concert and status, inspect expiry timestamps, and keep the payment flow visible without faking provider data.
              </p>
            </div>
          </div>
          <div className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-background px-4 text-sm font-medium text-muted whitespace-nowrap">
            <ShieldCheck size={16} />
            {canViewOrders ? 'Access granted' : 'Access restricted'}
          </div>
          <a href={queueDashboardHref} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-surface">
            <ArrowSquareOut size={16} />
            Open queue board
          </a>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-primary">Search</span>
          <div className="relative">
            <MagnifyingGlass size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Order ID, concert ID, ticket type, status"
              className="w-full rounded-2xl border border-border bg-surface py-3 pl-10 pr-4 text-sm text-primary outline-none focus:border-primary"
            />
          </div>
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-primary">Status</span>
          <div className="flex w-full items-center gap-2 rounded-2xl border border-border bg-surface px-4 py-3">
            <Funnel size={16} className="text-muted" />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as 'all' | OrderDetails['status'])}
              className="w-full bg-transparent text-sm text-primary outline-none"
            >
              <option value="all">All statuses</option>
              <option value="PENDING_PAYMENT">Pending payment</option>
              <option value="PAID">Paid</option>
              <option value="EXPIRED">Expired</option>
              <option value="PAYMENT_FAILED">Payment failed</option>
            </select>
          </div>
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-primary">Concert</span>
          <div className="flex w-full items-center gap-2 rounded-2xl border border-border bg-surface px-4 py-3">
            <Funnel size={16} className="text-muted" />
            <select
              value={concertFilter}
              onChange={(event) => setConcertFilter(event.target.value)}
              className="w-full bg-transparent text-sm text-primary outline-none"
            >
              <option value="all">All concerts</option>
              {filteredConcerts.map((concert) => (
                <option key={concert.id} value={concert.id}>
                  {concert.name}
                </option>
              ))}
            </select>
          </div>
        </label>
      </div>

      <div className="rounded-[32px] border border-border bg-surface shadow-sm">
        <div className="border-b border-border px-6 py-4">
          <div className="flex items-center gap-2 text-sm text-muted">
            <Ticket size={16} />
            Live order list from `GET /orders`
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full whitespace-nowrap text-left text-sm">
            <thead className="bg-background/80 text-muted">
              <tr>
                <th className="px-6 py-4 font-medium">Order</th>
                <th className="px-6 py-4 font-medium">Concert</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Amount</th>
                <th className="px-6 py-4 font-medium">Expires</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-14 text-center text-muted">
                    <div className="inline-flex items-center gap-2">
                      <SpinnerGap size={18} className="animate-spin" />
                      Loading orders...
                    </div>
                  </td>
                </tr>
              ) : errorMessage ? (
                <tr>
                  <td colSpan={5} className="px-6 py-14 text-center text-red-800">
                    {errorMessage}
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-14 text-center text-muted">
                    No orders matched the current filters. The UI is ready for the backend list when it starts returning data.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-background/60">
                    <td className="px-6 py-4 font-medium text-primary">
                      <Link href={`/operations/orders/${order.id}`} className="hover:underline underline-offset-4">
                        {order.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-muted">{order.concertId.slice(0, 8)}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ${statusClasses(order.status)}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-primary">{formatCurrency(Number(order.totalAmount))}</td>
                    <td className="px-6 py-4 text-muted">{formatDateTime(order.expiresAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-[28px] border border-border bg-surface p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-primary">Payment contract</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            The backend still exposes create/callback only. A manual success editor is intentionally absent.
          </p>
          <div className="mt-4 rounded-2xl border border-border bg-background p-4 text-sm text-muted">
            <p>POST /payments/:orderId/initiate</p>
            <p className="mt-1">GET /payments/callback/vnpay</p>
          </div>
        </div>

        <div className="rounded-[28px] border border-border bg-surface p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-primary">Current limitation</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            `GET /orders` exists but currently returns an empty array in backend, so this page stays honest and only renders live data when the API starts supplying it.
          </p>
        </div>
      </div>
    </div>
  );
}
