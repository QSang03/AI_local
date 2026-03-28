"use client";

import { useEffect } from "react";

interface ToastProps {
  message: string;
  onClose?: () => void;
  actionLabel?: string;
  onAction?: () => void;
}

export function Toast({ message, onClose, actionLabel, onAction }: ToastProps) {
  useEffect(() => {
    const id = setTimeout(() => onClose?.(), 5000);
    return () => clearTimeout(id);
  }, [message, onClose]);

  if (!message) return null;

  return (
    <div 
      className="fixed bottom-[62px] z-[10000] transition-all duration-300"
      style={{ right: `calc(1.5rem + var(--ai-widget-offset, 0px))` }}
    >
      <div role="status" aria-live="polite" className="flex items-center gap-3 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow transform transition-all duration-200 ease-out motion-reduce:transition-none">
        <div className="min-w-0">{message}</div>
        {actionLabel && (
          <button
            onClick={() => {
              onAction?.();
              onClose?.();
            }}
            className="ml-2 rounded bg-white/10 px-2 py-1 text-xs font-semibold text-white hover:bg-white/20"
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}

export default Toast;
