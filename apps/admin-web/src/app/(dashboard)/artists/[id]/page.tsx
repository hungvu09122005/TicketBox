'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Eye, Notebook, PencilSimple, SpinnerGap, UserCircle } from '@phosphor-icons/react';
import { artistService } from '@/lib/services/artist.service';
import { Artist } from '@/lib/types';
import { hasStoredAdminSession } from '@/lib/auth-store';

function formatDateTime(value?: string) {
  if (!value) return '--';
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function ArtistDetailPage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const router = useRouter();
  const { id } = use(params);
  const [artist, setArtist] = useState<Artist | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!hasStoredAdminSession()) {
      router.replace('/login');
      return;
    }

    const load = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const data = await artistService.getArtist(id);
        setArtist(data);
      } catch (error) {
        console.error('Failed to load artist detail', error);
        setErrorMessage('Could not load the artist details.');
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, [id, router]);

  if (!hasStoredAdminSession()) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-muted">
          <SpinnerGap size={18} className="animate-spin" />
          Loading artist...
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="space-y-4">
        <Link href="/artists" className="inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-primary">
          <ArrowLeft size={16} />
          Back to artists
        </Link>
        <div className="rounded-[28px] border border-red-200 bg-red-50 p-5 text-sm text-red-800">
          {errorMessage}
        </div>
      </div>
    );
  }

  if (!artist) {
    return (
      <div className="space-y-4">
        <Link href="/artists" className="inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-primary">
          <ArrowLeft size={16} />
          Back to artists
        </Link>
        <div className="rounded-[28px] border border-dashed border-border bg-surface p-8 text-center text-sm text-muted">
          Artist not found.
        </div>
      </div>
    );
  }

  const initials = artist.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <div className="space-y-6">
      <Link href="/artists" className="inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-primary">
        <ArrowLeft size={16} />
        Back to artists
      </Link>

      <div className="rounded-[32px] border border-border bg-surface p-6 shadow-sm">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <div className="min-w-0">
            <div className="flex items-center gap-4">
              {artist.avatarUrl ? (
                <img
                  src={artist.avatarUrl}
                  alt={artist.name}
                  className="h-16 w-16 rounded-3xl border border-border object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-border bg-background text-2xl font-semibold text-primary">
                  {initials || <UserCircle size={32} />}
                </div>
              )}
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-muted">Artist profile</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-primary">{artist.name}</h1>
              </div>
            </div>

            <div className="mt-5 rounded-[28px] border border-border bg-background p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-surface text-primary">
                  <Notebook size={20} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-primary">Artist Bio</p>
                  <p className="text-xs text-muted">Artist public bio.</p>
                </div>
              </div>

              <p className="mt-4 text-sm leading-7 text-muted">
                {artist.shortBio?.trim() || 'This artist has no public bio yet.'}
              </p>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={`/artists/${artist.id}/edit`}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-surface transition-colors hover:opacity-90"
              >
                <PencilSimple size={16} />
                Edit artist
              </Link>
              <Link
                href="/concerts/create"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/5"
              >
                <Eye size={16} />
                Use in concert
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-2xl border border-border bg-background px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Artist ID</p>
              <p className="mt-1 break-all text-sm font-semibold text-primary">{artist.id}</p>
            </div>
            <div className="rounded-2xl border border-border bg-background px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Created</p>
              <p className="mt-1 text-sm font-semibold text-primary">{formatDateTime(artist.createdAt)}</p>
            </div>
            <div className="rounded-2xl border border-border bg-background px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Updated</p>
              <p className="mt-1 text-sm font-semibold text-primary">{formatDateTime(artist.updatedAt)}</p>
            </div>
            <div className="rounded-2xl border border-border bg-background px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Avatar</p>
              <p className="mt-1 break-all text-sm font-semibold text-primary">{artist.avatarObjectKey || '--'}</p>
            </div>
            <div className="rounded-2xl border border-border bg-background px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Image link</p>
              <p className="mt-1 break-all text-sm font-semibold text-primary">{artist.avatarUrl || '--'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
