'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, FloppyDisk, SpinnerGap, UploadSimple, UserCircle } from '@phosphor-icons/react';
import { artistService } from '@/lib/services/artist.service';
import { Artist } from '@/lib/types';
import { extractApiMessages } from '@/lib/api-errors';
import { hasStoredAdminSession } from '@/lib/auth-store';

const artistSchema = z.object({
  name: z.string().min(1, 'Artist name is required'),
  shortBio: z.string().optional(),
  avatarObjectKey: z.string().optional(),
});

type ArtistFormValues = z.infer<typeof artistSchema>;

function formatDateTime(value?: string) {
  if (!value) return '--';
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function EditArtistPage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const router = useRouter();
  const { id } = use(params);
  const [artist, setArtist] = useState<Artist | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [avatarFileName, setAvatarFileName] = useState<string | null>(null);
  const [serverErrors, setServerErrors] = useState<string[] | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<ArtistFormValues>({
    resolver: zodResolver(artistSchema),
    defaultValues: {
      name: '',
      shortBio: '',
      avatarObjectKey: '',
    },
  });

  useEffect(() => {
    if (!hasStoredAdminSession()) {
      router.replace('/login');
      return;
    }

    const load = async () => {
      setIsLoading(true);
      setServerErrors(null);

      try {
        const data = await artistService.getArtist(id);
        setArtist(data);
        reset({
          name: data.name ?? '',
          shortBio: data.shortBio ?? '',
          avatarObjectKey: data.avatarObjectKey ?? '',
        });
        setAvatarPreviewUrl(data.avatarUrl ?? null);
      } catch (error) {
        console.error('Failed to load artist edit data', error);
        setServerErrors(['Không thể tải artist để chỉnh sửa.']);
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, [id, reset, router]);

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(avatarPreviewUrl);
      }
    };
  }, [avatarPreviewUrl]);

  const handleAvatarUpload = async (file?: File | null) => {
    if (!file) return;

    setIsUploadingAvatar(true);
    setServerErrors(null);

    if (avatarPreviewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(avatarPreviewUrl);
    }

    const previewUrl = URL.createObjectURL(file);
    setAvatarPreviewUrl(previewUrl);

    try {
      const objectKey = await artistService.uploadAvatarAsset(file);
      setAvatarFileName(file.name);
      setValue('avatarObjectKey', objectKey, {
        shouldDirty: true,
        shouldValidate: true,
      });
    } catch (error) {
      setServerErrors(extractApiMessages(error, 'Không thể upload avatar.'));
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const onSubmit = async (values: ArtistFormValues) => {
    setIsSubmitting(true);
    setServerErrors(null);

    try {
      await artistService.updateArtist(id, {
        name: values.name,
        shortBio: values.shortBio?.trim() ? values.shortBio : null,
        avatarObjectKey: values.avatarObjectKey?.trim() ? values.avatarObjectKey : null,
      });
      router.push(`/artists/${id}`);
    } catch (error) {
      setServerErrors(extractApiMessages(error, 'Không thể lưu artist.'));
    } finally {
      setIsSubmitting(false);
    }
  };

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

  return (
    <div className="space-y-6">
      <Link href={`/artists/${id}`} className="inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-primary">
        <ArrowLeft size={16} />
        Back to artist detail
      </Link>

      <div className="rounded-[32px] border border-border bg-surface p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted">Edit artist</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-primary">
              {artist?.name || 'Artist'}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
              Bạn có thể chọn ảnh mới ngay tại đây để cập nhật hồ sơ nghệ sĩ.
            </p>
          </div>

          <div className="rounded-[24px] border border-border bg-background px-4 py-3 text-sm text-muted">
            <p className="text-[11px] uppercase tracking-[0.18em]">Created</p>
            <p className="mt-1 font-semibold text-primary">{formatDateTime(artist?.createdAt)}</p>
          </div>
        </div>
      </div>

      {serverErrors ? (
        <div className="rounded-[28px] border border-red-200 bg-red-50 p-5 text-sm text-red-800">
          <ul className="list-disc space-y-1 pl-5">
            {serverErrors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-5 rounded-[32px] border border-border bg-surface p-6 shadow-sm">
          <div>
            <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-primary">Name</label>
            <input
              id="name"
              {...register('name')}
              className={`w-full rounded-xl border bg-background px-4 py-3 text-sm text-primary outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary ${
                errors.name ? 'border-red-500' : 'border-border'
              }`}
            />
            {errors.name ? <p className="mt-1.5 text-xs text-red-600">{errors.name.message}</p> : null}
          </div>

          <div>
            <label htmlFor="shortBio" className="mb-1.5 block text-sm font-medium text-primary">Short bio</label>
            <textarea
              id="shortBio"
              rows={8}
              {...register('shortBio')}
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-primary outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
              placeholder="Public artist bio"
            />
          </div>

          <div>
            <label htmlFor="avatarObjectKey" className="mb-1.5 block text-sm font-medium text-primary">Đường dẫn ảnh</label>
            <input
              id="avatarObjectKey"
              {...register('avatarObjectKey')}
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-primary outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
              placeholder="artists/the-neon-waves/avatar.png"
            />
            <p className="mt-1.5 text-xs leading-5 text-muted">
              Ảnh mới sẽ tự cập nhật đường dẫn ở đây.
            </p>
          </div>

          <div>
            <label htmlFor="avatarFile" className="mb-1.5 block text-sm font-medium text-primary">Chọn ảnh đại diện</label>
            <div className="rounded-[24px] border border-dashed border-border bg-background p-4">
              <input
                id="avatarFile"
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  void handleAvatarUpload(file);
                }}
                className="block w-full text-sm text-muted file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-surface hover:file:opacity-90"
              />

              <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-surface">
                {avatarPreviewUrl ? (
                  <img src={avatarPreviewUrl} alt="Avatar preview" className="h-56 w-full object-cover" />
                ) : (
                  <div className="flex h-56 items-center justify-center px-4 text-center text-sm text-muted">
                    Chưa có ảnh xem trước.
                  </div>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
                {isUploadingAvatar ? (
                  <>
                    <SpinnerGap size={14} className="animate-spin" />
                    <span>Đang tải ảnh...</span>
                  </>
                ) : avatarFileName ? (
                  <>
                    <UploadSimple size={14} />
                    <span>Đã chọn ảnh: {avatarFileName}</span>
                  </>
                ) : (
                  <>
                    <UploadSimple size={14} />
                    <span>Chọn ảnh để cập nhật hồ sơ nghệ sĩ.</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <aside className="space-y-4 rounded-[32px] border border-border bg-surface p-6 shadow-sm">
          <p className="text-[11px] uppercase tracking-[0.22em] text-muted">Preview</p>
          <div className="overflow-hidden rounded-[28px] border border-border bg-background">
            {avatarPreviewUrl ? (
              <img
                src={avatarPreviewUrl}
                alt={artist?.name || 'Artist avatar'}
                className="h-64 w-full object-cover"
              />
            ) : (
              <div className="flex h-64 items-center justify-center bg-[radial-gradient(circle_at_top,#f97316_0%,#e5e7eb_35%,#f8fafc_100%)]">
                <UserCircle size={72} className="text-primary/80" />
              </div>
            )}
          </div>

          <div className="rounded-[24px] border border-border bg-background p-4 text-sm text-muted">
            <p className="text-[11px] uppercase tracking-[0.18em]">Ảnh hiện tại</p>
            <p className="mt-2 break-all font-medium text-primary">{artist?.avatarObjectKey || '--'}</p>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-medium text-surface transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? <SpinnerGap size={16} className="animate-spin" /> : <FloppyDisk size={16} />}
            Save changes
          </button>
        </aside>
      </form>
    </div>
  );
}
