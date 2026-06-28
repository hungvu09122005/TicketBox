"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Ticket } from "@phosphor-icons/react";
import { authService } from "@/lib/services/auth.service";

function ActivateAccountContent() {
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get("token") ?? "", [searchParams]);
  const [loading, setLoading] = useState(Boolean(token));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setErrorMessage("Thiếu token kích hoạt trong đường dẫn.");
      setLoading(false);
      return;
    }

    let isMounted = true;

    const activate = async () => {
      try {
        const response = await authService.activateAccount(token);
        if (!isMounted) return;
        setSuccessMessage(response.message);
        setErrorMessage(null);
      } catch (error: unknown) {
        if (!isMounted) return;
        const message =
          typeof error === "object" &&
          error !== null &&
          "response" in error &&
          typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message === "string"
            ? (error as { response?: { data?: { message?: string } } }).response!.data!.message!
            : "Không thể kích hoạt tài khoản. Vui lòng thử lại.";
        setErrorMessage(message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void activate();

    return () => {
      isMounted = false;
    };
  }, [token]);

  return (
    <div className="min-h-screen flex w-full bg-white text-zinc-950 font-sans">
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
              &ldquo;Kích hoạt tài khoản xong là có thể đăng nhập ngay.&rdquo;
            </p>
          </blockquote>
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 overflow-y-auto">
        <div className="w-full max-w-[440px] my-auto">
          <Link href="/" className="lg:hidden inline-flex items-center gap-2 text-zinc-950 mb-12">
            <Ticket weight="fill" className="w-8 h-8 text-emerald-500" />
            <span className="font-bold text-2xl tracking-tight">TicketBox</span>
          </Link>

          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-950 mb-2">Kích hoạt tài khoản</h1>
            <p className="text-zinc-500 mb-8">
              {loading ? "Đang xác minh token..." : "Xác nhận để hoàn tất kích hoạt tài khoản."}
            </p>

            {errorMessage ? (
              <div className="space-y-5">
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm leading-relaxed text-red-700">
                  {errorMessage}
                </div>
                <Link
                  href="/login"
                  className="w-full h-12 bg-zinc-950 hover:bg-zinc-800 text-white rounded-xl font-medium transition-all active:scale-[0.98] flex justify-center items-center gap-2"
                >
                  <ArrowLeft weight="bold" className="w-4 h-4" />
                  Quay lại đăng nhập
                </Link>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm leading-relaxed text-zinc-700">
                  {successMessage ?? "Vui lòng chờ trong giây lát."}
                </div>
                <Link
                  href="/login"
                  className="w-full h-12 bg-zinc-950 hover:bg-zinc-800 text-white rounded-xl font-medium transition-all active:scale-[0.98] flex justify-center items-center gap-2"
                >
                  <ArrowLeft weight="bold" className="w-4 h-4" />
                  Đi tới đăng nhập
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ActivateAccountPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white flex items-center justify-center">Loading...</div>}>
      <ActivateAccountContent />
    </Suspense>
  );
}
