"use client";

import { User, MoreVertical, BellOff, PanelRightClose, Ban, Activity, CheckCheck } from "lucide-react";
import { InboxConversationSummary, MessageChannel } from "@/types/domain";
import StatusBadge from "./StatusBadge";


const CHANNEL_CONFIG: Record<MessageChannel, { color: string; label: string }> = {
  zalo: { color: "bg-blue-100 text-blue-700 border-blue-200", label: "Zalo" },
  email: { color: "bg-slate-100 text-slate-700 border-slate-200", label: "Email" },
  whatsapp: { color: "bg-emerald-100 text-emerald-700 border-emerald-200", label: "WhatsApp" },
};

const AVATAR_COLORS = [
  "#7C3AED", "#0068FF", "#10B981", "#F59E0B",
  "#6366F1", "#EC4899", "#14B8A6", "#EF4444",
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

interface ChatHeaderProps {
  conversation: InboxConversationSummary;
  channel: MessageChannel;
  isIgnored: boolean;
  isDetailsOpen: boolean;
  isAllSelected?: boolean;
  onSelectAll?: () => void;
  onToggleIgnore: () => void;
  onToggleDetails: () => void;
}

export function ChatHeader({
  conversation,
  channel,
  isIgnored,
  isDetailsOpen,
  isAllSelected,
  onSelectAll,
  onToggleIgnore,
  onToggleDetails,
}: ChatHeaderProps) {
  const name = conversation.name || conversation.id;
  const initials = name.slice(0, 2).toUpperCase();
  const avatarBg = getAvatarColor(name);
  const chConf = CHANNEL_CONFIG[channel] ?? CHANNEL_CONFIG.email;

  // By default mock status to open, you can pass from props if backend has it.
  const mockStatus = "open"; 

  // Secondary subtext (email or id)
  const subtext = conversation.id.includes('@') ? conversation.id : `ID: ${conversation.id}`;

  return (
    <div className="px-5 py-3 border-b border-slate-200 shrink-0 bg-white flex justify-between items-center shadow-sm z-10 sticky top-0 min-w-0">
      <div className="flex items-center gap-4 min-w-0">
        <div className="relative shrink-0">
          {conversation.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={conversation.avatarUrl} alt={name} className="w-11 h-11 rounded-full object-cover" />
          ) : (
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center text-white text-base font-bold"
              style={{ backgroundColor: avatarBg }}
            >
              {initials}
            </div>
          )}
          <div className="absolute -bottom-1 -right-1">
            <span className={`px-1.5 py-0.5 rounded-[4px] text-[8px] font-bold border ${chConf.color} uppercase shadow-sm bg-white`}>
              {chConf.label}
            </span>
          </div>
        </div>

        <div className="min-w-0 flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-0.5">
            <h2 className="text-[17px] font-bold text-slate-900 truncate tracking-tight">{name}</h2>
            <StatusBadge status={mockStatus} />
          </div>
          <p className="text-[12px] text-slate-500 truncate font-medium flex items-center gap-1.5">
            {subtext}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0 ml-4">
        {isIgnored && (
          <span className="text-[11px] font-semibold text-rose-500 bg-rose-50 px-2 py-1 rounded-md border border-rose-100 flex items-center gap-1 mr-2">
            <Ban size={12} /> Đang bị ẩn
          </span>
        )}

        <button
          onClick={onToggleIgnore}
          title={isIgnored ? "Bỏ Blacklist" : "Blacklist"}
          className={`p-2 rounded-lg transition-colors border ${
            isIgnored
              ? "border-rose-300 text-rose-600 bg-rose-50 hover:bg-rose-100"
              : "border-transparent text-slate-400 hover:text-rose-600 hover:bg-slate-100"
          }`}
        >
          <Ban size={18} />
        </button>

        <button title="Tắt thông báo" className="p-2 rounded-lg border border-transparent text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition">
          <BellOff size={18} />
        </button>

        {onSelectAll && (
          <button
            onClick={onSelectAll}
            title={isAllSelected ? "Bỏ chọn tất cả" : "Chọn tất cả tin nhắn"}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold transition-all border rounded-lg ${
              isAllSelected
                ? "bg-violet-600 border-violet-600 text-white shadow-sm"
                : "bg-white border-slate-200 text-slate-600 hover:border-violet-300 hover:text-violet-600"
            }`}
          >
            <CheckCheck size={16} />
            {isAllSelected ? "Đã chọn hết" : "Chọn tất cả"}
          </button>
        )}

        <div className="w-px h-5 bg-slate-200 mx-1" />

        <button
          onClick={onToggleDetails}
          title="Thông tin khách hàng"
          className={`p-2 rounded-lg transition border ${
            isDetailsOpen
              ? "bg-slate-100 border-slate-200 text-slate-800"
              : "text-slate-400 border-transparent hover:text-slate-700 hover:bg-slate-100"
          }`}
        >
          <PanelRightClose size={18} />
        </button>

        <button title="Thêm..." className="p-2 rounded-lg border border-transparent text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition relative">
          <MoreVertical size={18} />
        </button>
      </div>
    </div>
  );
}
