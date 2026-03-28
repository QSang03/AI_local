"use client";

import { Mail, Phone, MessageCircle } from "lucide-react";
import { MessageChannel } from "@/types/domain";

type ChannelFilter = "all" | MessageChannel;

interface ChannelTabsProps {
  active: ChannelFilter;
  counts: Partial<Record<MessageChannel, number>>;
  onChange: (ch: ChannelFilter) => void;
}

const TABS: Array<{ key: MessageChannel; label: string; Icon: React.ElementType; color: string }> = [
  { key: "email", label: "Email", Icon: Mail, color: "#3B82F6" },
  { key: "zalo", label: "Zalo", Icon: MessageCircle, color: "#0068FF" },
  { key: "whatsapp", label: "WhatsApp", Icon: Phone, color: "#25D366" },
];

export function ChannelTabs({ active, counts, onChange }: ChannelTabsProps) {
  return (
    <div className="flex border-b border-slate-200 bg-white shrink-0">
      {TABS.map(({ key, label, Icon, color }) => {
        const isActive = active === key;
        const count = counts[key] ?? 0;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={`relative flex-1 flex flex-col items-center justify-center gap-1 py-3 px-2 text-xs font-medium transition-all ${
              isActive
                ? "text-slate-900"
                : "text-slate-400 hover:text-slate-700 hover:bg-slate-50"
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Icon
                size={14}
                style={{ color: isActive ? color : undefined }}
              />
              <span>{label}</span>
              {count > 0 && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none ${
                    isActive
                      ? "bg-red-500 text-white"
                      : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {count}
                </span>
              )}
            </div>
            {isActive && (
              <div
                className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full"
                style={{ backgroundColor: color }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
