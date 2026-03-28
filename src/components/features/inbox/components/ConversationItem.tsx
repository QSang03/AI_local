"use client";

import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import { Mail, Phone, MessageCircle } from "lucide-react";
import { InboxConversationSummary, MessageChannel, PlatformMessage } from "@/types/domain";

const CHANNEL_CONFIG: Record<MessageChannel, { Icon: React.ElementType; color: string; label: string }> = {
  zalo: { Icon: MessageCircle, color: "#0068FF", label: "Zalo" },
  email: { Icon: Mail, color: "#3B82F6", label: "Email" },
  whatsapp: { Icon: Phone, color: "#25D366", label: "WA" },
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

function timeAgo(dateStr: string) {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return formatDistanceToNow(d, { addSuffix: false, locale: vi });
  } catch {
    return "";
  }
}

interface ConversationItemProps {
  conversation: InboxConversationSummary;
  channel: MessageChannel;
  isSelected: boolean;
  lastMessage?: PlatformMessage;
  messageCount: number;
  isIgnored: boolean;
  onClick: () => void;
}

export function ConversationItem({
  conversation,
  channel,
  isSelected,
  lastMessage,
  messageCount,
  isIgnored,
  onClick,
}: ConversationItemProps) {
  const name = conversation.name || conversation.id;
  const initials = name.slice(0, 2).toUpperCase();
  const avatarBg = getAvatarColor(name);
  const conf = CHANNEL_CONFIG[channel] ?? CHANNEL_CONFIG.email;
  const { Icon: ChannelIcon, color: channelColor } = conf;

  const timeStr = timeAgo(
    conversation.lastMessageAt ?? conversation.updatedAt ?? conversation.createdAt ?? ""
  );

  const preview =
    lastMessage?.snippet ||
    lastMessage?.content?.slice(0, 60) ||
    "";

  return (
    <button
      onClick={onClick}
      className={`group w-full text-left px-3 py-3 flex items-start gap-3 transition-all border-l-[3px] ${
        isSelected
          ? "bg-violet-50 border-violet-500"
          : "border-transparent hover:bg-slate-50"
      } ${isIgnored ? "opacity-50" : ""}`}
    >
      {/* Avatar */}
      <div className="relative shrink-0 mt-0.5">
        {conversation.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={conversation.avatarUrl}
            alt={name}
            className="w-9 h-9 rounded-full object-cover"
          />
        ) : (
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold"
            style={{ backgroundColor: avatarBg }}
          >
            {initials}
          </div>
        )}
        {/* Online dot */}
        <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-white" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <span
            className={`text-[13px] font-semibold truncate ${
              isSelected ? "text-violet-900" : "text-slate-800"
            }`}
          >
            {name}
          </span>
          <span className="text-[10px] text-slate-400 shrink-0 font-medium">{timeStr}</span>
        </div>

        <div className="flex items-center justify-between gap-1 mt-0.5">
          <span className="text-[12px] text-slate-500 truncate flex-1 leading-relaxed">
            {preview || (
              <span className="italic text-slate-400">Chưa có tin nhắn</span>
            )}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {messageCount > 0 && (
              <span className="text-[10px] font-bold bg-violet-100 text-violet-700 rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                {messageCount}
              </span>
            )}
            <div
              className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${channelColor}18` }}
            >
              <ChannelIcon size={10} style={{ color: channelColor }} />
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}
