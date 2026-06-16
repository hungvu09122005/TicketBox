"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Ticket, ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { motion } from "motion/react";
import { authService } from "@/lib/services/auth.service";
import { hasStoredAccessToken, useAuthStore } from "@/lib/auth-store";

const loginSchema = z.object({
  email: z.string().email({ message: "Email không hợp lệ" }),
  password: z.string().min(6, { message: "Mật khẩu phải có ít nhất 6 ký tự" }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const login = useAuthStore((state) => state.login);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  useEffect(() => {
    if (hasStoredAccessToken()) {
      router.replace(searchParams.get("next") || "/concerts");
    }
  }, [router, searchParams]);

  const onSubmit = async (data: LoginFormValues) => {
    setSubmitError(null);
    try {
      const tokens = await authService.login(data);
      login({ email: data.email }, tokens.accessToken);
      if (typeof window !== "undefined") {
        localStorage.setItem("refresh_token", tokens.refreshToken);
      }

      const nextPath = searchParams.get("next") || "/concerts";
      router.replace(nextPath);
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
    <div className="min-h-screen flex w-full bg-white text-zinc-950 font-sans">
      {/* Left Column: Image / Branding */}
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
              &ldquo;Nền tảng đặt vé mượt mà nhất tôi từng sử dụng. Trải nghiệm tuyệt vời từ lúc mua vé đến khi quét mã.&rdquo;
            </p>
            <footer className="text-zinc-400 font-medium">
              — Hoàng Minh, Khán giả thường xuyên
            </footer>
          </blockquote>
        </div>
      </div>

      {/* Right Column: Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 overflow-y-auto">
        <div className="w-full max-w-[440px] my-auto">
          {/* Mobile Logo */}
          <Link href="/" className="lg:hidden inline-flex items-center gap-2 text-zinc-950 mb-12">
            <Ticket weight="fill" className="w-8 h-8 text-emerald-500" />
            <span className="font-bold text-2xl tracking-tight">TicketBox</span>
          </Link>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <h1 className="text-3xl font-bold tracking-tight text-zinc-950 mb-2">
              Chào mừng trở lại
            </h1>
            <p className="text-zinc-500 mb-8">
              Đăng nhập tài khoản của bạn để xem concerts.
            </p>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {submitError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {submitError}
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-950">Email</label>
                <input
                  {...register("email")}
                  type="email"
                  placeholder="name@example.com"
                  className={`w-full h-12 px-4 rounded-xl bg-white border ${
                    errors.email ? "border-red-500 focus:ring-red-500/20" : "border-zinc-200 focus:border-emerald-500 focus:ring-emerald-500/20"
                  } text-zinc-950 placeholder-zinc-400 focus:outline-none focus:ring-4 transition-all`}
                />
                {errors.email && (
                  <p className="text-sm text-red-500">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-zinc-950">Mật khẩu</label>
                  <Link href="#" className="text-sm font-medium text-emerald-600 hover:text-emerald-500 transition-colors">
                    Quên mật khẩu?
                  </Link>
                </div>
                <input
                  {...register("password")}
                  type="password"
                  placeholder="••••••••"
                  className={`w-full h-12 px-4 rounded-xl bg-white border ${
                    errors.password ? "border-red-500 focus:ring-red-500/20" : "border-zinc-200 focus:border-emerald-500 focus:ring-emerald-500/20"
                  } text-zinc-950 placeholder-zinc-400 focus:outline-none focus:ring-4 transition-all`}
                />
                {errors.password && (
                  <p className="text-sm text-red-500">{errors.password.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-12 mt-4 bg-zinc-950 hover:bg-zinc-800 text-white rounded-xl font-medium transition-all active:scale-[0.98] flex justify-center items-center gap-2 disabled:opacity-70"
              >
                {isSubmitting ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    Đăng nhập
                    <ArrowRight weight="bold" className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <p className="mt-8 text-center text-sm text-zinc-500">
              Chưa có tài khoản?{" "}
              <Link href="/register" className="font-semibold text-zinc-950 hover:text-emerald-600 transition-colors">
                Đăng ký tại đây
              </Link>
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
