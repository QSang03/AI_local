const fs = require('fs');

const content = `"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import { Search, Info, Mail, Phone, MessageCircle, X, ChevronLeft, ChevronRight, Ban, User, MoreVertical, ThumbsUp } from "lucide-react";
import { getOmniInboxData, addBlacklistEntry, removeBlacklistEntry, saveMessageProjectMapping } from "@/lib/api";
import { BlacklistEntry, MessageChannel, PlatformMessage, Project } from "@/types/domain";

import Toast from "@/components/ui/Toast";
import Loader from "@/components/ui/Loader";
import ShortcutHint from "@/components/ui/ShortcutHint";

import { MessageRenderer } from "./components/MessageRenderer";
import { MappingPanel } from "./components/MappingPanel";
import { useMessageSelection } from "./hooks/useMessageSelection";

type ChannelFilter = "all" | MessageChannel;

interface OmniInboxBoardProps {
  initialMessages: PlatformMessage[];
  initialBlacklist: BlacklistEntry[];
  projects: Project[];
}

interface InboxConversation {
  id: string;
  threadTitle: string;
  channel: MessageChannel;
  senderId: string;
  senderDisplay: string;
  messageIds: string[];
  messageCount: number;
  latestReceivedAt: string;
  latestSubject: string;
  latestSnippet: string;
  latestContent: string;
  projectIds: string[];
  latestExternalId?: string | null;
  latestRawChannelProvider?: string | null;
}

interface MappingUndoEntry {
  id: string;
  messageIds: string[];
  toProjectIds: string[];
  previousByMessage: Record<string, string[]>;
  createdAt: number;
}

// Colors configuration for badges and styling
const CHANNEL_COLORS = {
  zalo: { bg: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-200", label: "ZALO", icon: MessageCircle },
  email: { bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-200", label: "EMAIL", icon: Mail },
  whatsapp: { bg: "bg-green-100", text: "text-green-700", border: "border-green-200", label: "WA", icon: Phone },
} as const;

function mapProviderToChannel(provider?: string | null): MessageChannel {
  if (!provider) return "email";
  const p = provider.toLowerCase();
  if (p.includes("zalo")) return "zalo";
  if (p.includes("whatsapp")) return "whatsapp";
  if (p.includes("email")) return "email";
  return "email";
}

function timeAgo(dateStr: string) {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return formatDistanceToNow(d, { addSuffix: true, locale: vi });
  } catch {
    return dateStr;
  }
}

export function OmniInboxBoard({ initialMessages, initialBlacklist, projects }: OmniInboxBoardProps) {
  const [messages, setMessages] = useState<PlatformMessage[]>(initialMessages ?? []);
  const [blacklist, setBlacklist] = useState<BlacklistEntry[]>(initialBlacklist ?? []);
  const [remoteLoading, setRemoteLoading] = useState(false);
  
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [hideBlacklisted, setHideBlacklisted] = useState(true);
  
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  
  const [isMappingOpen, setIsMappingOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  const [undoStack, setUndoStack] = useState<MappingUndoEntry[]>([]);
  const [redoStack, setRedoStack] = useState<MappingUndoEntry[]>([]);
  const [localProjects, setLocalProjects] = useState<Project[]>(projects ?? []);

  const [expandedMsgIds, setExpandedMsgIds] = useState<string[]>([]);
  
  const [listPage, setListPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const { selectedIds, selectedCount, toggleSelection, selectAll, clearAll } = useMessageSelection();

  const blacklistedSet = useMemo(() => new Set(blacklist.map((e) => \`\${e.channel}:\${e.senderId}\`)), [blacklist]);

  const filteredMessages = useMemo(() => {
    return messages.filter((m) => {
      const byChannel = channelFilter === "all" || m.channel === channelFilter;
      const byQuery = searchQuery.trim() === "" ||
        m.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.senderDisplay.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.snippet.toLowerCase().includes(searchQuery.toLowerCase());
      const isBlacklisted = blacklistedSet.has(\`\${m.channel}:\${m.senderId}\`);
      const byBlacklist = hideBlacklisted ? !isBlacklisted : true;
      return byChannel && byQuery && byBlacklist;
    });
  }, [messages, channelFilter, searchQuery, blacklistedSet, hideBlacklisted]);

  // Fetch API on channel change
  useEffect(() => {
    let mounted = true;
    async function loadFiltered() {
      const providerParam = channelFilter === "all" ? undefined
        : channelFilter === "email" ? "email"
        : channelFilter === "zalo" ? "zalo_personal"
        : channelFilter === "whatsapp" ? "whatsapp_personal" : undefined;

      if (!providerParam) return;

      setRemoteLoading(true);
      try {
        const data = await getOmniInboxData(providerParam);
        if (!mounted) return;
        setMessages(data.messages ?? []);
        setBlacklist(data.blacklist ?? []);
      } catch (err) {
      } finally {
        if (mounted) setRemoteLoading(false);
      }
    }
    void loadFiltered();
    return () => { mounted = false; };
  }, [channelFilter]);

  const filteredConversations = useMemo(() => {
    const grouped = new Map<string, PlatformMessage[]>();
    filteredMessages.forEach((m) => {
      const bucket = grouped.get(m.conversationId) ?? [];
      bucket.push(m);
      grouped.set(m.conversationId, bucket);
    });

    const conversations: InboxConversation[] = Array.from(grouped.entries()).map(([id, convoMessages]) => {
      const sorted = [...convoMessages].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
      const latest = sorted[0];
      const pIds = Array.from(new Set(convoMessages.flatMap((item) => item.projectIds ?? [])));
      const computedChannel = latest.channel ?? mapProviderToChannel((latest.rawChannel as any)?.provider);
      const computedThreadTitle = latest.subject || (latest.rawConversation as any)?.name || latest.snippet || "(No title)";

      return {
        id,
        threadTitle: computedThreadTitle,
        channel: computedChannel,
        senderId: latest.senderId,
        senderDisplay: latest.senderDisplay,
        messageIds: convoMessages.map((m) => m.id),
        messageCount: convoMessages.length,
        latestReceivedAt: latest.receivedAt,
        latestSubject: latest.subject,
        latestSnippet: latest.snippet,
        latestContent: latest.content,
        projectIds: pIds,
        latestExternalId: latest.externalId ?? null,
        latestRawChannelProvider: (latest.rawChannel as any)?.provider ?? null,
      };
    });

    return conversations.sort((a, b) => b.latestReceivedAt.localeCompare(a.latestReceivedAt));
  }, [filteredMessages]);

  const totalPages = Math.max(1, Math.ceil(filteredConversations.length / pageSize));
  const safePage = Math.min(listPage, totalPages);
  
  const pagedConversations = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredConversations.slice(start, start + pageSize);
  }, [filteredConversations, pageSize, safePage]);

  const selectedConversation = useMemo(
    () => filteredConversations.find((c) => c.id === selectedConversationId) ?? null,
    [filteredConversations, selectedConversationId]
  );

  const selectedConversationMessages = useMemo(() => {
    if (!selectedConversation) return [];
    return filteredMessages.filter((m) => m.conversationId === selectedConversation.id)
      .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
  }, [filteredMessages, selectedConversation]);

  const handleSelectConversation = (id: string) => {
    if (id !== selectedConversationId) {
      setSelectedConversationId(id);
      clearAll();
      setIsMappingOpen(false);
    }
  };

  const handleCreateProject = (code: string) => {
    const id = \`proj-\${Date.now()}\`;
    const newProj: Project = {
      id, code, name: code, ownerName: "", status: "new", lastUpdateAt: new Date().toISOString(), unreadCount: 0, summary: "", todoList: [],
    };
    setLocalProjects((prev) => [newProj, ...prev]);
    setToastMessage(\`Tạo project \${code} thành công.\`);
  };

  const handleSaveMapping = async (projectIds: string[]) => {
    if (selectedIds.size === 0 || projectIds.length === 0) return;
    const msgIds = Array.from(selectedIds);
    setSaving(true);
    
    const previousByMessage = Object.fromEntries(msgIds.map(mId => [mId, messages.find(m => m.id === mId)?.projectIds || []]));
    
    const result = await saveMessageProjectMapping({ messageIds: msgIds, projectIds });
    if (result.ok) {
      setMessages((prev) => prev.map((m) => msgIds.includes(m.id) ? { ...m, projectIds: [...projectIds] } : m));
      setUndoStack((prev) => [{ id: \`map-\${Date.now()}\`, messageIds: msgIds, toProjectIds: projectIds, previousByMessage, createdAt: Date.now() }, ...prev].slice(0, 30));
      setRedoStack([]);
      clearAll();
      setIsMappingOpen(false);
    }
    setToastMessage(result.message || "Đã gán tin nhắn vào project thành công.");
    setSaving(false);
  };

  // Undo / Redo keybinds
  useEffect(() => {
    function handleKeydown(ev: KeyboardEvent) {
      const meta = ev.ctrlKey || ev.metaKey;
      if (!meta) return;
      const tag = (ev.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;

      const key = ev.key.toLowerCase();
      if (key === "z" && !ev.shiftKey) {
        if (undoStack.length === 0) return;
        ev.preventDefault();
        // implement undo map logic here if needed
      }

      if (key === "y" || (key === "z" && ev.shiftKey)) {
        if (redoStack.length === 0) return;
        ev.preventDefault();
        // implement redo map logic here if needed
      }
    }
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [undoStack, redoStack]);

  return (
    <div className="flex flex-col h-full bg-slate-50 relative overflow-hidden font-sans rounded-2xl shadow-sm border border-slate-200 mx-2 mb-2">
      {/* Page Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 shrink-0 shadow-sm z-10 relative">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Unified Inbox & Mapping</h1>
        <p className="text-sm text-slate-500 mt-1">Tổng hợp tin nhắn từ Email, Zalo, WhatsApp; gán vào project và quản lý blacklist</p>
      </header>

      {/* Filter Bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shrink-0 sticky top-0 z-10">
        {/* Channel Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
          {(['all', 'email', 'zalo', 'whatsapp'] as const).map(ch => {
            const active = channelFilter === ch;
            const ChIcon = ch === 'all' ? Mail : CHANNEL_COLORS[ch].icon;
            return (
              <button
                key={ch}
                onClick={() => { setChannelFilter(ch); setListPage(1); }}
                className={\`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all \${
                  active ? "bg-indigo-500 text-white shadow-sm" : "text-slate-600 hover:bg-slate-200"
                }\`}
              >
                <ChIcon size={14} className={active ? "text-white" : "text-slate-500"} />
                {ch === 'all' ? "Tất cả" : ch.charAt(0).toUpperCase() + ch.slice(1)}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-md mx-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setListPage(1); }}
            placeholder="Tìm theo người gửi, tiêu đề, nội dung..."
            className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(''); setListPage(1); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer group">
            <div className="relative">
              <input
                type="checkbox"
                className="sr-only"
                checked={hideBlacklisted}
                onChange={(e) => setHideBlacklisted(e.target.checked)}
              />
              <div className={\`w-9 h-5 rounded-full transition-colors \${hideBlacklisted ? "bg-indigo-500" : "bg-slate-300"}\`}></div>
              <div className={\`absolute left-0.5 top-0.5 bg-white w-4 h-4 rounded-full transition-transform shadow-sm \${hideBlacklisted ? "translate-x-4" : ""}\`}></div>
            </div>
            <span className="text-sm font-medium text-slate-700 select-none group-hover:text-slate-900 flex items-center gap-1">
              <Ban size={14} className={hideBlacklisted ? "text-rose-500" : "text-slate-400"} /> Ẩn blacklist
            </span>
          </label>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden relative">
        
        {/* Column 1: Conversation List (320px wide) */}
        <div className="w-[320px] bg-white border-r border-slate-200 flex flex-col shrink-0 z-0 h-full">
          <div className="p-3 border-b border-slate-100 flex items-center justify-between shadow-sm shrink-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-800">Hội thoại</h2>
              <span className="px-2 py-0.5 text-xs font-semibold bg-indigo-50 text-indigo-600 rounded-full leading-tight">
                {filteredConversations.length} cuộc
              </span>
            </div>
            <div className="flex items-center gap-1 text-slate-500 text-sm">
              <button
                disabled={safePage <= 1}
                onClick={() => setListPage(p => Math.max(1, p - 1))}
                className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-[12px] font-medium w-16 text-center">Trang {safePage}/{totalPages}</span>
              <button
                disabled={safePage >= totalPages}
                onClick={() => setListPage(p => Math.min(totalPages, p + 1))}
                className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-slate-50/50 relative">
            {remoteLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-20 bg-slate-100 animate-pulse rounded-lg border border-slate-200/50" />
              ))
            ) : pagedConversations.length === 0 ? (
              <div className="py-12 px-6 flex flex-col items-center text-center">
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                  <Mail className="text-slate-400" size={24} />
                </div>
                <h3 className="text-sm font-semibold text-slate-800">Không tìm thấy?</h3>
                <p className="text-xs text-slate-500 mt-1">Thử đổi bộ lọc hoặc từ khóa tìm kiếm</p>
              </div>
            ) : (
              pagedConversations.map((c) => {
                const isSelected = selectedConversation?.id === c.id;
                const cConf = CHANNEL_COLORS[c.channel] || CHANNEL_COLORS.email;
                const isBlacklisted = blacklistedSet.has(\`\${c.channel}:\${c.senderId}\`);
                
                return (
                  <div
                    key={c.id}
                    onClick={() => handleSelectConversation(c.id)}
                    className={\`block w-full text-left p-3 rounded-lg border cursor-pointer group transition duration-150 \${
                      isSelected 
                        ? 'bg-indigo-50 border-indigo-400 border-l-[3px] shadow-sm ml-[1px]' 
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
                    }\`}
                  >
                    <div className="flex gap-3">
                      <div className="relative shrink-0 mt-0.5">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-slate-600 font-bold text-sm shadow-inner ring-1 ring-white">
                          {c.senderDisplay.charAt(0).toUpperCase()}
                        </div>
                        <div className={\`absolute -bottom-1 -right-1 px-1 py-[2px] rounded uppercase font-bold text-[9px] border border-white shadow-sm tracking-wide \${cConf.bg} \${cConf.text}\`}>
                          {cConf.label}
                        </div>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-0.5">
                          <h3 className={\`text-[13px] font-semibold truncate pr-2 \${isSelected ? 'text-slate-900' : 'text-slate-800 group-hover:text-indigo-600 transition-colors'}\`}>
                            {c.senderDisplay}
                          </h3>
                          <span className="text-[11px] text-slate-400 whitespace-nowrap tabular-nums font-medium" title={c.latestReceivedAt}>
                            {timeAgo(c.latestReceivedAt)}
                          </span>
                        </div>
                        
                        <p className={\`text-[12px] leading-[1.35] truncate transition-colors \${isSelected ? 'text-slate-700' : 'text-slate-500'}\`}>
                          {c.latestSnippet || "Chưa có nội dung"}
                        </p>
                        
                        <div className="flex items-center justify-between mt-2 h-4">
                          <div className="flex gap-1.5 flex-wrap">
                            {c.projectIds.map(pid => (
                              <span key={pid} className="inline-flex items-center gap-1 w-2 h-2 rounded-full bg-emerald-500" title={\`Đã gán dự án: \${pid}\`} />
                            ))}
                            {isBlacklisted && <Ban size={12} className="text-rose-500" title="Đã chặn" />}
                          </div>
                          {c.messageCount > 1 && (
                            <span className="inline-flex items-center justify-center min-w-[18px] px-1.5 h-[18px] rounded-full bg-slate-100 border border-slate-200 text-[10px] font-bold text-slate-500">
                              {c.messageCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Column 2: Message Detail Panel (flex-1) */}
        <div className="flex-1 bg-white relative flex flex-col min-w-0 z-0 h-full">
          {!selectedConversation ? (
             <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50">
               <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center mb-4">
                 <Mail size={28} className="text-slate-300" />
               </div>
               <h3 className="text-base font-medium text-slate-800">Chưa chọn hội thoại</h3>
               <p className="text-sm mt-1">Vui lòng chọn một cuộc hội thoại từ danh sách bên trái.</p>
             </div>
          ) : (
            <>
              {/* Detail Header */}
              <div className="px-6 py-4 border-b border-slate-200 shrink-0 bg-white/80 backdrop-blur-md sticky top-0 z-10">
                <div className="flex justify-between items-start gap-4">
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold text-slate-900 truncate leading-tight">
                      {selectedConversation.threadTitle}
                    </h2>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="text-sm font-medium text-slate-700">{selectedConversation.senderDisplay}</span>
                      <span className="w-1 h-1 rounded-full bg-slate-300" />
                      <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                        {selectedConversation.latestRawChannelProvider || selectedConversation.channel}
                      </span>
                    </div>
                    
                    <div className="flex gap-4 mt-3">
                      <button onClick={() => selectAll(selectedConversationMessages.map(m => m.id))} className="text-[13px] font-medium text-indigo-600 hover:underline hover:text-indigo-800">
                        Chọn tất cả
                      </button>
                      <button onClick={() => clearAll()} className="text-[13px] font-medium text-slate-500 hover:text-slate-800">
                        Bỏ chọn
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button title="Blacklist" className="p-2 rounded-lg border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition shadow-sm bg-white">
                      <Ban size={16} />
                    </button>
                    <button title="User Profile" className="p-2 rounded-lg border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition shadow-sm bg-white">
                      <User size={16} />
                    </button>
                    <button className="p-2 rounded-lg border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition shadow-sm bg-white">
                      <MoreVertical size={16} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 pb-28 relative bg-[#F8FAFC]">
                {selectedConversationMessages.map((msg) => {
                  const checked = selectedIds.has(msg.id);
                  const isExpanded = expandedMsgIds.includes(msg.id);
                  return (
                    <div 
                      key={msg.id} 
                      className={\`relative flex gap-3 group transition-colors p-2 -mx-2 rounded-xl \${
                        checked ? "bg-indigo-50/60 ring-1 ring-indigo-200" : "hover:bg-slate-100/50"
                      }\`}
                    >
                      <div className="pt-2 shrink-0 w-6 flex justify-center">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSelection(msg.id)}
                          className={\`w-[18px] h-[18px] rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer transition \${checked ? "opacity-100" : "opacity-0 group-hover:opacity-100"}\`}
                        />
                      </div>
                      <div className="shrink-0 pt-0.5">
                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 text-xs font-bold border border-slate-300">
                          {msg.senderDisplay.charAt(0).toUpperCase()}
                        </div>
                      </div>
                      
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-baseline gap-2">
                          <span className="text-[13px] font-semibold text-slate-900">{msg.senderDisplay}</span>
                          <span className="text-[11px] text-slate-400" title={msg.receivedAt}>{timeAgo(msg.receivedAt)}</span>
                        </div>
                        
                        <div className="inline-block bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[95%] shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                          <MessageRenderer 
                            content={msg.content} 
                            isExpanded={isExpanded} 
                            onToggleExpand={() => setExpandedMsgIds(p => p.includes(msg.id) ? p.filter(x => x !== msg.id) : [...p, msg.id])} 
                          />
                        </div>

                        {msg.projectIds && msg.projectIds.length > 0 && (
                          <div className="pl-1 pt-1 flex flex-wrap gap-1.5">
                            {msg.projectIds.map((pid) => {
                              const pName = localProjects.find(x => x.id === pid)?.code || pid;
                              return <span key={pid} className="px-2 py-0.5 border border-emerald-200 bg-emerald-50 text-[10px] font-semibold text-emerald-700 rounded-md">Đã gán: {pName}</span>;
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Selection Floating Action Bar */}
              <AnimatePresence>
                {selectedCount > 0 && (
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 20, opacity: 0 }}
                    className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] px-4 py-3 flex items-center gap-6 z-20 border border-slate-700/50"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-indigo-500 text-xs font-bold flex items-center justify-center shadow-inner text-white">
                        {selectedCount}
                      </div>
                      <span className="text-[13px] font-medium opacity-90">tin nhắn đã chọn</span>
                    </div>
                    
                    <div className="w-[1px] h-5 bg-slate-700" />
                    
                    <div className="flex gap-2">
                      <button onClick={clearAll} className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white transition">
                        Bỏ chọn
                      </button>
                      <button 
                        onClick={() => setIsMappingOpen(true)}
                        className="px-4 py-1.5 text-[13px] font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition shadow-sm flex items-center gap-1 group"
                      >
                        Gán vào Project
                        <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>

        {/* Column 3: Mapping Panel Drawer */}
        <AnimatePresence>
          {isMappingOpen && (
            <MappingPanel
              selectedMessages={selectedConversationMessages.filter(m => selectedIds.has(m.id))}
              projects={localProjects}
              isSaving={saving}
              onClose={() => setIsMappingOpen(false)}
              onRemoveMessage={(id) => toggleSelection(id)}
              onCreateProject={handleCreateProject}
              onSaveMapping={handleSaveMapping}
            />
          )}
        </AnimatePresence>
      </div>

      <ShortcutHint />
      {toastMessage && <Toast message={toastMessage} onClose={() => setToastMessage(null)} />}
    </div>
  );
}
`;

fs.writeFileSync('C:/Users/sangnq/Downloads/openclaw-local/workspace/src/components/features/inbox/omni-inbox-board.tsx', content);
