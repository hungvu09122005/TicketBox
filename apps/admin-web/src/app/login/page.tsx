"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Link from "next/link";

const loginSchema = z.object({
  email: z.string().email({ message: "Email không hợp lệ" }),
  password: z.string().min(6, { message: "Mật khẩu phải có ít nhất 6 ký tự" }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function AdminLoginPage() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormValues) => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    console.log("Admin Login data:", data);
  };

  return (
    <div className="absolute inset-0 bg-slate-950 z-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md relative">
        {/* Glow effect */}
        <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl blur opacity-25" />
        
        <div className="relative bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">AdminBox</h1>
            <p className="text-slate-400">Đăng nhập tài khoản Quản trị viên</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Email
              </label>
              <input
                {...register("email")}
                type="email"
                placeholder="admin@ticketbox.com"
                className={`w-full px-4 py-3 rounded-xl bg-slate-950 border ${
                  errors.email ? "border-rose-500 focus:border-rose-500" : "border-slate-800 focus:border-emerald-500"
                } text-white placeholder-slate-600 focus:outline-none transition-colors`}
              />
              {errors.email && (
                <p className="mt-1.5 text-sm text-rose-500">{errors.email.message}</p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-slate-300">
                  Mật khẩu
                </label>
                <a href="#" className="text-sm font-medium text-emerald-400 hover:text-emerald-300 transition-colors">
                  Quên mật khẩu?
                </a>
              </div>
              <input
                {...register("password")}
                type="password"
                placeholder="••••••••"
                className={`w-full px-4 py-3 rounded-xl bg-slate-950 border ${
                  errors.password ? "border-rose-500 focus:border-rose-500" : "border-slate-800 focus:border-emerald-500"
                } text-white placeholder-slate-600 focus:outline-none transition-colors`}
              />
              {errors.password && (
                <p className="mt-1.5 text-sm text-rose-500">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl font-medium shadow-lg shadow-emerald-500/25 transition-all active:scale-[0.98] flex justify-center items-center gap-2 disabled:opacity-70"
            >
              {isSubmitting ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                "Đăng nhập"
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-slate-400">
            Chưa có tài khoản đối tác?{" "}
            <Link href="/register" className="font-medium text-emerald-400 hover:text-emerald-300 transition-colors">
              Đăng ký ngay
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
