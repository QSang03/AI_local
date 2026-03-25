"use client";

import { useEffect, useRef, useState } from "react";

export interface MappingHistoryEntry {
  id: string;
  messageIds: string[];
  toProjectIds: string[];
  createdAt: number;
}

interface MappingHistoryPanelProps {
  entries: MappingHistoryEntry[];
  redoEntries?: MappingHistoryEntry[];
  onUndo: (entryId: string) => void;
  onRedo?: (entryId: string) => void;
  onClear: () => void;
}

export function MappingHistoryPanel({
  entries,
  redoEntries = [],
  onUndo,
  onRedo,
  onClear,
}: MappingHistoryPanelProps) {
  const [open, setOpen] = useState(false);
  const firstUndoButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (open) {
      firstUndoButtonRef.current?.focus();
    }
  }, [open]);

  return (
    <>
      <div className="lg:hidden">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="inbox-history-drawer"
          onClick={() => setOpen((prev) => !prev)}
          className="fixed bottom-6 right-6 z-50 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-lg"
        >
          Mapping History ({entries.length})
        </button>

        <div
          id="inbox-history-drawer"
          role="dialog"
          aria-modal="false"
          className={`fixed inset-x-0 bottom-0 z-40 max-h-[72vh] overflow-auto rounded-t-2xl border border-slate-200 bg-white p-4 shadow-xl transition-transform duration-300 ease-out ${
            open ? "translate-y-0" : "translate-y-full"
          }`}
        >
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">History Mapping</h3>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
            >
              Close
            </button>
          </div>

          <HistoryList
            entries={entries}
            redoEntries={redoEntries}
            onUndo={onUndo}
            onRedo={onRedo}
            onClear={onClear}
            firstUndoButtonRef={firstUndoButtonRef}
          />
        </div>
      </div>

      <aside className="hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:block">
        <h3 className="text-sm font-semibold text-slate-900">History Mapping</h3>
        <p className="mt-1 text-xs text-slate-500">Undo theo tung lan luu mapping</p>
        <div className="mt-3">
          <HistoryList
            entries={entries}
            redoEntries={redoEntries}
            onUndo={onUndo}
            onRedo={onRedo}
            onClear={onClear}
            firstUndoButtonRef={firstUndoButtonRef}
          />
        </div>
      </aside>
    </>
  );
}

    function EntryCard({
      entry,
      variant = "undo",
      actionLabel,
      onAction,
      actionRef,
      staggerIndex,
    }: {
      entry: MappingHistoryEntry;
      variant?: "undo" | "redo";
      actionLabel: string;
      onAction: () => void;
      actionRef?: React.RefObject<HTMLButtonElement | null> | undefined;
      staggerIndex?: number;
    }) {
      const [mounted, setMounted] = useState(false);

      useEffect(() => {
        const t = setTimeout(() => setMounted(true), 15);
        return () => clearTimeout(t);
      }, []);

      const rootRef = useRef<HTMLDivElement | null>(null);

      function handleActionClick() {
        const el = rootRef.current;
        if (!el) {
          onAction();
          return;
        }

        const firstRect = el.getBoundingClientRect();
        const clone = el.cloneNode(true) as HTMLElement;
        // style the clone so it sits above everything
        clone.style.position = "fixed";
        clone.style.left = `${firstRect.left}px`;
        clone.style.top = `${firstRect.top}px`;
        clone.style.width = `${firstRect.width}px`;
        clone.style.height = `${firstRect.height}px`;
        clone.style.margin = "0";
        clone.style.zIndex = "9999";
        clone.style.pointerEvents = "none";
        clone.style.transition = "transform 320ms cubic-bezier(.2,.9,.2,1), opacity 220ms";
        clone.style.willChange = "transform, opacity";

        document.body.appendChild(clone);

        // force layout so transition will be applied later
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        clone.offsetWidth;

        // set stagger delay if provided
        if (typeof staggerIndex === "number" && staggerIndex > 0) {
          const delay = Math.min(10, staggerIndex) * 60; // cap at 10*60ms
          clone.style.transitionDelay = `${delay}ms`;
        }

        // call parent's action to move data (this will re-render lists)
        onAction();

        // wait for the new DOM to render
        requestAnimationFrame(() => {
          // find the target element (the entry in the opposite list)
          const targetVariant = variant === "undo" ? "redo" : "undo";
          const selector = `[data-mh-entry="${targetVariant}-${entry.id}"]`;
          const targetEl = document.querySelector(selector) as HTMLElement | null;

          if (!targetEl) {
            // if for any reason target not present, fade out
            clone.style.opacity = "0";
            setTimeout(() => clone.remove(), 320);
            return;
          }

          const lastRect = targetEl.getBoundingClientRect();
          const dx = lastRect.left - firstRect.left;
          const dy = lastRect.top - firstRect.top;
          const scaleX = lastRect.width / firstRect.width;
          const scaleY = lastRect.height / firstRect.height;

          // apply transform to move clone to its destination
          clone.style.transform = `translate(${dx}px, ${dy}px) scale(${scaleX}, ${scaleY})`;

          // cleanup after animation
          setTimeout(() => {
            clone.remove();
          }, 360);
        });
      }

      const base = "rounded-xl border p-2 text-xs";
      const bg = variant === "undo" ? "bg-slate-50 border-slate-200" : "bg-white border-slate-200";
      const entryClass = mounted ? "mh-entry-in" : "mh-entry-pre";

      return (
        <div ref={rootRef} data-mh-entry={`${variant}-${entry.id}`} className={`${base} ${bg} ${entryClass}`}>
          <style>{`
            @keyframes mh-entry-in { from { opacity: 0; transform: translateY(8px) scale(.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
            .mh-entry-in { animation: mh-entry-in 220ms cubic-bezier(.2,.9,.2,1) both; }
            .mh-entry-pre { opacity: 0; transform: translateY(8px) scale(.98); }
          `}</style>

          <p className="font-semibold text-slate-900">
            {entry.messageIds.length} tin nhan -&gt; {entry.toProjectIds.length} project
          </p>
          <p className="mt-1 text-slate-500">{new Date(entry.createdAt).toLocaleString()}</p>
          <button
            ref={actionRef}
            type="button"
            onClick={handleActionClick}
            className={`mt-2 rounded-md ${variant === "undo" ? "bg-slate-900 text-white hover:bg-slate-800" : "border border-slate-300 bg-white text-slate-800 hover:bg-slate-100"} px-2 py-1 font-semibold`}
          >
            {actionLabel}
          </button>
        </div>
      );
    }

