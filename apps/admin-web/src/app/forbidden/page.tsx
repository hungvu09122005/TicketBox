"use client";

import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-6 text-center">
      <div className="max-w-md">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-muted">403 Forbidden</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-primary">You do not have access</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          The current account does not have permission to use this feature. If this looks wrong, sign in again or contact the system administrator.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            href="/concerts"
            className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-surface transition-colors hover:opacity-90"
          >
            Go to admin home
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/5"
          >
            Sign in again
          </Link>
        </div>
      </div>
    </div>
  );
}
