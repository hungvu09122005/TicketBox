'use client';

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { CheckCircle, WarningCircle, Info, X, Warning } from '@phosphor-icons/react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastOptions {
  id?: string;
  type?: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

export interface ToastItem extends Required<Omit<ToastOptions, 'id'>> {
  id: string;
}

interface ToastContextType {
  showToast: (options: ToastOptions) => void;
  toast: {
    success: (message: string, title?: string, duration?: number) => void;
    error: (message: string, title?: string, duration?: number) => void;
    info: (message: string, title?: string, duration?: number) => void;
    warning: (message: string, title?: string, duration?: number) => void;
  };
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(({ type = 'info', title, message, duration = 4000 }: ToastOptions) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: ToastItem = {
      id,
      type,
      title: title || (type === 'success' ? 'Thành công' : type === 'error' ? 'Lỗi' : type === 'warning' ? 'Cảnh báo' : 'Thông báo'),
      message,
      duration,
    };

    setToasts((prev) => [...prev, newToast]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  const toast = useMemo(
    () => ({
      success: (message: string, title?: string, duration?: number) =>
        showToast({ type: 'success', message, title, duration }),
      error: (message: string, title?: string, duration?: number) =>
        showToast({ type: 'error', message, title, duration }),
      info: (message: string, title?: string, duration?: number) =>
        showToast({ type: 'info', message, title, duration }),
      warning: (message: string, title?: string, duration?: number) =>
        showToast({ type: 'warning', message, title, duration }),
    }),
    [showToast]
  );

  return (
    <ToastContext.Provider value={{ showToast, toast, removeToast }}>
      {children}
      {/* Toast Render Container */}
      <div className="fixed bottom-5 right-5 z-[99999] flex flex-col gap-2.5 max-w-md w-full px-4 pointer-events-none">
        {toasts.map((item) => (
          <div
            key={item.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-lg transition-all duration-300 transform translate-y-0 ${
              item.type === 'success'
                ? 'bg-emerald-50/95 border-emerald-200 text-emerald-950 dark:bg-emerald-950/90 dark:border-emerald-800 dark:text-emerald-100'
                : item.type === 'error'
                ? 'bg-red-50/95 border-red-200 text-red-950 dark:bg-red-950/90 dark:border-red-800 dark:text-red-100'
                : item.type === 'warning'
                ? 'bg-amber-50/95 border-amber-200 text-amber-950 dark:bg-amber-950/90 dark:border-amber-800 dark:text-amber-100'
                : 'bg-blue-50/95 border-blue-200 text-blue-950 dark:bg-blue-950/90 dark:border-blue-800 dark:text-blue-100'
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {item.type === 'success' && <CheckCircle size={20} className="text-emerald-600 dark:text-emerald-400" weight="fill" />}
              {item.type === 'error' && <WarningCircle size={20} className="text-red-600 dark:text-red-400" weight="fill" />}
              {item.type === 'warning' && <Warning size={20} className="text-amber-600 dark:text-amber-400" weight="fill" />}
              {item.type === 'info' && <Info size={20} className="text-blue-600 dark:text-blue-400" weight="fill" />}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-tight">{item.title}</p>
              <p className="text-xs mt-1 opacity-90 leading-relaxed break-words">{item.message}</p>
            </div>

            <button
              onClick={() => removeToast(item.id)}
              className="shrink-0 p-1 rounded-lg opacity-60 hover:opacity-100 transition-opacity"
              aria-label="Close notification"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
