"use client";

import { useState } from "react";
import { X, User, Tag, Mail, Phone, CalendarDays, ExternalLink, MessageSquareText, Search } from "lucide-react";
import { InboxConversationSummary, Project } from "@/types/domain";

interface DetailsPanelProps {
  conversation: InboxConversationSummary | null;
  isOpen: boolean;
  onClose: () => void;
  projects?: Project[]; // Assuming you might pass projects to show assigned
}

export function DetailsPanel({ conversation, isOpen, onClose }: DetailsPanelProps) {
  const [activeTab, setActiveTab] = useState<"customer" | "notes" | "activity">("customer");

  if (!isOpen) return null;

  // Mock data based on conversation
  const name = conversation?.name || conversation?.id || "Khách hàng mốc";
  const initials = name.slice(0, 2).toUpperCase();
  const avatarColor = "#7C3AED"; // Default purple

  return (
    <div className="w-[280px] bg-white border-l border-slate-200 flex flex-col shrink-0 h-full shadow-[-4px_0_24px_rgba(0,0,0,0.02)] z-20">
      {/* Header */}
      <div className="h-14 px-4 border-b border-slate-100 flex items-center justify-between shrink-0">
        <h3 className="text-sm font-semibold text-slate-800">Chi tiết</h3>
        <button
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4">
        {/* Profile Card */}
        <div className="flex flex-col items-center mb-6">
          <div className="relative">
            {conversation?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={conversation.avatarUrl} alt={name} className="w-16 h-16 rounded-full shadow-sm object-cover" />
            ) : (
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold shadow-sm"
                style={{ backgroundColor: avatarColor }}
              >
                {initials}
              </div>
            )}
          </div>
          <h2 className="text-base font-bold text-slate-900 mt-3 text-center">{name}</h2>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
            Mã KH: <span className="font-mono text-slate-700">{conversation?.id.slice(0, 6) || "ID"}</span>
          </p>
          
          <div className="flex flex-wrap items-center justify-center gap-1.5 mt-3">
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700 uppercase tracking-wider">VIP</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-700 uppercase tracking-wider">{conversation?.provider || 'EMAIL'}</span>
            <button className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200 border-dashed">+ Thêm Tag</button>
          </div>
        </div>

        {/* Tabs Grid */}
        <div className="flex bg-slate-100 p-0.5 rounded-lg mb-4">
          <button
            onClick={() => setActiveTab("customer")}
            className={`flex-1 py-1.5 text-[11px] font-semibold rounded-md transition ${activeTab === "customer" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            Thông tin
          </button>
          <button
            onClick={() => setActiveTab("notes")}
            className={`flex-1 py-1.5 text-[11px] font-semibold rounded-md transition ${activeTab === "notes" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            Ghi chú
          </button>
          <button
            onClick={() => setActiveTab("activity")}
            className={`flex-1 py-1.5 text-[11px] font-semibold rounded-md transition ${activeTab === "activity" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            Hoạt động
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "customer" && (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-1 duration-200">
            {/* Contact Info */}
            <div>
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Liên lách</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2.5 text-[13px] text-slate-700 p-2 rounded-lg hover:bg-slate-50">
                  <Mail size={14} className="text-slate-400" />
                  <span className="truncate">{conversation?.id.includes('@') ? conversation.id : 'contact@example.com'}</span>
                </div>
                <div className="flex items-center gap-2.5 text-[13px] text-slate-700 p-2 rounded-lg hover:bg-slate-50">
                  <Phone size={14} className="text-slate-400" />
                  <span>+84 (0) 90 123 4567</span>
                </div>
              </div>
            </div>

            {/* Other conversations */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Hội thoại khác</h4>
                <button className="text-[10px] text-violet-600 font-medium hover:underline">Xem tất cả</button>
              </div>
              <div className="space-y-2">
                <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-lg flex items-start gap-2.5 cursor-pointer hover:bg-slate-100 transition">
                  <div className="w-6 h-6 rounded bg-emerald-100 flex items-center justify-center shrink-0">
                    <MessageSquareText size={12} className="text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium text-slate-700 truncate">Hỗ trợ kỹ thuật màn hình</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">3 ngày trước · Đã đóng</p>
                  </div>
                  <ExternalLink size={12} className="text-slate-300" />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "notes" && (
          <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-1 duration-200">
            <textarea
              className="w-full bg-[#FFFBEB] border border-amber-200 rounded-lg p-3 text-[13px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400 min-h-[200px] resize-none placeholder:text-amber-700/40"
              placeholder="Thêm ghi chú nội bộ về khách hàng này..."
            />
            <button className="mt-3 w-full bg-slate-900 text-white font-medium text-[13px] py-2 rounded-lg hover:bg-slate-800 transition">
              Lưu ghi chú
            </button>
          </div>
        )}

        {activeTab === "activity" && (
          <div className="animate-in fade-in slide-in-from-bottom-1 duration-200 relative left-3 border-l pb-4 border-slate-200 space-y-4">
            <div className="relative pl-4">
              <span className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-violet-500 ring-4 ring-white" />
              <p className="text-[12px] text-slate-700"><span className="font-semibold">SLA Trigger</span></p>
              <p className="text-[10px] text-slate-400 mt-0.5">10 phút trước</p>
            </div>
            <div className="relative pl-4">
              <span className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-white" />
              <p className="text-[12px] text-slate-700"><span className="font-semibold">SangNQ</span> đã trả lời</p>
              <p className="text-[10px] text-slate-400 mt-0.5">1 giờ trước</p>
            </div>
            <div className="relative pl-4">
              <span className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-slate-300 ring-4 ring-white" />
              <p className="text-[12px] text-slate-700">Khách hàng tạo yêu cầu qua <span className="font-semibold">{conversation?.provider || 'Email'}</span></p>
              <p className="text-[10px] text-slate-400 mt-0.5">2 giờ trước</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
