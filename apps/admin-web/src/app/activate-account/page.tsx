"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react";
import { Logo } from "@/components/Logo";
import { authService } from "@/lib/services/auth.service";

function AdminActivateAccountContent() {
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
    <div className="absolute inset-0 bg-background z-50 flex items-center justify-center px-4 font-sans">
      <div className="w-full max-w-md relative">
        <div className="relative bg-surface border border-border rounded-2xl p-8 shadow-sm">
          <div className="flex flex-col items-center text-center mb-8">
            <Logo className="mb-2" />
            <p className="text-muted text-sm mt-1">Kích hoạt tài khoản từ email</p>
          </div>

          <div className="space-y-4 text-center">
            <div className={`rounded-xl px-4 py-4 text-sm leading-6 ${errorMessage ? 'border border-red-200 bg-red-50 text-red-700' : 'border border-border bg-background text-primary'}`}>
              {errorMessage ?? successMessage ?? (loading ? "Đang xác minh token..." : "Sẵn sàng kích hoạt tài khoản.")}
            </div>

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
  );
}

export default function AdminActivateAccountPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center">Loading...</div>}>
      <AdminActivateAccountContent />
    </Suspense>
  );
}
