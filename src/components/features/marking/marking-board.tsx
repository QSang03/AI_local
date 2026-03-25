"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { assignThreadToProjects } from "@/lib/api";
import { MessageThread, Project } from "@/types/domain";
import Toast from "@/components/ui/Toast";
import Loader from "@/components/ui/Loader";
import HistoryPanel from "./history-panel";
import ShortcutHint from "@/components/ui/ShortcutHint";

interface MarkingBoardProps {
  threads: MessageThread[];
  projects: Project[];
}

export function MarkingBoard({ threads, projects }: MarkingBoardProps) {
  const [selectedThreadIds, setSelectedThreadIds] = useState<string[]>(
    threads.length ? [threads[0].id] : [],
  );
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [resultMessage, setResultMessage] = useState("Chua gan thread vao project.");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  // Undo / Redo stacks for multi-step undo/redo
  type UndoEntry = {
    id: string;
    type: "assign";
    threadIds: string[];
    fromProjectIds: string[];
    toProjectIds: string[];
    ts: number;
  };
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [redoStack, setRedoStack] = useState<UndoEntry[]>([]);
  
  function clearHistory() {
    setUndoStack([]);
    setRedoStack([]);
  }

  async function handleRedoEntry(entryId: string) {
    const idx = redoStack.findIndex((e) => e.id === entryId);
    if (idx === -1) return;
    const entry = redoStack[idx];
    // remove from redo
    setRedoStack((s) => s.filter((e) => e.id !== entryId));
    // push to undo
    setUndoStack((s) => [...s, entry].slice(-20));

    setSaving(true);
    try {
      const res = await assignThreadToProjects({
        threadId: entry.threadIds[0],
        projectIds: entry.toProjectIds,
      });
      setToastMessage(res.message || "Redo completed");
      setSelectedProjectIds(entry.toProjectIds.slice());
      setSelectedThreadIds(entry.threadIds.slice());
    } catch (e) {
      setToastMessage("Redo failed");
    }
    setSaving(false);
  }
  const [dragOverProjectId, setDragOverProjectId] = useState<string | null>(null);
  const [dropFlashProjectId, setDropFlashProjectId] = useState<string | null>(null);
  const lastClickedProjectIndexRef = useRef<number | null>(null);
  const lastClickedThreadIndexRef = useRef<number | null>(null);

  const selectedThread = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadIds[0]),
    [selectedThreadIds, threads],
  );

  function toggleThread(threadId: string) {
    setSelectedThreadIds((prev) =>
      prev.includes(threadId) ? prev.filter((id) => id !== threadId) : [...prev, threadId],
    );
  }

  function getModifierState(ev?: React.MouseEvent | React.KeyboardEvent) {
    return {
      isMeta: !!ev && (ev.metaKey || ev.ctrlKey),
      isShift: !!ev && ev.shiftKey,
    };
  }

  function toggleThreadWithModifiers(threadId: string, index: number, ev?: React.MouseEvent | React.KeyboardEvent) {
    const { isMeta, isShift } = getModifierState(ev);

    if (isShift && lastClickedThreadIndexRef.current !== null) {
      const start = Math.min(lastClickedThreadIndexRef.current, index);
      const end = Math.max(lastClickedThreadIndexRef.current, index);
      const idsToAdd = threads.slice(start, end + 1).map((t) => t.id);
      setSelectedThreadIds((prev) => Array.from(new Set([...prev, ...idsToAdd])));
      lastClickedThreadIndexRef.current = index;
      return;
    }

    if (isMeta) {
      toggleThread(threadId);
      lastClickedThreadIndexRef.current = index;
      return;
    }

    setSelectedThreadIds([threadId]);
    lastClickedThreadIndexRef.current = index;
  }

  function toggleProject(projectId: string) {
    setSelectedProjectIds((prev) =>
      prev.includes(projectId) ? prev.filter((id) => id !== projectId) : [...prev, projectId],
    );
  }

  function toggleProjectWithModifiers(projectId: string, index: number, ev?: React.MouseEvent | React.KeyboardEvent) {
    // Support Ctrl/Cmd to toggle, Shift to select range, plain click toggles single
    const { isMeta, isShift } = getModifierState(ev);

    if (isShift && lastClickedProjectIndexRef.current !== null) {
      const start = Math.min(lastClickedProjectIndexRef.current, index);
      const end = Math.max(lastClickedProjectIndexRef.current, index);
      const idsToAdd = projects.slice(start, end + 1).map((p) => p.id);
      setSelectedProjectIds((prev) => Array.from(new Set([...prev, ...idsToAdd])));
      lastClickedProjectIndexRef.current = index;
      return;
    }

    if (isMeta) {
      toggleProject(projectId);
      lastClickedProjectIndexRef.current = index;
      return;
    }

    // Plain click selects only this one
    setSelectedProjectIds([projectId]);
    lastClickedProjectIndexRef.current = index;
  }

  function selectAllProjects() {
    setSelectedProjectIds(projects.map((project) => project.id));
  }

  function clearProjects() {
    setSelectedProjectIds([]);
  }

  function handleDragStart(threadId: string, ev: React.DragEvent) {
    // Ensure the dragged thread is selected; if not, select it
    setSelectedThreadIds((prev) => (prev.includes(threadId) ? prev : [threadId]));
    const ids = selectedThreadIds.includes(threadId) ? selectedThreadIds : [threadId];
    try {
      ev.dataTransfer.setData("application/json", JSON.stringify(ids));
    } catch {
      // ignore
    }
  }

  function handleThreadKeyDown(event: React.KeyboardEvent, idx: number) {
    if (event.key === "ArrowDown") {
      const next = threads[idx + 1];
      if (next) {
        setSelectedThreadIds([next.id]);
        lastClickedThreadIndexRef.current = idx + 1;
      }
    }
    if (event.key === "ArrowUp") {
      const prev = threads[idx - 1];
      if (prev) {
        setSelectedThreadIds([prev.id]);
        lastClickedThreadIndexRef.current = idx - 1;
      }
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleThreadWithModifiers(threads[idx].id, idx, event);
    }
  }

  function handleDropToProject(event: React.DragEvent, projectId: string) {
    event.preventDefault();
    setDragOverProjectId(null);
    let droppedIds: string[] = [];
    try {
      const payload = event.dataTransfer.getData("application/json");
      if (payload) droppedIds = JSON.parse(payload) as string[];
    } catch {
      // ignore parse errors
    }
    if (droppedIds.length === 0) droppedIds = selectedThreadIds;

    // When threads dropped, ensure project is selected too
    setSelectedProjectIds((prev) => (prev.includes(projectId) ? prev : [...prev, projectId]));

    // Optionally, preselect the first dropped thread
    if (droppedIds.length > 0) setSelectedThreadIds(droppedIds);
    // flash the drop target for visual feedback
    setDropFlashProjectId(projectId);
    setTimeout(() => setDropFlashProjectId(null), 600);
  }

  async function handleAssign() {
    if (selectedThreadIds.length === 0 || selectedProjectIds.length === 0) {
      setResultMessage("Hay chon it nhat 1 thread va 1 project.");
      return;
    }

    setSaving(true);
    // capture previous project selection snapshot for undo
    const prev = selectedProjectIds.slice();
    const threadIds = selectedThreadIds.slice();

    // assign each selected thread to the selected projects
    const results = await Promise.all(
      threadIds.map((tid) => assignThreadToProjects({ threadId: tid, projectIds: selectedProjectIds })),
    );

    // aggregate results
    const okCount = results.filter((r) => r.ok).length;
    const msg = okCount === results.length
      ? `Da gan ${results.length} thread vao ${selectedProjectIds.length} project(s)`
      : `Da gan thanh cong ${okCount}/${results.length} thread(s)`;

    setResultMessage(msg);

    if (okCount > 0) {
      const entry: UndoEntry = {
        id: Date.now().toString(),
        type: "assign",
        threadIds,
        fromProjectIds: prev,
        toProjectIds: selectedProjectIds.slice(),
        ts: Date.now(),
      };
      setUndoStack((s) => [...s, entry].slice(-20));
      setRedoStack([]);
      setToastMessage(msg);
      clearProjects();
    } else {
      setToastMessage(msg);
    }

    setSaving(false);
  }

  async function handleUndo() {
    if (undoStack.length === 0) return;
    const entry = undoStack[undoStack.length - 1];
    setUndoStack((s) => s.slice(0, -1));
    setRedoStack((s) => [entry, ...s].slice(0, 20));
    setSaving(true);
    try {
      const res = await assignThreadToProjects({
        threadId: entry.threadIds[0],
        projectIds: entry.fromProjectIds,
      });
      setToastMessage(res.message || "Undo completed");
      // update UI selection to restored state
      setSelectedProjectIds(entry.fromProjectIds.slice());
      setSelectedThreadIds(entry.threadIds.slice());
    } catch {
      setToastMessage("Undo failed");
    }
    setSaving(false);
  }

  async function handleRedo() {
    if (redoStack.length === 0) return;
    const entry = redoStack[0];
    setRedoStack((s) => s.slice(1));
    setUndoStack((s) => [...s, entry].slice(-20));
    setSaving(true);
    try {
      const res = await assignThreadToProjects({
        threadId: entry.threadIds[0],
        projectIds: entry.toProjectIds,
      });
      setToastMessage(res.message || "Redo completed");
      setSelectedProjectIds(entry.toProjectIds.slice());
      setSelectedThreadIds(entry.threadIds.slice());
    } catch {
      setToastMessage("Redo failed");
    }
    setSaving(false);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.ctrlKey || e.metaKey;
      if (!meta) return;
      if (e.key.toLowerCase() === "z") {
        e.preventDefault();
        handleUndo();
      }
      if (e.key.toLowerCase() === "y") {
        e.preventDefault();
        handleRedo();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undoStack, redoStack, handleUndo, handleRedo]);

  async function handleUndoEntry(entryId: string) {
    const idx = undoStack.findIndex((e) => e.id === entryId);
    if (idx === -1) return;
    const entry = undoStack[idx];
    // remove from undoStack
    setUndoStack((s) => s.filter((e) => e.id !== entryId));
    // push to redo
    setRedoStack((s) => [entry, ...s].slice(0, 20));

    setSaving(true);
    try {
      const res = await assignThreadToProjects({
        threadId: entry.threadIds[0],
        projectIds: entry.fromProjectIds,
      });
      setToastMessage(res.message || "Undo completed");
      setSelectedProjectIds(entry.fromProjectIds.slice());
      setSelectedThreadIds(entry.threadIds.slice());
    } catch {
      setToastMessage("Undo failed");
    }
    setSaving(false);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Danh sach thread</h2>
        <div className="mt-3">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-600">Đã chọn: {selectedThreadIds.length}</span>
              <div className="flex gap-2">
                {selectedThreadIds.map((id) => {
                  const t = threads.find((th) => th.id === id);
                  if (!t) return null;
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">
                      <span className="max-w-[160px] truncate">{t.title}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedThreadIds((prev) => prev.filter((pid) => pid !== id));
                        }}
                        aria-label={`Bo chon ${t.title}`}
                        className="-mr-1 rounded-full p-1 text-slate-500 hover:bg-slate-200"
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedThreadIds([])}
              className="text-xs text-slate-500 hover:underline"
            >
              Bỏ chọn
            </button>
          </div>

          <div className="space-y-2">
            {threads.map((thread, tIdx) => {
              const active = selectedThreadIds.includes(thread.id);
              return (
                <button
                  key={thread.id}
                  type="button"
                  onClick={(e) => toggleThreadWithModifiers(thread.id, tIdx, e)}
                  draggable
                  onDragStart={(e) => handleDragStart(thread.id, e)}
                  onKeyDown={(e) => handleThreadKeyDown(e, tIdx)}
                  aria-pressed={active}
                  tabIndex={0}
                  className={`w-full rounded-xl border p-3 text-left transition-transform duration-150 ease-in-out transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-sky-400 ${
                    active
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-slate-50 hover:border-slate-400"
                  }`}
                >
                  <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
                    {thread.channel}
                  </p>
                  <p className="text-sm font-semibold">{thread.title}</p>
                  <p className="text-xs opacity-80">{thread.latestMessage}</p>
                </button>
              );
            })}
          </div>
        </div>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Gan vao project</h2>
        <p className="mt-1 text-sm text-slate-600">
          Dang chon: {selectedThread ? selectedThread.title : "Khong co thread"}
        </p>
        <div aria-live="polite" className="sr-only">{resultMessage}</div>
        <p className="mt-1 text-xs text-slate-500">
          Meo: Keo thread ben trai va tha vao project de mark nhanh.
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={selectAllProjects}
            className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
          >
            Chon tat ca
          </button>
          <button
            type="button"
            onClick={clearProjects}
            className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
          >
            Bo chon
          </button>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {projects.map((project, idx) => {
              const checked = selectedProjectIds.includes(project.id);
              const dragOver = dragOverProjectId === project.id;
              const flash = dropFlashProjectId === project.id;
              return (
                <button
                  key={project.id}
                  type="button"
                  onClick={(e) => toggleProjectWithModifiers(project.id, idx, e)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleProjectWithModifiers(project.id, idx, e);
                    }
                    if (e.key === "ArrowRight") {
                      const next = projects[idx + 1];
                      if (next) {
                        const curr = e.currentTarget as HTMLElement;
                        const nextEl = curr.nextElementSibling as HTMLElement | null;
                        nextEl?.focus();
                      }
                    }
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragOverProjectId(project.id);
                  }}
                  onDragLeave={() => setDragOverProjectId(null)}
                  onDrop={(event) => {
                    handleDropToProject(event, project.id);
                  }}
                  aria-pressed={checked}
                  tabIndex={0}
                  className={`rounded-xl border px-3 py-2 text-left text-sm transition-transform duration-200 ease-out focus:outline-none focus:ring-2 focus:ring-sky-400 active:scale-98 ${
                    flash
                      ? "ring-4 ring-sky-400/30 scale-105 border-sky-400 bg-sky-50 shadow-lg"
                      : checked
                      ? "border-emerald-600 bg-emerald-100 text-emerald-900 shadow-sm"
                      : dragOver
                      ? "border-sky-600 bg-sky-100 text-sky-900 shadow"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-400"
                  }`}
                >
                  <p className="font-semibold">{project.code}</p>
                  <p>{project.name}</p>
                </button>
              );
            })}
        </div>

        <button
          type="button"
          disabled={saving}
          onClick={handleAssign}
          className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
        >
          {saving ? "Dang assign..." : "Assign vao project"}
        </button>

        <p className="mt-3 text-sm text-slate-600">{resultMessage}</p>
      </section>
      <div className="hidden lg:block">
        <div className="mt-6">
          <HistoryPanel entries={undoStack} redoEntries={redoStack} onUndoEntry={handleUndoEntry} onRedoEntry={handleRedoEntry} onClear={clearHistory} />
        </div>
      </div>

      <ShortcutHint />

      {saving && <Loader />}
      {toastMessage && (
        <Toast
          message={toastMessage}
          onClose={() => setToastMessage(null)}
          actionLabel={undoStack.length > 0 ? "Undo" : undefined}
          onAction={undoStack.length > 0 ? handleUndo : undefined}
        />
      )}
    </div>
  );
}
