"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { ArrowLeft } from "@phosphor-icons/react";
import { Logo } from "@/components/Logo";
import { authService } from "@/lib/services/auth.service";

const forgotPasswordSchema = z.object({
  email: z.string().email({ message: "Email không hợp lệ" }),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export default function AdminForgotPasswordPage() {
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordFormValues) => {
    setSubmitError(null);
    setSuccessMessage(null);

    try {
      const response = await authService.forgotPassword({
        email: data.email,
        app: "admin",
      });
      setSuccessMessage(response.message);
    } catch (error: unknown) {
      const message =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message === "string"
          ? (error as { response?: { data?: { message?: string } } }).response!.data!.message!
          : "Không thể gửi email khôi phục. Vui lòng thử lại.";
      setSubmitError(message);
    }
  };

  return (
    <div className="absolute inset-0 bg-background z-50 flex items-center justify-center px-4 font-sans">
      <div className="w-full max-w-md relative">
        <div className="relative bg-surface border border-border rounded-2xl p-8 shadow-sm">
          <div className="flex flex-col items-center text-center mb-8">
            <Logo className="mb-2" />
            <p className="text-muted text-sm mt-1">Khôi phục mật khẩu Quản trị viên</p>
          </div>

          {successMessage ? (
            <div className="space-y-4 text-center">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm leading-6 text-emerald-900">
                {successMessage}
              </div>
              <Link
                href="/login"
                className="w-full py-2.5 px-4 border border-border hover:bg-zinc-50 text-primary rounded-lg text-sm font-medium shadow-sm transition-all flex justify-center items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
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
                <label htmlFor="email" className="text-sm font-medium text-primary">
                  Email
                </label>
                <input
                  id="email"
                  {...register("email")}
                  type="email"
                  placeholder="admin@ticketbox.local"
                  className={`w-full rounded-lg border bg-background px-4 py-3 text-sm text-primary outline-none transition-all ${
                    errors.email ? "border-red-500 focus:ring-red-500/20" : "border-border focus:border-primary focus:ring-1 focus:ring-primary"
                  }`}
                />
                {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 rounded-lg bg-primary text-surface text-sm font-medium shadow-sm transition-all hover:opacity-90 disabled:opacity-60"
              >
                {isSubmitting ? "Đang gửi..." : "Gửi email khôi phục"}
              </button>

              <Link
                href="/login"
                className="w-full py-2.5 px-4 border border-border hover:bg-zinc-50 text-primary rounded-lg text-sm font-medium shadow-sm transition-all flex justify-center items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Quay lại đăng nhập
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
