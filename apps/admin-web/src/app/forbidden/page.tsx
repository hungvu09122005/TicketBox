import Link from 'next/link';

export default function ForbiddenPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-6">
      <div className="max-w-md text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-muted">403 Forbidden</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-primary">
          Bạn không có quyền truy cập trang này
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          Tài khoản hiện tại không có permission phù hợp để mở route này.
        </p>
        <Link
          href="/concerts"
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-surface"
        >
          Về Concerts
        </Link>
      </div>
    </div>
  );
}
