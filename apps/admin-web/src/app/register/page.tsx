"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Link from "next/link";

const registerSchema = z.object({
  fullName: z.string().min(2, { message: "Tên tổ chức quá ngắn" }),
  email: z.string().email({ message: "Email không hợp lệ" }),
  password: z.string().min(6, { message: "Mật khẩu phải có ít nhất 6 ký tự" }),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Mật khẩu xác nhận không khớp",
  path: ["confirmPassword"],
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function AdminRegisterPage() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormValues) => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    console.log("Register data:", data);
  };

  return (
    <div className="absolute inset-0 bg-slate-950 z-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md relative">
        <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl blur opacity-25" />
        
        <div className="relative bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Đăng ký Đối tác</h1>
            <p className="text-slate-400">Trở thành ban tổ chức trên AdminBox</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Tên Tổ chức / Công ty
              </label>
              <input
                {...register("fullName")}
                type="text"
                placeholder="Ví dụ: TicketBox Entertainment"
                className={`w-full px-4 py-3 rounded-xl bg-slate-950 border ${
                  errors.fullName ? "border-rose-500 focus:border-rose-500" : "border-slate-800 focus:border-emerald-500"
                } text-white placeholder-slate-600 focus:outline-none transition-colors`}
              />
              {errors.fullName && <p className="mt-1.5 text-sm text-rose-500">{errors.fullName.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Email Doanh nghiệp
              </label>
              <input
                {...register("email")}
                type="email"
                placeholder="contact@company.com"
                className={`w-full px-4 py-3 rounded-xl bg-slate-950 border ${
                  errors.email ? "border-rose-500 focus:border-rose-500" : "border-slate-800 focus:border-emerald-500"
                } text-white placeholder-slate-600 focus:outline-none transition-colors`}
              />
              {errors.email && <p className="mt-1.5 text-sm text-rose-500">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Mật khẩu
              </label>
              <input
                {...register("password")}
                type="password"
                placeholder="••••••••"
                className={`w-full px-4 py-3 rounded-xl bg-slate-950 border ${
                  errors.password ? "border-rose-500 focus:border-rose-500" : "border-slate-800 focus:border-emerald-500"
                } text-white placeholder-slate-600 focus:outline-none transition-colors`}
              />
              {errors.password && <p className="mt-1.5 text-sm text-rose-500">{errors.password.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Xác nhận mật khẩu
              </label>
              <input
                {...register("confirmPassword")}
                type="password"
                placeholder="••••••••"
                className={`w-full px-4 py-3 rounded-xl bg-slate-950 border ${
                  errors.confirmPassword ? "border-rose-500 focus:border-rose-500" : "border-slate-800 focus:border-emerald-500"
                } text-white placeholder-slate-600 focus:outline-none transition-colors`}
              />
              {errors.confirmPassword && <p className="mt-1.5 text-sm text-rose-500">{errors.confirmPassword.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 px-4 mt-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl font-medium shadow-lg shadow-emerald-500/25 transition-all active:scale-[0.98] flex justify-center items-center gap-2 disabled:opacity-70"
            >
              {isSubmitting ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                "Gửi yêu cầu"
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-slate-400">
            Đã có tài khoản đối tác?{" "}
            <Link href="/login" className="font-medium text-emerald-400 hover:text-emerald-300 transition-colors">
              Đăng nhập
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
