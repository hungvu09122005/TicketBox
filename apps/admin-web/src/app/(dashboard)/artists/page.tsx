'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Eye, MusicNotes, Notebook, PencilSimple, Plus, SpinnerGap, UserCircle } from '@phosphor-icons/react';
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

function ArtistCard({
  artist,
  isSelected,
  onSelect,
}: Readonly<{
  artist: Artist;
  isSelected: boolean;
  onSelect: () => void;
}>) {
  const initials = artist.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group w-full rounded-[28px] border p-5 text-left transition-all duration-200 ${
        isSelected
          ? 'border-primary bg-primary/5 shadow-sm'
          : 'border-border bg-surface hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-sm'
      }`}
    >
      <div className="flex items-start gap-4">
        {artist.avatarUrl ? (
          <img
            src={artist.avatarUrl}
            alt={artist.name}
            className="h-14 w-14 shrink-0 rounded-2xl border border-border object-cover"
          />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-border bg-background text-lg font-semibold text-primary">
            {initials || <UserCircle size={28} />}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-primary">{artist.name}</h3>
              <p className="mt-1 text-sm leading-6 text-muted">
                {artist.shortBio?.trim() || 'Chưa có bio công khai.'}
              </p>
            </div>
            <ArrowRight size={16} className="mt-1 shrink-0 text-muted" />
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.18em] text-muted">
            <span className="rounded-full border border-border bg-background px-3 py-1">
              ID: {artist.id.slice(0, 8)}
            </span>
            <span className="rounded-full border border-border bg-background px-3 py-1">
              Bio: {artist.shortBio?.trim() ? 'Có' : 'Chưa có'}
            </span>
            <span className="rounded-full border border-border bg-background px-3 py-1">
              Ảnh: {artist.avatarUrl ? 'Có' : 'Chưa có'}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

function LoadingState() {
  return (
    <div className="rounded-[32px] border border-border bg-surface p-8">
      <div className="flex items-center gap-3 text-sm text-muted">
        <SpinnerGap size={18} className="animate-spin" />
        Loading artists...
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={String(index)} className="h-36 animate-pulse rounded-[28px] bg-border/50" />
        ))}
      </div>
    </div>
  );
}

export default function ArtistsPage() {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedArtistId, setSelectedArtistId] = useState<string | null>(null);

  const selectedArtist = useMemo(
    () => artists.find((artist) => artist.id === selectedArtistId) ?? artists[0] ?? null,
    [artists, selectedArtistId],
  );

  useEffect(() => {
    if (!hasStoredAdminSession()) return;

    const load = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const data = await artistService.getArtists();
        setArtists(data);
        setSelectedArtistId((current) => current ?? data[0]?.id ?? null);
      } catch (error) {
        console.error('Failed to load artists', error);
        setErrorMessage('Không thể tải danh sách nghệ sĩ. Vui lòng thử lại.');
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, []);

  if (!hasStoredAdminSession()) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[32px] border border-border bg-surface p-6 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted">Artist catalog</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-primary">Artists</h1>
            <p className="mt-3 text-sm leading-6 text-muted">
              Danh sách nghệ sĩ để bạn chọn nhanh, xem chi tiết và chỉnh hồ sơ khi cần.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Link
              href="/artists/create"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-primary px-4 py-3 text-sm font-medium text-surface"
            >
              <Plus size={16} />
              Create artist
            </Link>
            <div className="rounded-2xl border border-border bg-background px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Artists</p>
              <p className="mt-1 text-lg font-semibold text-primary">{artists.length}</p>
            </div>
            <div className="rounded-2xl border border-border bg-background px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Selected</p>
              <p className="mt-1 text-lg font-semibold text-primary">{selectedArtist?.name || '--'}</p>
            </div>
            <div className="rounded-2xl border border-border bg-background px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Bio</p>
              <p className="mt-1 text-lg font-semibold text-primary">
                {selectedArtist?.shortBio?.trim() ? 'Có' : 'Chưa có'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {isLoading ? <LoadingState /> : null}

      {!isLoading && errorMessage ? (
        <div className="rounded-[28px] border border-red-200 bg-red-50 p-5 text-sm text-red-800">
          {errorMessage}
        </div>
      ) : null}

      {!isLoading && !errorMessage && artists.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-border bg-surface p-10 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-background">
            <MusicNotes size={28} className="text-muted" />
          </div>
          <h2 className="mt-4 text-xl font-semibold text-primary">Chưa có artist nào</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted">
            Khi có nghệ sĩ, danh sách và bio công khai sẽ hiện ở đây.
          </p>
        </div>
      ) : null}

      {!isLoading && !errorMessage && artists.length > 0 ? (
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-4">
            {artists.map((artist) => (
              <ArtistCard
                key={artist.id}
                artist={artist}
                isSelected={artist.id === selectedArtist?.id}
                onSelect={() => setSelectedArtistId(artist.id)}
              />
            ))}
          </div>

          <aside className="rounded-[32px] border border-border bg-surface p-6 shadow-sm">
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted">Artist bio</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-primary">
              {selectedArtist?.name || 'Chọn một nghệ sĩ'}
            </h2>

            {selectedArtist ? (
              <>
                <div className="mt-5 grid gap-4 sm:grid-cols-[180px_1fr]">
                  <div className="overflow-hidden rounded-[28px] border border-border bg-background">
                    {selectedArtist.avatarUrl ? (
                      <img
                        src={selectedArtist.avatarUrl}
                        alt={selectedArtist.name}
                        className="h-full min-h-[180px] w-full object-cover"
                      />
                    ) : (
                      <div className="flex min-h-[180px] items-center justify-center bg-[radial-gradient(circle_at_top,#f97316_0%,#e5e7eb_38%,#f8fafc_100%)] text-3xl font-semibold text-primary">
                        {selectedArtist.name
                          .split(' ')
                          .filter(Boolean)
                          .slice(0, 2)
                          .map((part) => part[0]?.toUpperCase() ?? '')
                          .join('') || <UserCircle size={40} />}
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-[24px] border border-border bg-background p-4">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Short bio</p>
                      <p className="mt-2 text-sm leading-7 text-primary">
                        {selectedArtist.shortBio?.trim() || 'Nghệ sĩ này chưa có bio công khai.'}
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-[24px] border border-border bg-background p-4">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Created</p>
                        <p className="mt-2 text-sm font-semibold text-primary">{formatDateTime(selectedArtist.createdAt)}</p>
                      </div>
                      <div className="rounded-[24px] border border-border bg-background p-4">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Updated</p>
                        <p className="mt-2 text-sm font-semibold text-primary">{formatDateTime(selectedArtist.updatedAt)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-5 rounded-[28px] border border-border bg-background p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-surface text-primary">
                      <Notebook size={22} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-primary">Bio public</p>
                      <p className="text-xs text-muted">Thông tin công khai của nghệ sĩ.</p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-[24px] border border-dashed border-border bg-surface/80 p-4 text-sm leading-7 text-muted">
                    {selectedArtist.avatarObjectKey
                      ? `Ảnh gốc: ${selectedArtist.avatarObjectKey}`
                      : 'Chưa có ảnh đại diện, phần xem ảnh sẽ hiển thị khung tạm.'}
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href={`/artists/${selectedArtist.id}`}
                    className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-surface transition-colors hover:opacity-90"
                  >
                    <Eye size={16} />
                    Open profile
                    <ArrowRight size={16} />
                  </Link>
                  <Link
                    href={`/artists/${selectedArtist.id}/edit`}
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/5"
                  >
                    <PencilSimple size={16} />
                    Edit artist
                  </Link>
                  <Link
                    href="/concerts/create"
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/5"
                  >
                    Use in concert
                  </Link>
                </div>
              </>
            ) : (
              <div className="mt-5 rounded-[28px] border border-dashed border-border bg-background p-6 text-sm text-muted">
                Chọn một nghệ sĩ để xem bio công khai.
              </div>
            )}
          </aside>
        </div>
      ) : null}
    </div>
  );
}
