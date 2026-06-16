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
import { hasStoredAccessToken } from "@/lib/auth-store";

const registerSchema = z.object({
  fullName: z.string().min(2, { message: "Họ tên quá ngắn" }),
  email: z.string().email({ message: "Email không hợp lệ" }),
  password: z.string().min(8, { message: "Mật khẩu phải có ít nhất 8 ký tự" }),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Mật khẩu xác nhận không khớp",
  path: ["confirmPassword"],
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
  });

  useEffect(() => {
    if (hasStoredAccessToken()) {
      router.replace(searchParams.get("next") || "/concerts");
    }
  }, [router, searchParams]);

  const onSubmit = async (data: RegisterFormValues) => {
    setSubmitError(null);
    try {
      await authService.register({
        name: data.fullName,
        email: data.email,
        password: data.password,
      });

      const nextPath = searchParams.get("next") || "/concerts";
      router.replace(`/login?next=${encodeURIComponent(nextPath)}`);
    } catch (error: unknown) {
      const message =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message === "string"
          ? (error as { response?: { data?: { message?: string } } }).response!.data!.message!
          : "Đăng ký thất bại. Vui lòng thử lại.";
      setSubmitError(message);
    }
  };

  return (
    <div className="min-h-screen flex w-full bg-white text-zinc-950 font-sans">
      {/* Left Column: Image / Branding */}
      <div className="hidden lg:flex w-1/2 relative bg-zinc-950 overflow-hidden items-end p-12">
        <div className="absolute inset-0 z-0">
          <img
            src="/images/register_bg.jpg"
            alt="Festival atmosphere"
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
              &ldquo;Khám phá các sự kiện hấp dẫn nhất quanh bạn, theo dõi nghệ sĩ yêu thích và mua vé an toàn, nhanh chóng.&rdquo;
            </p>
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
              Tạo tài khoản mới
            </h1>
            <p className="text-zinc-500 mb-8">
              Bắt đầu hành trình trải nghiệm các sự kiện đỉnh cao.
            </p>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {submitError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {submitError}
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-950">Họ và tên</label>
                <input
                  {...register("fullName")}
                  type="text"
                  placeholder="Nguyễn Văn A"
                  className={`w-full h-12 px-4 rounded-xl bg-white border ${errors.fullName ? "border-red-500 focus:ring-red-500/20" : "border-zinc-200 focus:border-emerald-500 focus:ring-emerald-500/20"
                    } text-zinc-950 placeholder-zinc-400 focus:outline-none focus:ring-4 transition-all`}
                />
                {errors.fullName && <p className="text-sm text-red-500">{errors.fullName.message}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-950">Email</label>
                <input
                  {...register("email")}
                  type="email"
                  placeholder="name@example.com"
                  className={`w-full h-12 px-4 rounded-xl bg-white border ${errors.email ? "border-red-500 focus:ring-red-500/20" : "border-zinc-200 focus:border-emerald-500 focus:ring-emerald-500/20"
                    } text-zinc-950 placeholder-zinc-400 focus:outline-none focus:ring-4 transition-all`}
                />
                {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-950">Mật khẩu</label>
                <input
                  {...register("password")}
                  type="password"
                  placeholder="••••••••"
                  className={`w-full h-12 px-4 rounded-xl bg-white border ${errors.password ? "border-red-500 focus:ring-red-500/20" : "border-zinc-200 focus:border-emerald-500 focus:ring-emerald-500/20"
                    } text-zinc-950 placeholder-zinc-400 focus:outline-none focus:ring-4 transition-all`}
                />
                {errors.password && <p className="text-sm text-red-500">{errors.password.message}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-950">Xác nhận mật khẩu</label>
                <input
                  {...register("confirmPassword")}
                  type="password"
                  placeholder="••••••••"
                  className={`w-full h-12 px-4 rounded-xl bg-white border ${errors.confirmPassword ? "border-red-500 focus:ring-red-500/20" : "border-zinc-200 focus:border-emerald-500 focus:ring-emerald-500/20"
                    } text-zinc-950 placeholder-zinc-400 focus:outline-none focus:ring-4 transition-all`}
                />
                {errors.confirmPassword && <p className="text-sm text-red-500">{errors.confirmPassword.message}</p>}
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
                    Tạo tài khoản
                    <ArrowRight weight="bold" className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <p className="mt-8 text-center text-sm text-zinc-500">
              Đã có tài khoản?{" "}
              <Link href="/login" className="font-semibold text-zinc-950 hover:text-emerald-600 transition-colors">
                Đăng nhập tại đây
              </Link>
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
