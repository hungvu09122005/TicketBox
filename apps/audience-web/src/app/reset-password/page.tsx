"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { ArrowLeft, Ticket } from "@phosphor-icons/react";
import { authService } from "@/lib/services/auth.service";

const resetPasswordSchema = z.object({
  password: z.string().min(8, { message: "Mật khẩu phải có ít nhất 8 ký tự" }),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Mật khẩu xác nhận không khớp",
  path: ["confirmPassword"],
});

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get("token") ?? "", [searchParams]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setSubmitError("Thiếu token đặt lại mật khẩu trong đường dẫn.");
    }
  }, [token]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const onSubmit = async (data: ResetPasswordFormValues) => {
    if (!token) return;
    setSubmitError(null);
    setSuccessMessage(null);

    try {
      const response = await authService.resetPassword({
        token,
        password: data.password,
      });
      setSuccessMessage(response.message);
    } catch (error: unknown) {
      const message =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message === "string"
          ? (error as { response?: { data?: { message?: string } } }).response!.data!.message!
          : "Không thể đặt lại mật khẩu. Vui lòng thử lại.";
      setSubmitError(message);
    }
  };

  return (
    <div className="min-h-screen flex w-full bg-white text-zinc-950 font-sans">
      <div className="hidden lg:flex w-1/2 relative bg-zinc-950 overflow-hidden items-end p-12">
        <div className="absolute inset-0 z-0">
          <img
            src="/images/login_bg.png"
            alt="Concert crowd"
            className="w-full h-full object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent" />
        </div>

        <div className="relative z-10 w-full max-w-lg">
          <Link href="/" className="inline-flex items-center gap-2 text-white mb-12 hover:opacity-80 transition-opacity">
            <Ticket weight="fill" className="w-8 h-8 text-emerald-500" />
            <span className="font-bold text-2xl tracking-tight">TicketBox</span>
          </Link>
          <blockquote className="space-y-4">
            <p className="text-3xl font-bold text-white tracking-tight leading-tight">
              &ldquo;Đặt lại mật khẩu là bước cuối cùng trước khi bạn quay lại tài khoản.&rdquo;
            </p>
          </blockquote>
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 overflow-y-auto">
        <div className="w-full max-w-[440px] my-auto">
          <Link href="/" className="lg:hidden inline-flex items-center gap-2 text-zinc-950 mb-12">
            <Ticket weight="fill" className="w-8 h-8 text-emerald-500" />
            <span className="font-bold text-2xl tracking-tight">TicketBox</span>
          </Link>

          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-950 mb-2">Đặt lại mật khẩu</h1>
            <p className="text-zinc-500 mb-8">
              Nhập mật khẩu mới cho tài khoản của bạn.
            </p>

            {successMessage ? (
              <div className="space-y-5">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm leading-relaxed text-emerald-900">
                  {successMessage}
                </div>
                <Link
                  href="/login"
                  className="w-full h-12 bg-zinc-950 hover:bg-zinc-800 text-white rounded-xl font-medium transition-all active:scale-[0.98] flex justify-center items-center gap-2"
                >
                  <ArrowLeft weight="bold" className="w-4 h-4" />
                  Quay lại đăng nhập
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                {submitError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {submitError}
                  </div>
                )}

                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-medium text-zinc-950">
                    Mật khẩu mới
                  </label>
                  <input
                    id="password"
                    {...register("password")}
                    type="password"
                    placeholder="••••••••"
                    className={`w-full h-12 px-4 rounded-xl bg-white border ${
                      errors.password ? "border-red-500 focus:ring-red-500/20" : "border-zinc-200 focus:border-emerald-500 focus:ring-emerald-500/20"
                    } text-zinc-950 placeholder-zinc-400 focus:outline-none focus:ring-4 transition-all`}
                  />
                  {errors.password && <p className="text-sm text-red-500">{errors.password.message}</p>}
                </div>

                <div className="space-y-2">
                  <label htmlFor="confirmPassword" className="text-sm font-medium text-zinc-950">
                    Xác nhận mật khẩu
                  </label>
                  <input
                    id="confirmPassword"
                    {...register("confirmPassword")}
                    type="password"
                    placeholder="••••••••"
                    className={`w-full h-12 px-4 rounded-xl bg-white border ${
                      errors.confirmPassword ? "border-red-500 focus:ring-red-500/20" : "border-zinc-200 focus:border-emerald-500 focus:ring-emerald-500/20"
                    } text-zinc-950 placeholder-zinc-400 focus:outline-none focus:ring-4 transition-all`}
                  />
                  {errors.confirmPassword && <p className="text-sm text-red-500">{errors.confirmPassword.message}</p>}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || !token}
                  className="w-full h-12 mt-4 bg-zinc-950 hover:bg-zinc-800 text-white rounded-xl font-medium transition-all active:scale-[0.98] flex justify-center items-center gap-2 disabled:opacity-70"
                >
                  {isSubmitting ? (
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    "Lưu mật khẩu mới"
                  )}
                </button>

                <Link
                  href="/login"
                  className="w-full h-12 bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-950 rounded-xl font-medium transition-all active:scale-[0.98] flex justify-center items-center gap-2"
                >
                  <ArrowLeft weight="bold" className="w-4 h-4" />
                  Quay lại đăng nhập
                </Link>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white flex items-center justify-center">Loading...</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
