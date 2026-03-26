"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Search, Plus, X, Loader2 } from "lucide-react";
import { Project, PlatformMessage } from "@/types/domain";

interface MappingPanelProps {
  selectedMessages: PlatformMessage[];
  projects: Project[];
  isSaving: boolean;
  onClose: () => void;
  onRemoveMessage: (id: string) => void;
  onCreateProject: (code: string) => void;
  onSaveMapping: (projectIds: string[]) => void;
}

export function MappingPanel({
  selectedMessages,
  projects,
  isSaving,
  onClose,
  onRemoveMessage,
  onCreateProject,
  onSaveMapping,
}: MappingPanelProps) {
  const [search, setSearch] = useState("");
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set());

  const toggleProject = (id: string) => {
    setSelectedProjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredProjects = projects.filter((p) =>
    p.code.toLowerCase().includes(search.toLowerCase()) ||
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <motion.div
      initial={{ x: "100%", opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: "100%", opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="w-[360px] h-full bg-white border-l border-slate-200 flex flex-col shadow-xl flex-shrink-0 relative z-20"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Gán vào Project</h2>
          <p className="text-[13px] text-slate-500 mt-0.5">
            <span className="text-indigo-600 font-medium mr-1">{selectedMessages.length}</span>
            tin nhắn đã chọn
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-1.5 rounded-full transition"
        >
          <X size={20} />
        </button>
      </div>

      {/* Selected Messages */}
      <div className="p-4 border-b border-slate-100">
        <div className="flex flex-wrap gap-2 max-h-[140px] overflow-y-auto">
          {selectedMessages.map((msg) => (
            <div
              key={msg.id}
              className="group flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-full px-3 py-1 text-xs text-slate-700 hover:border-slate-300 transition-colors"
            >
              <span className="truncate max-w-[120px] font-medium">{msg.senderDisplay}</span>
              <button
                onClick={() => onRemoveMessage(msg.id)}
                className="text-slate-400 hover:text-rose-500 opacity-60 group-hover:opacity-100 focus:outline-none"
              >
                <X size={12} />
              </button>
            </div>
          ))}
          {selectedMessages.length === 0 && (
            <span className="text-sm text-slate-400 italic">Chưa chọn tin nhắn nào</span>
          )}
        </div>
      </div>

      {/* Main Form Area */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {/* Search / Create */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm hoặc mã project mới..."
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm transition focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder:text-slate-400"
            />
          </div>
          <button
            onClick={() => {
              if (search.trim()) {
                onCreateProject(search.trim());
                setSearch("");
              }
            }}
            disabled={!search.trim()}
            className="flex items-center gap-1 px-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <Plus size={16} /> Tạo
          </button>
        </div>

        {/* Project List */}
        <div className="flex-1">
          {filteredProjects.length === 0 ? (
            <div className="text-center py-8 text-sm text-slate-500 px-4">
              Chưa có project nào phù hợp. Tạo project mới để bắt đầu.
            </div>
          ) : (
            <div className="space-y-1">
              {filteredProjects.map((project) => {
                const isSelected = selectedProjectIds.has(project.id);
                return (
                  <label
                    key={project.id}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition border border-transparent ${
                      isSelected
                        ? "bg-indigo-50 border-indigo-100"
                        : "hover:bg-slate-50 hover:border-slate-200"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleProject(project.id)}
                      className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="inline-block px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-xs font-mono text-slate-700">
                          {project.code}
                        </span>
                        <span className="text-sm font-medium text-slate-900 truncate">
                          {project.name !== project.code ? project.name : ""}
                        </span>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-slate-200 bg-slate-50 flex gap-3 mt-auto">
        <button
          onClick={onClose}
          className="flex-1 py-2.5 px-4 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition focus:outline-none focus:ring-2 focus:ring-slate-400"
        >
          Hủy
        </button>
        <button
          onClick={() => onSaveMapping(Array.from(selectedProjectIds))}
          disabled={isSaving || selectedMessages.length === 0 || selectedProjectIds.size === 0}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-600 rounded-lg text-sm font-medium text-white transition hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
        >
          {isSaving ? <Loader2 className="animate-spin" size={18} /> : "Lưu Mapping"}
        </button>
      </div>
    </motion.div>
  );
}
