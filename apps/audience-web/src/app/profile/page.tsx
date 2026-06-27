'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { ArrowClockwise, CheckCircle } from '@phosphor-icons/react';
import { Header } from '@/components/Header';
import { hasStoredSession, useAuthStore } from '@/lib/auth-store';
import { getStoredAccessToken, getStoredRefreshToken } from '@/lib/auth-session';
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
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const login = useAuthStore((state) => state.login);
  const logout = useAuthStore((state) => state.logout);
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
      name: user?.name ?? '',
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    if (!hasStoredSession()) {
      router.replace('/login?next=/profile');
      return;
    }

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
        const accessToken = getStoredAccessToken() ?? '';
        const refreshToken = getStoredRefreshToken() ?? undefined;
        login(profile, accessToken, refreshToken);
      } catch (error) {
        console.error('Failed to load audience profile', error);
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
  }, [login, reset, router]);

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
      console.error('Failed to update audience profile', error);
      setErrorMessage('Không thể cập nhật hồ sơ.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!hasStoredSession()) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#050816] text-white selection:bg-amber-300/30">
      <Header />

      <main className="relative overflow-hidden pt-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(249,115,22,0.22),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.18),_transparent_28%),linear-gradient(180deg,_#020617_0%,_#050816_45%,_#09090b_100%)]" />
        <section className="relative mx-auto max-w-[1200px] px-4 py-10 sm:px-6 lg:px-8 lg:py-16">
          <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.18)] backdrop-blur-xl">
            <p className="text-[11px] uppercase tracking-[0.22em] text-white/55">My profile</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Hồ sơ của tôi</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/68">
              Cập nhật tên và mật khẩu của bạn. Email không thể tự chỉnh sửa từ màn hình này.
            </p>
          </div>

          {isLoading ? (
            <div className="mt-6 rounded-[28px] border border-white/10 bg-white/5 p-10 text-center backdrop-blur-xl">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
              <p className="mt-4 text-sm text-white/65">Đang tải hồ sơ...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="mt-6 rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
              <div className="grid gap-4">
                {errorMessage ? (
                  <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-50">
                    {errorMessage}
                  </div>
                ) : null}
                {message ? (
                  <div className="flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                    <CheckCircle size={16} weight="fill" />
                    {message}
                  </div>
                ) : null}

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-white/75">Name</span>
                  <input
                    {...register('name')}
                    type="text"
                    className="h-12 w-full rounded-xl border border-white/10 bg-zinc-950/70 px-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/25 focus:ring-1 focus:ring-white/20"
                  />
                  {errors.name ? <p className="mt-1.5 text-xs text-rose-300">{errors.name.message}</p> : null}
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-white/75">Current password</span>
                  <input
                    {...register('currentPassword')}
                    type="password"
                    className="h-12 w-full rounded-xl border border-white/10 bg-zinc-950/70 px-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/25 focus:ring-1 focus:ring-white/20"
                  />
                  {errors.currentPassword ? (
                    <p className="mt-1.5 text-xs text-rose-300">{errors.currentPassword.message}</p>
                  ) : null}
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-white/75">New password</span>
                  <input
                    {...register('newPassword')}
                    type="password"
                    className="h-12 w-full rounded-xl border border-white/10 bg-zinc-950/70 px-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/25 focus:ring-1 focus:ring-white/20"
                  />
                  {errors.newPassword ? <p className="mt-1.5 text-xs text-rose-300">{errors.newPassword.message}</p> : null}
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-white/75">Confirm password</span>
                  <input
                    {...register('confirmPassword')}
                    type="password"
                    className="h-12 w-full rounded-xl border border-white/10 bg-zinc-950/70 px-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/25 focus:ring-1 focus:ring-white/20"
                  />
                  {errors.confirmPassword ? (
                    <p className="mt-1.5 text-xs text-rose-300">{errors.confirmPassword.message}</p>
                  ) : null}
                </label>

                <button
                  type="submit"
                  disabled={isSaving || !isDirty}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-zinc-950 transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSaving ? <ArrowClockwise size={16} className="animate-spin" /> : null}
                  {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}
