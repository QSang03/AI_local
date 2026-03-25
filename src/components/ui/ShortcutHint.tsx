"use client";

export function ShortcutHint() {
  return (
    <div className="fixed bottom-6 left-[260px] z-50 hidden sm:flex items-center gap-3 rounded-lg bg-white/80 px-3 py-2 text-xs font-medium text-slate-800 shadow">
      <div className="flex items-center gap-2">
        <span className="text-slate-600">Shortcuts:</span>
        <kbd className="rounded border px-2 py-0.5 text-[11px]">Ctrl</kbd>
        <span className="text-xs">/</span>
        <kbd className="rounded border px-2 py-0.5 text-[11px]">Cmd</kbd>
        <span className="text-xs">+</span>
        <kbd className="rounded border px-2 py-0.5 text-[11px]">Z</kbd>
        <span className="px-1">Undo</span>
        <span className="text-xs">•</span>
        <kbd className="rounded border px-2 py-0.5 text-[11px]">Ctrl</kbd>
        <span className="text-xs">/</span>
        <kbd className="rounded border px-2 py-0.5 text-[11px]">Cmd</kbd>
        <span className="text-xs">+</span>
        <kbd className="rounded border px-2 py-0.5 text-[11px]">Y</kbd>
        <span className="px-1">Redo</span>
      </div>
    </div>
  );
}

export default ShortcutHint;
