'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { authService } from '@/lib/services/auth.service';
import { hasStoredAdminSession, useAuthStore } from '@/lib/auth-store';
import { getStoredAdminAccessToken, getStoredAdminRefreshToken } from '@/lib/auth-session';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const login = useAuthStore((state) => state.login);
  const logout = useAuthStore((state) => state.logout);

  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      if (!hasStoredAdminSession()) {
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        if (isMounted) setIsBootstrapping(false);
        return;
      }

      try {
        const profile = await authService.me();
        const accessToken = getStoredAdminAccessToken() ?? '';
        const refreshToken = getStoredAdminRefreshToken() ?? undefined;
        if (isMounted) {
          login(profile, accessToken, refreshToken);
          setIsBootstrapping(false);
        }
      } catch (error) {
        logout();
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        if (isMounted) setIsBootstrapping(false);
        console.error('Failed to bootstrap admin session', error);
      }
    };

    void bootstrap();

    return () => {
      isMounted = false;
    };
  }, [login, logout, pathname, router]);

  if (isBootstrapping) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface text-primary">
        <div className="flex items-center gap-3 text-sm text-muted">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
          Verifying session...
        </div>
      </div>
    );
  }

  if (!hasStoredAdminSession()) {
    return null;
  }

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
