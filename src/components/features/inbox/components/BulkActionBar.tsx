import { motion } from "framer-motion";
import { CheckCheck, Archive, X, Share } from "lucide-react";

interface BulkActionBarProps {
  selectedCount: number;
  onAssignToProject: () => void;
  onClear: () => void;
  onMarkRead?: () => void; // Optional if we don't have this API yet
  onArchive?: () => void;  // Optional API
}

export function BulkActionBar({
  selectedCount,
  onAssignToProject,
  onClear,
  onMarkRead,
  onArchive,
}: BulkActionBarProps) {
  return (
    <motion.div
      initial={{ y: 30, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 30, opacity: 0 }}
      className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 p-1.5 bg-slate-900 rounded-xl shadow-xl shadow-slate-900/20 z-30"
    >
      <div className="px-4 py-1.5 flex items-center gap-2 text-white border-r border-slate-700 shrink-0">
        <div className="w-5 h-5 rounded-full bg-violet-600 flex items-center justify-center text-[10px] font-bold ring-2 ring-slate-900">
          {selectedCount}
        </div>
        <span className="text-[13px] font-medium mr-1">đã chọn</span>
      </div>

      <div className="flex items-center gap-1 px-1 shrink-0">
        {onMarkRead && (
          <button
            onClick={onMarkRead}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            <CheckCheck size={14} /> Đã đọc
          </button>
        )}
        
        {onArchive && (
          <button
            onClick={onArchive}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            <Archive size={14} /> Lưu trữ
          </button>
        )}

        <button
          onClick={onAssignToProject}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-white bg-violet-600 hover:bg-violet-500 active:bg-violet-700 rounded-lg transition ml-1 shadow-sm"
        >
          <Share size={14} /> Gán Project
        </button>

        <div className="w-px h-5 bg-slate-700 mx-1" />

        <button
          onClick={onClear}
          title="Bỏ chọn tất cả"
          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
        >
          <X size={16} />
        </button>
      </div>
    </motion.div>
  );
}
