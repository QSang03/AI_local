"use client";

import { Search, X, Ban } from "lucide-react";

interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  hideBlacklisted: boolean;
  onHideBlacklistedChange: (v: boolean) => void;
  totalCount: number;
}

export function FilterBar({
  searchQuery,
  onSearchChange,
  hideBlacklisted,
  onHideBlacklistedChange,
  totalCount,
}: FilterBarProps) {
  return (
    <div className="px-3 py-2.5 border-b border-slate-100 bg-white shrink-0 space-y-2">
      {/* Search input */}
      <div className="relative">
        <Search
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          size={14}
        />
        <input
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Tìm theo tên, email..."
          className="w-full pl-8 pr-7 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[13px] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-400 focus:bg-white transition"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Bottom row: count + blacklist toggle */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-slate-500 font-medium">
          {totalCount} hội thoại
        </span>

        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <button
            type="button"
            role="switch"
            aria-checked={hideBlacklisted}
            onClick={() => onHideBlacklistedChange(!hideBlacklisted)}
            className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${
              hideBlacklisted ? "bg-rose-500" : "bg-slate-300"
            }`}
          >
            <span
              className={`inline-block h-3 w-3 transform rounded-full bg-white shadow-sm transition-transform ${
                hideBlacklisted ? "translate-x-3.5" : "translate-x-0.5"
              }`}
            />
          </button>
          <span className="flex items-center gap-0.5 text-[11px] text-slate-500">
            <Ban size={10} className={hideBlacklisted ? "text-rose-400" : "text-slate-400"} />
            Ẩn blacklist
          </span>
        </label>
      </div>
    </div>
  );
}
