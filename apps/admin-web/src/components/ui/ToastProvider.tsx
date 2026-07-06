'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle, Info, Warning, X, XCircle } from '@phosphor-icons/react';

type ToastVariant = 'success' | 'error' | 'warning' | 'info';

type ToastItem = {
  id: string;
  title?: string;
  message: string;
  variant: ToastVariant;
};

type ToastApi = {
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
  dismiss: (id?: string) => void;
};

type ToastContextValue = {
  toast: ToastApi;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const DEFAULT_DURATION = 4200;

function getToastStyles(variant: ToastVariant) {
  switch (variant) {
    case 'success':
      return {
        icon: <CheckCircle size={20} weight="fill" />,
        titleClassName: 'text-primary',
      };
    case 'error':
      return {
        icon: <XCircle size={20} weight="fill" />,
        titleClassName: 'text-primary',
      };
    case 'warning':
      return {
        icon: <Warning size={20} weight="fill" />,
        titleClassName: 'text-primary',
      };
    case 'info':
    default:
      return {
        icon: <Info size={20} weight="fill" />,
        titleClassName: 'text-primary',
      };
  }
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timerRefs = useRef(new Map<string, number>());
  const toastCountRef = useRef(0);

  const dismiss = useCallback((id?: string) => {
    setToasts((current) => {
      if (!id) {
        return [];
      }

      return current.filter((toast) => toast.id !== id);
    });

    if (id) {
      const timer = timerRefs.current.get(id);
      if (timer) {
        window.clearTimeout(timer);
        timerRefs.current.delete(id);
      }
    } else {
      timerRefs.current.forEach((timer) => window.clearTimeout(timer));
      timerRefs.current.clear();
    }
  }, []);

  const pushToast = useCallback(
    (variant: ToastVariant, message: string, title?: string, duration = DEFAULT_DURATION) => {
      const id = `toast-${++toastCountRef.current}`;
      setToasts((current) => [...current, { id, variant, message, title }]);

      const timer: number = window.setTimeout(() => {
        dismiss(id);
      }, duration);

      timerRefs.current.set(id, timer);
    },
    [dismiss],
  );

  useEffect(() => {
    const timers = timerRefs.current;

    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const toast = useMemo<ToastApi>(
    () => ({
      success: (message, title) => pushToast('success', message, title),
      error: (message, title) => pushToast('error', message, title),
      warning: (message, title) => pushToast('warning', message, title),
      info: (message, title) => pushToast('info', message, title),
      dismiss,
    }),
    [dismiss, pushToast],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[99998] flex justify-center px-4 pb-4 sm:justify-end sm:px-6 sm:pb-6"
        aria-live="polite"
        aria-atomic="true"
      >
        <div className="flex w-full max-w-sm flex-col gap-3">
          {toasts.map((toastItem) => {
            const styles = getToastStyles(toastItem.variant);

            return (
              <article
                key={toastItem.id}
                role={toastItem.variant === 'error' ? 'alert' : 'status'}
                className="pointer-events-auto rounded-[24px] border border-border bg-surface px-4 py-3 shadow-[0_18px_60px_rgba(17,24,39,0.12)] backdrop-blur"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-border bg-background text-primary">
                    {styles.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    {toastItem.title ? (
                      <h3 className={`text-sm font-semibold tracking-tight ${styles.titleClassName}`}>
                        {toastItem.title}
                      </h3>
                    ) : null}
                    <p className="mt-1 break-words text-sm leading-6 text-muted">{toastItem.message}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => dismiss(toastItem.id)}
                    className="rounded-lg p-1 text-muted transition-colors hover:bg-primary/5 hover:text-primary"
                    aria-label="Dismiss notification"
                  >
                    <X size={16} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
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
