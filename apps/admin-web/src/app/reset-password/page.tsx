"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { ArrowLeft } from "@phosphor-icons/react";
import { Logo } from "@/components/Logo";
import { authService } from "@/lib/services/auth.service";

const resetPasswordSchema = z.object({
  password: z.string().min(8, { message: "Password must be at least 8 characters" }),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Confirmation password does not match",
  path: ["confirmPassword"],
});

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

function AdminResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get("token") ?? "", [searchParams]);
  const [submitError, setSubmitError] = useState<string | null>(token ? null : "Missing reset token in the URL.");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
          : "Could not reset the password. Please try again.";
      setSubmitError(message);
    }
  };

  return (
    <div className="absolute inset-0 bg-background z-50 flex items-center justify-center px-4 font-sans">
      <div className="w-full max-w-md relative">
        <div className="relative bg-surface border border-border rounded-2xl p-8 shadow-sm">
          <div className="flex flex-col items-center text-center mb-8">
            <Logo className="mb-2" />
            <p className="text-muted text-sm mt-1">Reset an administrator password</p>
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
                Back to sign in
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
                <label htmlFor="password" className="text-sm font-medium text-primary">
                  New password
                </label>
                <input
                  id="password"
                  {...register("password")}
                  type="password"
                  placeholder="••••••••"
                  className={`w-full rounded-lg border bg-background px-4 py-3 text-sm text-primary outline-none transition-all ${
                    errors.password ? "border-red-500 focus:ring-red-500/20" : "border-border focus:border-primary focus:ring-1 focus:ring-primary"
                  }`}
                />
                {errors.password && <p className="text-sm text-red-500">{errors.password.message}</p>}
              </div>

              <div className="space-y-2">
                <label htmlFor="confirmPassword" className="text-sm font-medium text-primary">
                  Confirm password
                </label>
                <input
                  id="confirmPassword"
                  {...register("confirmPassword")}
                  type="password"
                  placeholder="••••••••"
                  className={`w-full rounded-lg border bg-background px-4 py-3 text-sm text-primary outline-none transition-all ${
                    errors.confirmPassword ? "border-red-500 focus:ring-red-500/20" : "border-border focus:border-primary focus:ring-1 focus:ring-primary"
                  }`}
                />
                {errors.confirmPassword && <p className="text-sm text-red-500">{errors.confirmPassword.message}</p>}
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !token}
                className="w-full py-2.5 px-4 rounded-lg bg-primary text-surface text-sm font-medium shadow-sm transition-all hover:opacity-90 disabled:opacity-60"
              >
                {isSubmitting ? "Saving..." : "Save new password"}
              </button>

              <Link
                href="/login"
                className="w-full py-2.5 px-4 border border-border hover:bg-zinc-50 text-primary rounded-lg text-sm font-medium shadow-sm transition-all flex justify-center items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to sign in
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center">Loading...</div>}>
      <AdminResetPasswordForm />
    </Suspense>
  );
}
