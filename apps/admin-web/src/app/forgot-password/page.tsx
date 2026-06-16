"use client";

import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react";
import { Logo } from "@/components/Logo";

export default function AdminForgotPasswordPage() {
  return (
    <div className="absolute inset-0 bg-background z-50 flex items-center justify-center px-4 font-sans">
      <div className="w-full max-w-md relative">
        <div className="relative bg-surface border border-border rounded-2xl p-8 shadow-sm">
          <div className="flex flex-col items-center text-center mb-8">
            <Logo variant="admin" className="mb-2" />
            <p className="text-muted text-sm mt-1">Khôi phục mật khẩu Quản trị viên</p>
          </div>

          <div className="space-y-5 text-center">
            <p className="text-primary text-sm">
              Tính năng khôi phục mật khẩu đang được phát triển.
            </p>
            <p className="text-muted text-sm pb-4">
              Vui lòng liên hệ Administrator hệ thống hoặc dev team để được hỗ trợ reset mật khẩu tạm thời.
            </p>
            
            <div className="pt-2">
              <Link
                href="/login"
                className="w-full py-2.5 px-4 border border-border hover:bg-zinc-50 text-primary rounded-lg text-sm font-medium shadow-sm transition-all flex justify-center items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Quay lại đăng nhập
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
