"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/Logo";
import { authService } from "@/lib/services/auth.service";
import { useAuthStore } from "@/lib/auth-store";

const loginSchema = z.object({
  email: z.string().email({ message: "Email không hợp lệ" }),
  password: z.string().min(6, { message: "Mật khẩu phải có ít nhất 6 ký tự" }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function AdminLoginPage() {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormValues) => {
    setSubmitError(null);
    try {
      const tokens = await authService.login(data);
      login({ email: data.email }, tokens.accessToken);
      if (typeof window !== "undefined") {
        localStorage.setItem("admin_refresh_token", tokens.refreshToken);
      }
      router.replace("/concerts");
    } catch (error: unknown) {
      const message =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message === "string"
          ? (error as { response?: { data?: { message?: string } } }).response!.data!.message!
          : "Đăng nhập thất bại. Vui lòng thử lại.";
      setSubmitError(message);
    }
  };

  return (
    <div className="absolute inset-0 bg-background z-50 flex items-center justify-center px-4 font-sans">
      <div className="w-full max-w-md relative">
        <div className="relative bg-surface border border-border rounded-2xl p-8 shadow-sm">
          <div className="flex flex-col items-center text-center mb-8">
            <Logo variant="admin" className="mb-2" />
            <p className="text-muted text-sm mt-1">Đăng nhập tài khoản Quản trị viên</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {submitError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {submitError}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-primary mb-1.5">
                Email
              </label>
              <input
                {...register("email")}
                type="email"
                placeholder="admin@ticketbox.com"
                className={`w-full px-4 py-2.5 text-sm rounded-lg bg-surface border ${
                  errors.email ? "border-red-500 focus:border-red-500" : "border-border focus:border-primary"
                } text-primary placeholder-muted focus:outline-none focus:ring-1 focus:ring-primary transition-colors`}
              />
              {errors.email && (
                <p className="mt-1.5 text-xs text-red-500">{errors.email.message}</p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-primary">
                  Mật khẩu
                </label>
                <a href="#" className="text-sm font-medium text-muted hover:text-primary transition-colors">
                  Quên mật khẩu?
                </a>
              </div>
              <input
                {...register("password")}
                type="password"
                placeholder="••••••••"
                className={`w-full px-4 py-2.5 text-sm rounded-lg bg-surface border ${
                  errors.password ? "border-red-500 focus:border-red-500" : "border-border focus:border-primary"
                } text-primary placeholder-muted focus:outline-none focus:ring-1 focus:ring-primary transition-colors`}
              />
              {errors.password && (
                <p className="mt-1.5 text-xs text-red-500">{errors.password.message}</p>
              )}
            </div>

            <div className="pt-2">
              <button
                 type="submit"
                 disabled={isSubmitting}
                 className="w-full py-2.5 px-4 bg-primary hover:opacity-90 text-surface rounded-lg text-sm font-medium shadow-sm transition-all flex justify-center items-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span className="w-4 h-4 border-2 border-surface/30 border-t-surface rounded-full animate-spin" />
                ) : (
                  "Đăng nhập"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
