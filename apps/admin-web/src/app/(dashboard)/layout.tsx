'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { hasStoredAdminAccessToken } from '@/lib/auth-store';
import { PERMISSIONS, Permission } from '@/lib/permissions';
import { useAuthStore } from '@/lib/auth-store';

function getRequiredPermission(pathname: string): Permission | null {
  if (pathname.startsWith('/concerts')) return PERMISSIONS.CONCERT_CREATE;
  if (pathname.startsWith('/artists')) return PERMISSIONS.AI_GENERATE_BIO;
  if (pathname.startsWith('/venues')) return PERMISSIONS.CONCERT_CREATE;
  if (pathname.startsWith('/events')) return PERMISSIONS.REPORT_VIEW;
  return null;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const permissions = useAuthStore((state) => state.admin?.permissions ?? []);
  const requiredPermission = useMemo(() => getRequiredPermission(pathname), [pathname]);

  useEffect(() => {
    if (!hasStoredAdminAccessToken()) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }

    if (requiredPermission && !permissions.includes(requiredPermission)) {
      router.replace('/forbidden');
    }
  }, [pathname, permissions, requiredPermission, router]);

  return (
    <div className="flex h-screen bg-surface font-sans">
      {/* Mobile sidebar overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-primary/50 backdrop-blur-sm md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar - hidden on mobile unless toggled */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-200 ease-in-out md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <Sidebar onClose={() => setIsSidebarOpen(false)} />
      </div>

      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <Header onMenuClick={() => setIsSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="mx-auto max-w-5xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