function HistoryList({
  entries,
  redoEntries,
  onUndo,
  onRedo,
  onClear,
  firstUndoButtonRef,
}: {
  entries: MappingHistoryEntry[];
  redoEntries: MappingHistoryEntry[];
  onUndo: (entryId: string) => void;
  onRedo?: (entryId: string) => void;
  onClear: () => void;
  firstUndoButtonRef: React.RefObject<HTMLButtonElement | null>;
}) {
  if (entries.length === 0 && redoEntries.length === 0) {
    return <p className="text-xs text-slate-500">Chua co thao tac mapping gan day.</p>;
  }

  return (
    <>
      <div className="max-h-72 space-y-3 overflow-auto pr-1">
        {entries.length > 0 ? (
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Undo Stack
            </p>
            <div className="space-y-2">
              {entries.map((entry, idx) => (
                <EntryCard
                  key={entry.id}
                  entry={entry}
                  variant="undo"
                  actionLabel="Undo"
                  actionRef={idx === 0 ? firstUndoButtonRef : undefined}
                  staggerIndex={idx}
                  onAction={() => onUndo(entry.id)}
                />
              ))}
            </div>
          </div>
        ) : null}

        {onRedo && redoEntries.length > 0 ? (
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Redo Stack
            </p>
            <div className="space-y-2">
              {redoEntries.map((entry, idx) => (
                <EntryCard
                  key={`redo-${entry.id}`}
                  entry={entry}
                  variant="redo"
                  actionLabel="Redo"
                  staggerIndex={idx}
                  onAction={() => onRedo(entry.id)}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-3 text-right">
        <button
          type="button"
          onClick={onClear}
          className="text-xs text-slate-500 hover:underline"
        >
          Clear history
        </button>
      </div>
    </>
  );
}
