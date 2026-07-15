'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowSquareOut, MagnifyingGlass, SpinnerGap, Ticket, Funnel } from '@phosphor-icons/react';
import { useAuthStore } from '@/lib/auth-store';
import { concertService } from '@/lib/services/concert.service';
import { operationsService, type OrderDetails, type PaginationMeta } from '@/lib/services/operations.service';
import type { Concert } from '@/lib/types';

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
  return `${apiUrl.replace(/\/$/, '')}/admin/queues`;
})();

export default function OrdersOperationsPage() {
  const admin = useAuthStore((state) => state.admin);
  const [orders, setOrders] = useState<OrderDetails[]>([]);
  const [paginationMeta, setPaginationMeta] = useState<PaginationMeta | null>(null);
  const [concerts, setConcerts] = useState<Concert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | OrderDetails['status']>('all');
  const [concertFilter, setConcertFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  useEffect(() => {
    let isActive = true;

    const load = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const [orderData, concertData] = await Promise.all([
          operationsService.getOrders({
            page,
            limit,
            status: statusFilter === 'all' ? undefined : statusFilter,
            concertId: concertFilter === 'all' ? undefined : concertFilter,
          }),
          concertService.getConcerts(admin),
        ]);

        if (!isActive) return;

        setOrders(orderData.data);
        setPaginationMeta(orderData.meta);
        setConcerts(concertData);
      } catch (error) {
        if (!isActive) return;
        setErrorMessage(error instanceof Error ? error.message : 'Could not load the order list.');
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
  }, [admin, concertFilter, limit, page, statusFilter]);

  const filteredOrders = useMemo(() => {
    const orderList = Array.isArray(orders) ? orders : [];
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return orderList.filter((order) => {
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

  const totalPages = Math.max(1, paginationMeta?.totalPages ?? 1);

  return (
    <div className="space-y-6">
      <div className="rounded-[32px] border border-border bg-surface p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="max-w-2xl space-y-3">
            <Link href="/operations" className="inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-primary">
              <ArrowLeft size={16} />
              Back to operations hub
            </Link>
            <div>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-primary">Order and payment management</h1>
              <p className="mt-3 text-sm leading-6 text-muted">
                Filter order data by concert and status, inspect expiry timestamps, and keep the payment flow visible without faking provider data.
              </p>
            </div>
          </div>
          <div className="flex items-start justify-end">
            <a href={queueDashboardHref} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-surface">
              <ArrowSquareOut size={16} />
              Open queue board
            </a>
          </div>
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
              onChange={(event) => {
                setPage(1);
                setStatusFilter(event.target.value as 'all' | OrderDetails['status']);
              }}
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
              onChange={(event) => {
                setPage(1);
                setConcertFilter(event.target.value);
              }}
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
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2 text-sm text-muted">
              <Ticket size={16} />
              Order list
            </div>
            <label className="flex items-center gap-3 text-sm text-muted">
              <span>Page size</span>
              <select
                value={limit}
                onChange={(event) => {
                  setPage(1);
                  setLimit(Number(event.target.value));
                }}
                className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-primary outline-none"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </label>
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
                <th className="px-6 py-4 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-14 text-center text-muted">
                    <div className="inline-flex items-center gap-2">
                      <SpinnerGap size={18} className="animate-spin" />
                      Loading orders...
                    </div>
                  </td>
                </tr>
              ) : errorMessage ? (
                <tr>
                  <td colSpan={6} className="px-6 py-14 text-center text-red-800">
                    {errorMessage}
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-14 text-center text-muted">
                    No orders matched the current filters.
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
                    <td className="px-6 py-4">
                      <Link
                        href={`/operations/orders/${order.id}`}
                        className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-primary hover:border-primary hover:bg-surface"
                      >
                        View detail
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-4 text-sm text-muted">
          <span>
            Page {paginationMeta?.page ?? page} of {totalPages}
            {' · '}
            Total {paginationMeta?.total ?? 0} orders
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-primary disabled:cursor-not-allowed disabled:opacity-40"
            >
              Prev
            </button>
            <button
              type="button"
              disabled={page >= totalPages || isLoading}
              onClick={() => setPage((current) => current + 1)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-primary disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
