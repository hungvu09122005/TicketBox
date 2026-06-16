'use client';

import { List } from '@phosphor-icons/react';
import { useAuthStore } from '@/lib/auth-store';

export function Header({ onMenuClick }: Readonly<{ onMenuClick?: () => void }>) {
  const admin = useAuthStore((state) => state.admin);

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-surface px-4 md:px-6">
      <div className="flex items-center gap-4">
        <button 
          onClick={onMenuClick}
          className="md:hidden p-2 -ml-2 text-primary hover:bg-primary/5 rounded-md"
        >
          <List size={24} />
        </button>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <div className="text-sm font-medium text-primary">{admin?.name ?? 'Admin User'}</div>
            <div className="text-xs text-muted">{admin?.email ?? 'admin@ticketbox.vn'}</div>
          </div>
          <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center text-surface font-medium shadow-sm">
            {(admin?.name ?? 'A').charAt(0).toUpperCase()}
          </div>
        </div>
      </div>
    </header>
  );
}
