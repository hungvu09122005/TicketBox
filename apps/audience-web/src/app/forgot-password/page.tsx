"use client";

import Link from "next/link";
import { Ticket, ArrowLeft } from "@phosphor-icons/react";

export default function ForgotPasswordPage() {
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

          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-950 mb-2">
              Quên mật khẩu?
            </h1>
            <p className="text-zinc-500 mb-8">
              Đừng lo lắng! Tính năng khôi phục mật khẩu đang được phát triển.
            </p>

            <div className="space-y-5">
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm text-zinc-700 leading-relaxed text-center">
                Tính năng gửi email khôi phục mật khẩu sẽ sớm ra mắt trong phiên bản sắp tới. Vui lòng thử lại sau!
              </div>

              <Link
                href="/login"
                className="w-full h-12 mt-4 bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-950 rounded-xl font-medium transition-all active:scale-[0.98] flex justify-center items-center gap-2"
              >
                <ArrowLeft weight="bold" className="w-4 h-4" />
                Quay lại đăng nhập
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
