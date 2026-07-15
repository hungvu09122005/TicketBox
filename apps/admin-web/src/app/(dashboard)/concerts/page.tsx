'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, MagnifyingGlass, Funnel, XCircle } from '@phosphor-icons/react';
import { useAuthStore } from '@/lib/auth-store';
import { concertService } from '@/lib/services/concert.service';
import { Concert } from '@/lib/types';

import { useToast } from '@/components/ui/ToastProvider';
import { useConfirm } from '@/components/ui/ConfirmProvider';

function getStatusClasses(status: string) {
  switch (status) {
    case 'PUBLISHED':
      return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
    case 'CANCELLED':
      return 'bg-red-100 text-red-800 border border-red-200';
    default:
      return 'bg-border/50 text-muted border border-border';
  }
}

function getPublishMissingFields(concert: Concert) {
  const missing: string[] = [];
  if (!concert.venue) missing.push('venue');
  if (!concert.description) missing.push('description');
  if (!concert.saleStartsAt) missing.push('saleStartsAt');
  if (!concert.saleEndsAt) missing.push('saleEndsAt');
  if (!concert.bannerObjectKey && !concert.bannerUrl) missing.push('banner');
  return missing;
}

export default function ConcertsPage() {
  const router = useRouter();
  const admin = useAuthStore((state) => state.admin);
  const [concerts, setConcerts] = useState<Concert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Concert['status']>('all');
  const isSystemAdmin = admin?.roles?.includes('SYSTEM_ADMIN') ?? false;

  useEffect(() => {
    let isActive = true;

    async function load() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const data = await concertService.getConcerts(admin);
        if (isActive) {
          setConcerts(data);
        }
      } catch (err) {
        console.error('Failed to load concerts', err);
        if (isActive) {
          setLoadError('Could not load the concert list. Please try again.');
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    load();

    return () => {
      isActive = false;
    };
  }, [admin]);

  const filteredConcerts = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return concerts.filter((concert) => {
      const matchesStatus = statusFilter === 'all' || concert.status === statusFilter;
      if (!matchesStatus) return false;

      if (!normalizedQuery) return true;

      return [concert.name, ...(concert.artists?.map(a => a.name) || []), concert.venue]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery));
    });
  }, [concerts, searchQuery, statusFilter]);

  const { toast } = useToast();
  const confirm = useConfirm();

  const handleUpdateStatus = async (id: string, newStatus: 'PUBLISHED' | 'CANCELLED') => {
    const targetConcert = concerts.find((concert) => concert.id === id);
    if (!targetConcert) return;

    try {
      if (newStatus === 'PUBLISHED') {
        const missing = getPublishMissingFields(targetConcert);
        if (missing.length > 0) {
          toast.error(`Cannot publish this concert yet. Missing: ${missing.join(', ')}`, 'Missing Information');
          return;
        }

        const isConfirmed = await confirm({
          title: 'Publish Concert',
          message: `Are you sure you want to publish "${targetConcert.name}"? This will make the event visible to users.`,
          confirmText: 'Confirm',
          cancelText: 'Cancel',
          variant: 'primary',
        });
        if (!isConfirmed) return;

        await concertService.publishConcert(admin, id);
        toast.success(`Concert "${targetConcert.name}" has been published successfully!`, 'Concert Published');
      } else {
        const isConfirmed = await confirm({
          title: 'Cancel Concert',
          message: `Are you sure you want to cancel "${targetConcert.name}"? This action cannot be easily undone.`,
          confirmText: 'Confirm',
          cancelText: 'Cancel',
          variant: 'danger',
        });
        if (!isConfirmed) return;

        await concertService.cancelConcert(admin, id);
        toast.success(`Concert "${targetConcert.name}" has been cancelled.`, 'Concert Cancelled');
      }
      setConcerts(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c));
    } catch (err: unknown) {
      const msg =
        typeof err === 'object' &&
        err !== null &&
        'response' in err &&
        typeof (err as { response?: { data?: { message?: string } } }).response?.data?.message === 'string'
          ? (err as { response?: { data?: { message?: string } } }).response!.data!.message!
          : 'Failed to update status';
      toast.error(msg, 'Status Update Failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-primary">Concerts</h1>
          <p className="text-sm text-muted mt-1">Manage live events, artists, and venues.</p>
          {isSystemAdmin && (
            <p className="mt-2 text-xs text-muted">
              System admin view shows all concerts using the dedicated admin API.
            </p>
          )}
        </div>
        <Link 
          href="/concerts/create"
          className="inline-flex w-full md:w-auto items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-surface transition-colors hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          <Plus size={16} weight="bold" />
          Create Concert
        </Link>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
        <div className="relative w-full max-w-2xl">
          <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
          <input 
            type="text" 
            placeholder="Search concerts..." 
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full rounded-lg border border-border bg-surface pl-10 pr-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <div className="inline-flex w-full items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-primary sm:w-auto">
            <Funnel size={16} className="shrink-0 text-muted" />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as 'all' | Concert['status'])}
              className="w-full min-w-[160px] bg-transparent text-sm font-medium text-primary outline-none sm:w-auto"
            >
              <option value="all">All statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('all');
            }}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium text-primary hover:bg-primary/5 sm:w-auto"
          >
            <XCircle size={16} />
            Reset
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface overflow-hidden shadow-sm">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-primary/5 border-b border-border">
              <tr>
                <th className="px-6 py-4 font-medium text-muted">Title</th>
                <th className="px-6 py-4 font-medium text-muted">Artist</th>
                <th className="px-6 py-4 font-medium text-muted">Date</th>
                <th className="px-6 py-4 font-medium text-muted">Ticketing</th>
                <th className="px-6 py-4 font-medium text-muted">Status</th>
                <th className="px-6 py-4 font-medium text-muted text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted">
                    <div className="animate-pulse flex flex-col gap-3 items-center">
                      <div className="h-4 w-32 bg-border rounded"></div>
                      <div className="h-3 w-24 bg-border rounded"></div>
                    </div>
                  </td>
                </tr>
              ) : loadError ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <p className="text-primary font-medium">Could not load concerts</p>
                    <p className="text-muted text-sm mt-1">{loadError}</p>
                  </td>
                </tr>
              ) : filteredConcerts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <p className="text-primary font-medium">No concerts found</p>
                    <p className="text-muted text-sm mt-1">Try changing the search term or status filter.</p>
                  </td>
                </tr>
              ) : (
                filteredConcerts.map(concert => (
                  <tr
                    key={concert.id}
                    className="cursor-pointer hover:bg-primary/5 transition-colors group"
                    onClick={() => router.push(`/concerts/${concert.id}/edit`)}
                  >
                    <td className="px-6 py-4 font-medium text-primary">
                      <Link
                        href={`/concerts/${concert.id}/edit`}
                        onClick={(event) => event.stopPropagation()}
                        className="hover:underline underline-offset-4"
                      >
                        {concert.name}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-muted">{concert.artists?.map(a => a.name).join(', ') || 'Unknown'}</td>
                    <td className="px-6 py-4 text-muted">
                      {new Date(concert.startsAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <Link
                        href={`/concerts/${concert.id}/ticketing`}
                        onClick={(event) => event.stopPropagation()}
                        className="inline-flex items-center rounded-full border border-border px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/5"
                      >
                        Manage
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusClasses(concert.status)}`}>
                        {concert.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {concert.status === 'DRAFT' && (
                          <button 
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleUpdateStatus(concert.id, 'PUBLISHED');
                            }}
                            disabled={getPublishMissingFields(concert).length > 0}
                            className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:border-border disabled:bg-border/40 disabled:text-muted disabled:opacity-100"
                            title={getPublishMissingFields(concert).length > 0 ? `Missing: ${getPublishMissingFields(concert).join(', ')}` : 'Publish'}
                          >
                            Publish
                          </button>
                        )}
                        {concert.status !== 'CANCELLED' && (
                          <button 
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleUpdateStatus(concert.id, 'CANCELLED');
                            }}
                            className="rounded-full border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                            title="Cancel"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
