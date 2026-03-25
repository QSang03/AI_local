"use client";

import React, { useCallback, useEffect, useRef } from 'react';

interface Props {
  open: boolean;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function getFocusable(el: HTMLElement | null) {
  if (!el) return [] as HTMLElement[];
  return Array.from(el.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
  )).filter((x) => !x.hasAttribute('disabled'));
}

export default function ConfirmationModal({ open, title = 'Confirm', description = '', confirmLabel = 'Confirm', cancelLabel = 'Cancel', onConfirm, onCancel }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = React.useState(false);

  const handleClose = useCallback(() => {
    setVisible(false);
    // wait for animation (200ms) then call parent
    setTimeout(() => onCancel(), 200);
  }, [onCancel]);

  const handleConfirm = useCallback(() => {
    setVisible(false);
    setTimeout(() => onConfirm(), 200);
  }, [onConfirm]);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const focusable = getFocusable(ref.current);
    // mount -> animate in
    setTimeout(() => setVisible(true), 0);
    focusable[0]?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
      if (e.key === 'Tab') {
        const nodes = getFocusable(ref.current);
        if (nodes.length === 0) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previouslyFocused.current?.focus();
    };
  }, [open, handleClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="presentation" aria-hidden={!open}>
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-desc" className={`relative z-10 w-full max-w-md rounded bg-white p-6 shadow-lg transform transition-all duration-200 ease-out ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'} motion-reduce:transition-none`}>
        <h3 id="confirm-title" className="text-lg font-semibold">{title}</h3>
        {description ? <p id="confirm-desc" className="mt-2 text-sm text-gray-600">{description}</p> : null}
        <div className="mt-4 flex justify-end gap-3">
          <button onClick={handleClose} className="rounded border px-4 py-2">{cancelLabel}</button>
          <button onClick={handleConfirm} className="rounded bg-rose-600 px-4 py-2 text-white">{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
