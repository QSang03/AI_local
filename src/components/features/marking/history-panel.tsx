"use client";

import React, { useEffect, useRef, useState } from "react";

type HistoryEntry = {
  id: string;
  type: "assign";
  threadIds: string[];
  fromProjectIds: string[];
  toProjectIds: string[];
  ts: number;
};

interface Props {
  entries: HistoryEntry[];
  redoEntries?: HistoryEntry[];
  onUndoEntry: (id: string) => void;
  onRedoEntry?: (id: string) => void;
  onClear?: () => void;
}

export function HistoryPanel({ entries, redoEntries = [], onUndoEntry, onRedoEntry, onClear }: Props) {
  const [open, setOpen] = useState(false);
  const firstBtn = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (open) {
      firstBtn.current?.focus();
    }
  }, [open]);

  function onKeyEntry(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      const next = (e.currentTarget.parentElement?.nextElementSibling as HTMLElement | null)?.querySelector('button[data-action]') as HTMLElement | null;
      next?.focus();
    }
    if (e.key === "ArrowUp") {
      const prev = (e.currentTarget.parentElement?.previousElementSibling as HTMLElement | null)?.querySelector('button[data-action]') as HTMLElement | null;
      prev?.focus();
    }
    if (e.key === "Enter") {
      (e.currentTarget as HTMLElement).click();
    }
  }

  return (
    <>
      {/* Mobile toggle */}
      <div className="lg:hidden">
        <button
          aria-expanded={open}
          aria-controls="history-drawer"
          onClick={() => setOpen((s) => !s)}
          className="fixed bottom-6 right-6 z-50 rounded-full bg-slate-900 px-4 py-2 text-xs text-white shadow-lg"
        >
          History ({entries.length})
        </button>

        <div
          id="history-drawer"
          role="dialog"
          aria-modal="false"
          className={`fixed inset-x-0 bottom-0 z-40 max-h-[75vh] overflow-auto bg-white p-4 shadow-xl transition-transform duration-300 ease-out ${open ? "translate-y-0" : "translate-y-full"}`}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">History</h3>
            <button onClick={() => setOpen(false)} className="text-xs text-slate-500">Close</button>
          </div>

          <div className="mt-3 space-y-2">
            {entries.length === 0 && <p className="text-xs text-slate-500">No recent actions</p>}
            {entries.slice().reverse().map((e, idx) => (
              <div key={e.id} className="flex items-start justify-between gap-3 rounded-md border p-2 group">
                <div className="min-w-0">
                  <div className="text-xs font-medium text-slate-800">{e.type === "assign" ? "Assign" : e.type}</div>
                  <div className="text-xs text-slate-500">{e.threadIds.length} thread(s) → {e.toProjectIds.length} project(s)</div>
                  <div className="text-[11px] text-slate-400 mt-1">{new Date(e.ts).toLocaleString()}</div>
                </div>
                <div className="flex gap-2">
                  <button
                    ref={idx === 0 ? firstBtn : undefined}
                    data-action="undo"
                    aria-label={`Undo action ${e.type}`}
                    onKeyDown={onKeyEntry}
                    onClick={() => onUndoEntry(e.id)}
                    className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700 hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-400"
                  >
                    Undo
                  </button>
                  {onRedoEntry && redoEntries.find((r) => r.id === e.id) && (
                    <button
                      aria-label={`Redo action ${e.type}`}
                      onClick={() => onRedoEntry(e.id)}
                      className="rounded bg-white px-2 py-1 text-xs text-slate-700 border hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-400"
                    >
                      Redo
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {entries.length > 0 && (
            <div className="mt-3 text-right">
              <button onClick={onClear} className="text-xs text-slate-500 hover:underline">Clear</button>
            </div>
          )}
        </div>
      </div>

      {/* Desktop aside */}
      <aside className="hidden lg:block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="Action history">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">History</h3>
          <span className="text-xs text-slate-500">{entries.length}</span>
        </div>

        <div className="mt-3 max-h-56 overflow-auto space-y-2" role="list">
          {entries.length === 0 && <p className="text-xs text-slate-500">No recent actions</p>}
          {entries.slice().reverse().map((e) => (
            <div key={e.id} role="listitem" className="flex items-start justify-between gap-3 rounded-md border p-2 group">
              <div className="min-w-0">
                <div className="text-xs font-medium text-slate-800">{e.type === "assign" ? "Assign" : e.type}</div>
                <div className="text-xs text-slate-500">{e.threadIds.length} thread(s) → {e.toProjectIds.length} project(s)</div>
                <div className="text-[11px] text-slate-400 mt-1">{new Date(e.ts).toLocaleString()}</div>
              </div>
              <div className="flex gap-2">
                <button
                  aria-label={`Undo action ${e.type}`}
                  onClick={() => onUndoEntry(e.id)}
                  className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700 hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-400"
                >
                  Undo
                </button>
                {onRedoEntry && redoEntries.find((r) => r.id === e.id) && (
                  <button
                    aria-label={`Redo action ${e.type}`}
                    onClick={() => onRedoEntry(e.id)}
                    className="rounded bg-white px-2 py-1 text-xs text-slate-700 border hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-400"
                  >
                    Redo
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {entries.length > 0 && (
          <div className="mt-3 text-right">
            <button onClick={onClear} className="text-xs text-slate-500 hover:underline">Clear</button>
          </div>
        )}
      </aside>
    </>
  );
}

export default HistoryPanel;
