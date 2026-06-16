'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  MusicNotes, 
  Users, 
  MapPin, 
  Calendar, 
  SignOut,
  X
} from '@phosphor-icons/react';
import { Logo } from '@/components/Logo';
import { useAuthStore } from '@/lib/auth-store';
import { Permission } from '@/lib/permissions';

const navigation = [
  { name: 'Concerts', href: '/concerts', icon: MusicNotes, permissions: [Permission.CONCERT_READ] },
  { name: 'Artists', href: '/artists', icon: Users, permissions: [Permission.CONCERT_READ] },
  { name: 'Venues', href: '/venues', icon: MapPin, permissions: [Permission.CONCERT_READ] },
  { name: 'Events', href: '/events', icon: Calendar, permissions: [Permission.REPORT_VIEW] },
];

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const permissions = useAuthStore((state) => state.permissions);
  const logout = useAuthStore((state) => state.logout);

  const canAccess = (required?: string[]) =>
    !required || required.every((permission) => permissions.includes(permission));

  return (
    <div className="flex h-full w-full flex-col border-r border-border bg-surface">
      <div className="flex h-16 shrink-0 items-center justify-between px-6">
        <Logo variant="admin" />
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
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary text-surface'
                    : 'text-muted hover:bg-primary/5 hover:text-primary'
                }`}
              >
                <Icon size={20} weight={isActive ? 'fill' : 'regular'} />
                {item.name}
              </Link>
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
