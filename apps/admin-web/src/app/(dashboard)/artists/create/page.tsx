'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, FloppyDisk, SpinnerGap, UploadSimple, UserCircle } from '@phosphor-icons/react';
import { artistService } from '@/lib/services/artist.service';
import { extractApiMessages } from '@/lib/api-errors';
import { hasStoredAdminSession } from '@/lib/auth-store';

const artistSchema = z.object({
  name: z.string().min(1, 'Artist name is required'),
  shortBio: z.string().optional(),
  avatarObjectKey: z.string().optional(),
});

type ArtistFormValues = z.infer<typeof artistSchema>;

export default function CreateArtistPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [avatarFileName, setAvatarFileName] = useState<string | null>(null);
  const [serverErrors, setServerErrors] = useState<string[] | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ArtistFormValues>({
    resolver: zodResolver(artistSchema),
    defaultValues: {
      name: '',
      shortBio: '',
      avatarObjectKey: '',
    },
  });

  const nameValue = watch('name');

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
      const artist = await artistService.createArtist({
        name: values.name,
        shortBio: values.shortBio?.trim() ? values.shortBio : null,
        avatarObjectKey: values.avatarObjectKey?.trim() ? values.avatarObjectKey : null,
      });
      router.push(`/artists/${artist.id}`);
    } catch (error) {
      setServerErrors(extractApiMessages(error, 'Không thể tạo artist.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!hasStoredAdminSession()) {
    return null;
  }

  return (
    <div className="space-y-6">
      <Link href="/artists" className="inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-primary">
        <ArrowLeft size={16} />
        Back to artists
      </Link>

      <div className="rounded-[32px] border border-border bg-surface p-6 shadow-sm">
        <p className="text-[11px] uppercase tracking-[0.22em] text-muted">Create artist</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-primary">New Artist</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
          Tạo artist mới, tải avatar và chuẩn bị bio để publish sau.
        </p>
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
            <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-primary">Artist name</label>
            <input
              id="name"
              {...register('name')}
              className={`w-full rounded-xl border bg-background px-4 py-3 text-sm text-primary outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary ${
                errors.name ? 'border-red-500' : 'border-border'
              }`}
              placeholder="e.g. Summer Pulse Live"
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
            <label htmlFor="avatarObjectKey" className="mb-1.5 block text-sm font-medium text-primary">Avatar object key</label>
            <input
              id="avatarObjectKey"
              {...register('avatarObjectKey')}
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-primary outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
              placeholder="artists/the-neon-waves/avatar.png"
            />
            <p className="mt-1.5 text-xs leading-5 text-muted">
              Bạn có thể upload ảnh phía dưới để tự điền object key thật.
            </p>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-surface disabled:opacity-60"
          >
            {isSubmitting ? <SpinnerGap size={16} className="animate-spin" /> : <FloppyDisk size={16} />}
            Create artist
          </button>
        </div>

        <aside className="space-y-4 rounded-[32px] border border-border bg-surface p-6 shadow-sm">
          <p className="text-[11px] uppercase tracking-[0.22em] text-muted">Preview</p>
          <div className="overflow-hidden rounded-[28px] border border-border bg-background">
            {avatarPreviewUrl ? (
              <img src={avatarPreviewUrl} alt="Avatar preview" className="h-56 w-full object-cover" />
            ) : (
              <div className="flex h-56 items-center justify-center px-4 text-center text-sm text-muted">
                Chưa chọn ảnh. Upload ảnh để xem preview ngay tại đây.
              </div>
            )}
          </div>

          <div className="rounded-[24px] border border-border bg-background p-4 text-sm text-muted">
            <p className="font-medium text-primary">Artist name</p>
            <p className="mt-1 break-words">{nameValue || 'Chưa nhập tên artist'}</p>
          </div>

          <div className="rounded-[24px] border border-border bg-background p-4 text-sm text-muted">
            <p className="font-medium text-primary">Upload avatar</p>
            <label className="mt-3 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-border bg-surface px-4 py-3 text-sm font-medium text-primary">
              <input
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  void handleAvatarUpload(file);
                }}
                className="hidden"
              />
              <UploadSimple size={16} />
              <span className="truncate">{avatarFileName ?? 'Choose image'}</span>
            </label>
            <div className="mt-3 flex items-center gap-2 text-xs text-muted">
              {isUploadingAvatar ? (
                <>
                  <SpinnerGap size={14} className="animate-spin" />
                  <span>Đang upload avatar...</span>
                </>
              ) : (
                <>
                  <UserCircle size={14} />
                  <span>Upload qua API thật rồi lưu object key.</span>
                </>
              )}
            </div>
          </div>
        </aside>
      </form>
    </div>
  );
}
