'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, MagnifyingGlass, Funnel, DotsThree, CheckCircle, XCircle } from '@phosphor-icons/react';
import { concertService } from '@/lib/services/concert.service';
import { Concert } from '@/lib/types';
import { useAuthStore } from '@/lib/auth-store';
import { PERMISSIONS, hasAnyPermission } from '@/lib/permissions';

export default function ConcertsPage() {
  const [concerts, setConcerts] = useState<Concert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const permissions = useAuthStore((state) => state.admin?.permissions ?? []);
  const canCreateConcert = hasAnyPermission(permissions, [PERMISSIONS.CONCERT_CREATE]);
  const canUpdateConcert = hasAnyPermission(permissions, [PERMISSIONS.CONCERT_UPDATE]);

  useEffect(() => {
    async function load() {
      try {
        setErrorMessage(null);
        const data = await concertService.getConcerts();
        setConcerts(data);
      } catch (err) {
        console.error('Failed to load concerts', err);
        const status = typeof err === 'object' && err !== null && 'response' in err
          ? (err as { response?: { status?: number; data?: { message?: string } } }).response?.status
          : undefined;
        const message = typeof err === 'object' && err !== null && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
        setErrorMessage(
          status === 403
            ? message || 'Bạn không có quyền truy cập danh sách concert này.'
            : message || 'Failed to load concerts'
        );
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  const handleUpdateStatus = async (id: string, newStatus: 'PUBLISHED' | 'CANCELLED') => {
    try {
      await concertService.updateStatus(id, newStatus);
      setConcerts(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c));
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to update status';
      alert(`Error: ${msg}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-primary">Concerts</h1>
          <p className="text-sm text-muted mt-1">Manage live events, artists, and venues.</p>
        </div>
        {canCreateConcert && (
          <Link 
            href="/concerts/create"
            className="inline-flex w-full md:w-auto items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-surface transition-colors hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            <Plus size={16} weight="bold" />
            Create Concert
          </Link>
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="relative w-full sm:flex-1 max-w-md">
          <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
          <input 
            type="text" 
            placeholder="Search concerts..." 
            className="w-full rounded-lg border border-border bg-surface pl-10 pr-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <button className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium text-primary hover:bg-primary/5">
          <Funnel size={16} />
          Filter
        </button>
      </div>

      {errorMessage && !isLoading ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-700">
          {errorMessage}
        </div>
      ) : (
      <div className="rounded-xl border border-border bg-surface overflow-hidden shadow-sm">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-primary/5 border-b border-border">
              <tr>
                <th className="px-6 py-4 font-medium text-muted">Title</th>
                <th className="px-6 py-4 font-medium text-muted">Artist</th>
                <th className="px-6 py-4 font-medium text-muted">Date</th>
                <th className="px-6 py-4 font-medium text-muted">Status</th>
                <th className="px-6 py-4 font-medium text-muted text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted">
                    <div className="animate-pulse flex flex-col gap-3 items-center">
                      <div className="h-4 w-32 bg-border rounded"></div>
                      <div className="h-3 w-24 bg-border rounded"></div>
                    </div>
                  </td>
                </tr>
              ) : concerts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center">
                    <p className="text-primary font-medium">No concerts found</p>
                    <p className="text-muted text-sm mt-1">Click create to add your first event.</p>
                  </td>
                </tr>
              ) : (
                concerts.map(concert => (
                  <tr key={concert.id} className="hover:bg-primary/5 transition-colors group">
                    <td className="px-6 py-4 font-medium text-primary">{concert.title}</td>
                    <td className="px-6 py-4 text-muted">{concert.artist?.name || 'Unknown'}</td>
                    <td className="px-6 py-4 text-muted">
                      {new Date(concert.startTime).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        concert.status === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                        concert.status === 'CANCELLED' ? 'bg-red-100 text-red-800 border border-red-200' :
                        'bg-border/50 text-muted border border-border'
                      }`}>
                        {concert.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        {canUpdateConcert && concert.status === 'DRAFT' && (
                          <button 
                            onClick={() => handleUpdateStatus(concert.id, 'PUBLISHED')}
                            className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-md"
                            title="Publish"
                          >
                            <CheckCircle size={18} />
                          </button>
                        )}
                        {canUpdateConcert && concert.status !== 'CANCELLED' && (
                          <button 
                            onClick={() => handleUpdateStatus(concert.id, 'CANCELLED')}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-md"
                            title="Cancel"
                          >
                            <XCircle size={18} />
                          </button>
                        )}
                        {canUpdateConcert && (
                          <Link 
                            href={`/concerts/${concert.id}/edit`}
                            className="p-2 text-muted hover:text-primary hover:bg-primary/5 rounded-md"
                          >
                            <DotsThree size={20} weight="bold" />
                          </Link>
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
      )}
    </div>
  );
}
