'use client';

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { Warning, Question, WarningCircle, X } from '@phosphor-icons/react';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'primary' | 'danger' | 'warning';
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    options: ConfirmOptions;
  }>({
    isOpen: false,
    options: { message: '' },
  });

  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    setModalState({
      isOpen: true,
      options: {
        title: options.title || 'Xác nhận hành động',
        message: options.message,
        confirmText: options.confirmText || 'Confirm',
        cancelText: options.cancelText || 'Cancel',
        variant: options.variant || 'primary',
      },
    });

    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const handleConfirm = () => {
    setModalState((prev) => ({ ...prev, isOpen: false }));
    if (resolverRef.current) {
      resolverRef.current(true);
      resolverRef.current = null;
    }
  };

  const handleCancel = () => {
    setModalState((prev) => ({ ...prev, isOpen: false }));
    if (resolverRef.current) {
      resolverRef.current(false);
      resolverRef.current = null;
    }
  };

  const { isOpen, options } = modalState;
  const { title, message, confirmText = 'Confirm', cancelText = 'Cancel', variant = 'primary' } = options;

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {isOpen && (
        <div 
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-zinc-950/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCancel();
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl transition-all space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl border ${
                  variant === 'danger' 
                    ? 'bg-red-50 border-red-200 text-red-600 dark:bg-red-950 dark:border-red-800 dark:text-red-400' 
                    : variant === 'warning'
                    ? 'bg-amber-50 border-amber-200 text-amber-600 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-400'
                    : 'bg-primary/10 border-primary/20 text-primary'
                }`}>
                  {variant === 'danger' && <WarningCircle size={24} weight="fill" />}
                  {variant === 'warning' && <Warning size={24} weight="fill" />}
                  {variant === 'primary' && <Question size={24} weight="fill" />}
                </div>
                <div>
                  <h3 className="text-lg font-semibold tracking-tight text-primary">{title}</h3>
                </div>
              </div>
              <button 
                onClick={handleCancel}
                className="p-1 rounded-lg text-muted hover:text-primary transition-colors"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="text-sm text-muted leading-relaxed">
              <p>{message}</p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2.5 rounded-xl border border-border bg-background hover:bg-primary/5 text-primary text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-border"
              >
                {cancelText}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  variant === 'danger'
                    ? 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-600'
                    : variant === 'warning'
                    ? 'bg-amber-600 hover:bg-amber-700 text-white focus:ring-amber-600'
                    : 'bg-primary hover:opacity-90 text-surface focus:ring-primary'
                }`}
              >
                {confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context.confirm;
}
