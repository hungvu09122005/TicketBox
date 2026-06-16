"use client";

import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050816] px-6 text-center text-white">
      <div className="max-w-md">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/55">403 Forbidden</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Bạn không có quyền truy cập trang này</h1>
        <p className="mt-3 text-sm leading-6 text-white/70">
          Yêu cầu này bị backend từ chối vì tài khoản hiện tại chưa đủ quyền.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            href="/concerts"
            className="rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-zinc-950 transition-transform hover:-translate-y-0.5"
          >
            Về concerts
          </Link>
          <Link
            href="/login"
            className="rounded-full border border-white/15 px-4 py-2.5 text-sm font-semibold text-white/90 transition-colors hover:bg-white/10"
          >
            Đăng nhập lại
          </Link>
        </div>
      </div>
    </div>
  );
}
