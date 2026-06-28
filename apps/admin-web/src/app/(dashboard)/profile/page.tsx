'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { ArrowClockwise, CheckCircle } from '@phosphor-icons/react';
import { useAuthStore } from '@/lib/auth-store';
import { getStoredAdminAccessToken, getStoredAdminRefreshToken } from '@/lib/auth-session';
import { authService } from '@/lib/services/auth.service';

const profileSchema = z
  .object({
    name: z.string().trim().min(2, 'Tên phải có ít nhất 2 ký tự').max(100, 'Tên tối đa 100 ký tự'),
    currentPassword: z.string().min(8, 'Mật khẩu hiện tại phải có ít nhất 8 ký tự'),
    newPassword: z.string().min(8, 'Mật khẩu mới phải có ít nhất 8 ký tự'),
    confirmPassword: z.string().min(8, 'Mật khẩu xác nhận phải có ít nhất 8 ký tự'),
  })
  .refine((values) => values.currentPassword !== values.newPassword, {
    message: 'Mật khẩu mới phải khác mật khẩu hiện tại.',
    path: ['newPassword'],
  });

const profileSchemaWithConfirm = profileSchema.refine((values) => values.newPassword === values.confirmPassword, {
  message: 'Mật khẩu xác nhận không khớp.',
  path: ['confirmPassword'],
});

type ProfileFormValues = z.infer<typeof profileSchemaWithConfirm>;

export default function ProfilePage() {
  const admin = useAuthStore((state) => state.admin);
  const login = useAuthStore((state) => state.login);
  const logout = useAuthStore((state) => state.logout);
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchemaWithConfirm),
    defaultValues: {
      name: admin?.name ?? '',
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        setIsLoading(true);
        const profile = await authService.getMyProfile();
        if (!isMounted) return;
        reset({
          name: profile.name,
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        });
        const accessToken = getStoredAdminAccessToken() ?? '';
        const refreshToken = getStoredAdminRefreshToken() ?? undefined;
        login(profile, accessToken, refreshToken);
      } catch (error) {
        console.error('Failed to load admin profile', error);
        if (isMounted) {
          setErrorMessage('Không thể tải hồ sơ của bạn.');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, [login, reset]);

  const onSubmit = async (values: ProfileFormValues) => {
    try {
      setIsSaving(true);
      setErrorMessage(null);
      setMessage(null);

      const updatedProfile = await authService.updateMyProfile({ name: values.name });
      await authService.changeMyPassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      reset({
        name: updatedProfile.name,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setMessage('Đã cập nhật tên và mật khẩu.');
      logout();
      window.setTimeout(() => {
        router.replace('/login');
      }, 900);
    } catch (error) {
      console.error('Failed to update admin profile', error);
      setErrorMessage('Không thể cập nhật hồ sơ.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="space-y-6">
      <div className="rounded-[28px] border border-border bg-surface p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted">My profile</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-primary">Hồ sơ của tôi</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
          Bạn chỉ có thể cập nhật tên và mật khẩu của chính mình.
        </p>
      </div>

      {isLoading ? (
        <div className="rounded-[28px] border border-border bg-surface p-8 text-center shadow-sm">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
          <p className="mt-4 text-sm text-muted">Đang tải hồ sơ...</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="rounded-[28px] border border-border bg-background p-6 shadow-sm">
          <div className="grid gap-4">
            {errorMessage ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {errorMessage}
              </div>
            ) : null}
            {message ? (
              <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                <CheckCircle size={16} weight="fill" />
                {message}
              </div>
            ) : null}

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-primary">Name</span>
              <input
                {...register('name')}
                type="text"
                className="h-12 w-full rounded-xl border border-border bg-surface px-4 text-sm text-primary outline-none placeholder:text-muted/60 focus:border-primary focus:ring-1 focus:ring-primary"
              />
              {errors.name ? <p className="mt-1.5 text-xs text-rose-600">{errors.name.message}</p> : null}
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-primary">Current password</span>
              <input
                {...register('currentPassword')}
                type="password"
                className="h-12 w-full rounded-xl border border-border bg-surface px-4 text-sm text-primary outline-none placeholder:text-muted/60 focus:border-primary focus:ring-1 focus:ring-primary"
              />
              {errors.currentPassword ? (
                <p className="mt-1.5 text-xs text-rose-600">{errors.currentPassword.message}</p>
              ) : null}
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-primary">New password</span>
              <input
                {...register('newPassword')}
                type="password"
                className="h-12 w-full rounded-xl border border-border bg-surface px-4 text-sm text-primary outline-none placeholder:text-muted/60 focus:border-primary focus:ring-1 focus:ring-primary"
              />
              {errors.newPassword ? <p className="mt-1.5 text-xs text-rose-600">{errors.newPassword.message}</p> : null}
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-primary">Confirm password</span>
              <input
                {...register('confirmPassword')}
                type="password"
                className="h-12 w-full rounded-xl border border-border bg-surface px-4 text-sm text-primary outline-none placeholder:text-muted/60 focus:border-primary focus:ring-1 focus:ring-primary"
              />
              {errors.confirmPassword ? (
                <p className="mt-1.5 text-xs text-rose-600">{errors.confirmPassword.message}</p>
              ) : null}
            </label>

            <button
              type="submit"
              disabled={isSaving || !isDirty}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-surface transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? <ArrowClockwise size={16} className="animate-spin" /> : null}
              {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
