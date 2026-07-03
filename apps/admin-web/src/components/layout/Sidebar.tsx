'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  MusicNotes, 
  Users, 
  ChartLineUp,
  ArrowRight,
  ShieldCheck,
  SignOut,
  X
} from '@phosphor-icons/react';
import { Logo } from '@/components/Logo';
import { useAuthStore } from '@/lib/auth-store';
import { Permission } from '@/lib/permissions';

const navigation = [
  { name: 'Concerts', href: '/concerts', icon: MusicNotes, permissions: [Permission.CONCERT_READ_PUBLIC] },
  { name: 'Artists', href: '/artists', icon: Users, permissions: [Permission.ARTIST_READ] },
  { name: 'Operations', href: '/operations', icon: ChartLineUp, permissions: [Permission.REPORT_VIEW] },
  { name: 'Access Control', href: '/rbac', icon: ShieldCheck, permissions: [Permission.RBAC_MANAGE] },
];

const operationsShortcuts = [
  { name: 'Order & payment', href: '/operations/orders' },
  { name: 'Failed jobs', href: '/operations/notifications' },
  { name: 'Reports', href: '/operations/reports' },
  { name: 'Job monitor', href: '/operations/jobs' },
];

const accessControlShortcuts = [
  { name: 'Roles & permissions', href: '/rbac' },
  { name: 'Users', href: '/rbac/users' },
];

export function Sidebar({ onClose }: Readonly<{ onClose?: () => void }>) {
  const pathname = usePathname();
  const router = useRouter();
  const permissions = useAuthStore((state) => state.permissions);
  const logout = useAuthStore((state) => state.logout);

  const canAccess = (required?: string[]) =>
    !required || required.every((permission) => permissions.includes(permission));

  return (
    <div className="flex h-full w-full flex-col border-r border-border bg-surface">
      <div className="flex h-16 shrink-0 items-center justify-between px-6">
        <Logo />
        {onClose && (
          <button onClick={onClose} className="md:hidden p-1 text-muted hover:text-primary">
            <X size={20} />
          </button>
        )}
      </div>
      <div className="flex-1 px-4 py-6 overflow-y-auto">
        <nav className="flex flex-col gap-1">
          {navigation.filter((item) => canAccess(item.permissions)).map((item) => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;
            const isOperations = item.href === '/operations';
            const isAccessControl = item.href === '/rbac';
            return (
              <div key={item.name} className="space-y-1">
                <Link
                  href={item.href}
                  onClick={onClose}
                  className={`flex items-center justify-between gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary text-surface'
                      : 'text-muted hover:bg-primary/5 hover:text-primary'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Icon size={20} weight={isActive ? 'fill' : 'regular'} />
                    {item.name}
                  </span>
                  {isOperations ? <ArrowRight size={14} className="opacity-70" /> : null}
                </Link>

                {isOperations && pathname.startsWith('/operations') && canAccess([Permission.REPORT_VIEW]) ? (
                  <div className="ml-9 space-y-1 border-l border-border pl-3">
                    {operationsShortcuts.map((shortcut) => {
                      const isShortcutActive = pathname === shortcut.href;
                      return (
                        <Link
                          key={shortcut.href}
                          href={shortcut.href}
                          onClick={onClose}
                          className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                            isShortcutActive
                              ? 'bg-primary text-surface'
                              : 'text-muted hover:bg-primary/5 hover:text-primary'
                          }`}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                          {shortcut.name}
                        </Link>
                      );
                    })}
                  </div>
                ) : null}

                {isAccessControl && pathname.startsWith('/rbac') && canAccess([Permission.RBAC_MANAGE]) ? (
                  <div className="ml-9 space-y-1 border-l border-border pl-3">
                    {accessControlShortcuts.map((shortcut) => {
                      const isShortcutActive = pathname === shortcut.href;
                      return (
                        <Link
                          key={shortcut.href}
                          href={shortcut.href}
                          onClick={onClose}
                          className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                            isShortcutActive
                              ? 'bg-primary text-surface'
                              : 'text-muted hover:bg-primary/5 hover:text-primary'
                          }`}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                          {shortcut.name}
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>
        {navigation.filter((item) => canAccess(item.permissions)).length === 0 && (
          <div className="mt-6 rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted">
            Bạn hiện chưa có quyền truy cập menu nào.
          </div>
        )}
      </div>
      <div className="p-4">
        <button
          onClick={() => {
            logout();
            router.replace('/login');
          }}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-primary/5 hover:text-primary"
        >
          <SignOut size={20} />
          Sign out
        </button>
      </div>
    </div>
  );
}
