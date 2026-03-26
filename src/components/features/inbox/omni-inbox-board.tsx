"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import { Search, Mail, Phone, MessageCircle, X, Ban, User, MoreVertical, ChevronRight } from "lucide-react";
import { getInboxConversations, getInboxMessages, ignoreConversation, saveMessageProjectMapping } from "@/lib/api";
import { InboxConversationSummary, MessageChannel, PlatformMessage, Project } from "@/types/domain";

import Toast from "@/components/ui/Toast";
import { MessageRenderer } from "./components/MessageRenderer";
import { MappingPanel } from "./components/MappingPanel";
import { useMessageSelection } from "./hooks/useMessageSelection";

type ChannelFilter = "all" | MessageChannel;

interface OmniInboxBoardProps {
  projects: Project[];
  initialConversations: InboxConversationSummary[];
  initialMessagesByConversation?: Record<string, PlatformMessage[]>;
  initialSelectedConversationId?: string | null;
}

const PAGE_SIZE = 20;

const CHANNEL_COLORS = {
  zalo: { bg: "bg-emerald-100", text: "text-emerald-700", label: "ZALO", icon: MessageCircle },
  email: { bg: "bg-amber-100", text: "text-amber-700", label: "EMAIL", icon: Mail },
  whatsapp: { bg: "bg-green-100", text: "text-green-700", label: "WA", icon: Phone },
} as const;

function timeAgo(dateStr: string) {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return formatDistanceToNow(d, { addSuffix: true, locale: vi });
  } catch {
    return dateStr;
  }
}

export function OmniInboxBoard({
  projects,
  initialConversations,
  initialMessagesByConversation,
  initialSelectedConversationId,
}: OmniInboxBoardProps) {
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("email");
  const [searchQuery, setSearchQuery] = useState("");
  const [hideBlacklisted, setHideBlacklisted] = useState(true);
  const [ignoredConversations, setIgnoredConversations] = useState<Set<string>>(new Set());
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(initialSelectedConversationId ?? null);
  const [isMappingOpen, setIsMappingOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [localProjects, setLocalProjects] = useState<Project[]>(projects ?? []);
  const [expandedMsgIds, setExpandedMsgIds] = useState<string[]>([]);
  const projectNameById = useMemo(
    () =>
      new Map(
        (localProjects ?? []).map((p) => [String(p.id), p.name || p.code || `Project #${p.id}`]),
      ),
    [localProjects],
  );

  const [conversations, setConversations] = useState<InboxConversationSummary[]>(initialConversations ?? []);
  const [conversationOffset, setConversationOffset] = useState((initialConversations ?? []).length);
  const [conversationHasMore, setConversationHasMore] = useState((initialConversations ?? []).length === PAGE_SIZE);

  const [messagesByConversation, setMessagesByConversation] = useState<Record<string, PlatformMessage[]>>(
    initialMessagesByConversation ?? {},
  );
  const [messageMetaByConversation, setMessageMetaByConversation] = useState<
    Record<string, { offset: number; hasMore: boolean; loading: boolean }>
  >(() => {
    const seed: Record<string, { offset: number; hasMore: boolean; loading: boolean }> = {};
    if (initialMessagesByConversation) {
      for (const [conversationId, list] of Object.entries(initialMessagesByConversation)) {
        seed[conversationId] = { offset: list.length, hasMore: list.length === PAGE_SIZE, loading: false };
      }
    }
    return seed;
  });

  const { selectedIds, selectedCount, toggleSelection, selectAll, clearAll } = useMessageSelection();
  const convoListRef = useRef<HTMLDivElement | null>(null);
  const convoSentinelRef = useRef<HTMLDivElement | null>(null);
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollToLatestRef = useRef(false);
  const prependScrollAnchorRef = useRef<{ conversationId: string; prevHeight: number; prevTop: number } | null>(null);
  const conversationFetchesRef = useRef<Set<string>>(new Set());
  const messageFetchesRef = useRef<Set<string>>(new Set());
  const initializedProviderRef = useRef<string | undefined>(undefined);
  const usedInitialSeedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("omniInboxChannelFilter");
    if (saved === "email" || saved === "zalo" || saved === "whatsapp" || saved === "all") {
      setChannelFilter(saved as ChannelFilter);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("omniInboxChannelFilter", channelFilter);
    }
  }, [channelFilter]);

  const providerParam = useMemo(() => {
    if (channelFilter === "all") return undefined;
    if (channelFilter === "zalo") return "zalo_personal";
    if (channelFilter === "whatsapp") return "whatsapp_personal";
    return "email";
  }, [channelFilter]);

  const loadConversationsPage = useCallback(
    async (offset: number, append: boolean) => {
      const key = `${providerParam ?? "all"}:${offset}:${append ? "append" : "replace"}`;
      if (conversationFetchesRef.current.has(key)) return;
      conversationFetchesRef.current.add(key);
      setRemoteLoading(true);
      try {
        const data = await getInboxConversations({
          provider: providerParam,
          include_ignored: false,
          limit: PAGE_SIZE,
          offset,
        });
        setConversations((prev) => (append ? [...prev, ...data.items] : data.items));
        const nextOffset = offset + data.items.length;
        setConversationOffset(nextOffset);
        const total = data.total;
        setConversationHasMore(
          typeof total === "number" ? nextOffset < total : data.items.length === PAGE_SIZE,
        );
      } finally {
        setRemoteLoading(false);
      }
    },
    [providerParam],
  );

  const loadConversationMessages = useCallback(
    async (conversationId: string, appendOlder: boolean) => {
      const meta = messageMetaByConversation[conversationId] ?? { offset: 0, hasMore: true, loading: false };
      if (meta.loading) return;
      if (appendOlder && !meta.hasMore) return;
      const offset = appendOlder ? meta.offset : 0;
      const key = `${providerParam ?? "all"}:${conversationId}:${offset}:${appendOlder ? "append" : "replace"}`;
      if (messageFetchesRef.current.has(key)) return;
      messageFetchesRef.current.add(key);

      setMessageMetaByConversation((prev) => ({
        ...prev,
        [conversationId]: { ...(prev[conversationId] ?? { offset: 0, hasMore: true }), loading: true },
      }));
      setMessagesLoading(true);

      const list = messageListRef.current;
      if (appendOlder && list) {
        prependScrollAnchorRef.current = {
          conversationId,
          prevHeight: list.scrollHeight,
          prevTop: list.scrollTop,
        };
      }

      try {
        const data = await getInboxMessages({
          provider: providerParam,
          conversation_id: conversationId,
          include_ignored: false,
          limit: PAGE_SIZE,
          offset,
        });

        const incoming = [...data.items].sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
        setMessagesByConversation((prev) => {
          const existing = prev[conversationId] ?? [];
          if (!appendOlder) return { ...prev, [conversationId]: incoming };
          const existingIds = new Set(existing.map((m) => m.id));
          const merged = [...incoming.filter((m) => !existingIds.has(m.id)), ...existing];
          return { ...prev, [conversationId]: merged };
        });

        const nextOffset = offset + data.items.length;
        // Do not trust `total` blindly; some providers return inconsistent totals.
        // Continue paging while we still receive a full page.
        const hasMore = data.items.length === PAGE_SIZE;
        setMessageMetaByConversation((prev) => ({
          ...prev,
          [conversationId]: { offset: nextOffset, hasMore, loading: false },
        }));
      } finally {
        setMessagesLoading(false);
        setMessageMetaByConversation((prev) => ({
          ...prev,
          [conversationId]: {
            ...(prev[conversationId] ?? { offset: 0, hasMore: true }),
            loading: false,
          },
        }));
      }
    },
    [messageMetaByConversation, providerParam],
  );

  useEffect(() => {
    if (!usedInitialSeedRef.current && providerParam === "email" && (initialConversations?.length ?? 0) > 0) {
      usedInitialSeedRef.current = true;
      initializedProviderRef.current = providerParam;
      return;
    }
    if (initializedProviderRef.current === providerParam) return;
    initializedProviderRef.current = providerParam;
    conversationFetchesRef.current.clear();
    messageFetchesRef.current.clear();
    setConversationOffset(0);
    setConversationHasMore(true);
    setSelectedConversationId(null);
    setMessagesByConversation({});
    setMessageMetaByConversation({});
    void loadConversationsPage(0, false);
  }, [providerParam, loadConversationsPage]);

  useEffect(() => {
    if (conversations.length === 0) return;
    const firstId = conversations[0]?.id;
    if (!firstId) return;
    setSelectedConversationId((prev) => prev ?? firstId);
  }, [conversations]);

  useEffect(() => {
    if (!selectedConversationId) return;
    const hasLoaded = (messagesByConversation[selectedConversationId]?.length ?? 0) > 0;
    if (!hasLoaded) {
      void loadConversationMessages(selectedConversationId, false);
    }
  }, [selectedConversationId, messagesByConversation, loadConversationMessages]);

  useEffect(() => {
    if (!selectedConversationId) return;
    shouldAutoScrollToLatestRef.current = true;
  }, [selectedConversationId]);

  useEffect(() => {
    if (!selectedConversationId) return;
    if (!shouldAutoScrollToLatestRef.current) return;
    const list = messageListRef.current;
    if (!list) return;
    const messageCount = messagesByConversation[selectedConversationId]?.length ?? 0;
    if (messageCount <= 0) return;

    requestAnimationFrame(() => {
      list.scrollTo({ top: list.scrollHeight, behavior: "auto" });
    });
    shouldAutoScrollToLatestRef.current = false;
  }, [selectedConversationId, messagesByConversation]);

  useEffect(() => {
    const anchor = prependScrollAnchorRef.current;
    if (!anchor) return;
    if (anchor.conversationId !== selectedConversationId) {
      prependScrollAnchorRef.current = null;
      return;
    }
    const list = messageListRef.current;
    if (!list) return;
    const nextHeight = list.scrollHeight;
    if (nextHeight <= anchor.prevHeight) return;
    list.scrollTop = anchor.prevTop + (nextHeight - anchor.prevHeight);
    prependScrollAnchorRef.current = null;
  }, [selectedConversationId, messagesByConversation]);

  useEffect(() => {
    const root = convoListRef.current;
    const sentinel = convoSentinelRef.current;
    if (!root || !sentinel) return;

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && conversationHasMore && !remoteLoading) {
            void loadConversationsPage(conversationOffset, true);
          }
        });
      },
      { root, rootMargin: "200px", threshold: 0.1 },
    );

    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [conversationHasMore, conversationOffset, remoteLoading, loadConversationsPage]);

  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      const byQuery =
        searchQuery.trim() === "" ||
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.id.toLowerCase().includes(searchQuery.toLowerCase());
      const byBlacklist = hideBlacklisted ? !ignoredConversations.has(c.id) : true;
      return byQuery && byBlacklist;
    });
  }, [conversations, searchQuery, hideBlacklisted, ignoredConversations]);

  const selectedConversation = useMemo(
    () => filteredConversations.find((c) => c.id === selectedConversationId) ?? null,
    [filteredConversations, selectedConversationId],
  );

  const selectedConversationMessages = useMemo(
    () =>
      selectedConversationId
        ? [...(messagesByConversation[selectedConversationId] ?? [])].sort((a, b) =>
            a.receivedAt.localeCompare(b.receivedAt),
          )
        : [],
    [selectedConversationId, messagesByConversation],
  );

  const handleMessageListScroll = useCallback(() => {
    const root = messageListRef.current;
    if (!root || !selectedConversationId) return;
    if (root.scrollTop > 48) return;
    const meta = messageMetaByConversation[selectedConversationId];
    if (!meta || meta.loading || !meta.hasMore) return;
    void loadConversationMessages(selectedConversationId, true);
  }, [selectedConversationId, messageMetaByConversation, loadConversationMessages]);

  const handleSelectConversation = (id: string) => {
    if (id === selectedConversationId) return;
    shouldAutoScrollToLatestRef.current = true;
    setSelectedConversationId(id);
    clearAll();
    setIsMappingOpen(false);
  };

  const handleSaveMapping = async (projectIds: string[]) => {
    if (!selectedConversationId || selectedIds.size === 0 || projectIds.length === 0) return;
    const msgIds = Array.from(selectedIds);
    setSaving(true);
    const result = await saveMessageProjectMapping({ messageIds: msgIds, projectIds });
    if (result.ok) {
      setMessagesByConversation((prev) => {
        const current = prev[selectedConversationId] ?? [];
        const mapped = current.map((m) =>
          msgIds.includes(m.id) ? { ...m, projectIds: [...new Set([...(m.projectIds ?? []), ...projectIds])] } : m,
        );
        return { ...prev, [selectedConversationId]: mapped };
      });
      clearAll();
      setIsMappingOpen(false);
    }
    setToastMessage(result.message || "Đã gán tin nhắn vào project.");
    setSaving(false);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 relative overflow-hidden font-sans rounded-2xl shadow-sm border border-slate-200">
      <header className="bg-white border-b border-slate-200 px-6 py-4 shrink-0 shadow-sm z-10 relative">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Unified Inbox & Mapping</h1>
      </header>

      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shrink-0 sticky top-0 z-10">
        <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
          {(["email", "zalo", "whatsapp"] as const).map((ch) => {
            const active = channelFilter === ch;
            const ChIcon = CHANNEL_COLORS[ch].icon;
            return (
              <button
                key={ch}
                onClick={() => setChannelFilter(ch)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  active ? "bg-indigo-500 text-white shadow-sm" : "text-slate-600 hover:bg-slate-200"
                }`}
              >
                <ChIcon size={14} className={active ? "text-white" : "text-slate-500"} />
                {ch.charAt(0).toUpperCase() + ch.slice(1)}
              </button>
            );
          })}
        </div>

        <div className="relative flex-1 max-w-md mx-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm hội thoại..."
            className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
          />
          {searchQuery ? (
            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
              <X size={14} />
            </button>
          ) : null}
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" className="sr-only" checked={hideBlacklisted} onChange={(e) => setHideBlacklisted(e.target.checked)} />
          <span className="text-sm font-medium text-slate-700 flex items-center gap-1">
            <Ban size={14} className={hideBlacklisted ? "text-rose-500" : "text-slate-400"} /> Ẩn blacklist
          </span>
        </label>
      </div>

      <div className="flex flex-1 overflow-hidden relative min-w-0">
        <div className="w-[320px] bg-white border-r border-slate-200 flex flex-col shrink-0 h-full">
          <div className="p-3 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-800">Hội thoại ({filteredConversations.length})</h2>
          </div>
          <div ref={convoListRef} className="flex-1 overflow-y-auto p-2 space-y-1 bg-slate-50/50 relative [scrollbar-gutter:stable]">
            {filteredConversations.map((c) => {
              const isSelected = selectedConversation?.id === c.id;
              const loadedCount = (messagesByConversation[c.id] ?? []).length;
              const channel: MessageChannel =
                channelFilter === "all"
                  ? "email"
                  : channelFilter;
              const cConf = CHANNEL_COLORS[channel] || CHANNEL_COLORS.email;
              return (
                <button
                  key={c.id}
                  onClick={() => handleSelectConversation(c.id)}
                  className={`block w-full min-h-[78px] text-left p-3 rounded-lg border transition ${
                    isSelected ? "bg-indigo-50 border-indigo-400 border-l-[3px]" : "bg-white border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex justify-between gap-2">
                    <p className="text-[13px] font-semibold truncate">{c.name || c.id}</p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-200 px-1.5 text-[10px] font-semibold text-slate-700">
                        {loadedCount}
                      </span>
                      <span className={`px-1 py-[1px] rounded text-[9px] border ${cConf.bg} ${cConf.text}`}>{cConf.label}</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">{timeAgo(c.lastMessageAt ?? c.updatedAt ?? c.createdAt ?? "")}</p>
                </button>
              );
            })}
            <div ref={convoSentinelRef} className="w-full h-2" />
            {remoteLoading ? <p className="text-xs text-slate-500 py-2 text-center">Đang tải thêm hội thoại...</p> : null}
          </div>
        </div>

        <div className="flex-1 bg-white relative flex flex-col min-w-0 h-full overflow-x-hidden">
          {!selectedConversation ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
              <Mail size={28} className="text-slate-300" />
              <p className="text-sm mt-2">Vui lòng chọn hội thoại</p>
            </div>
          ) : (
            <>
              <div className="px-6 py-4 border-b border-slate-200 shrink-0 bg-white sticky top-0 z-10 min-w-0">
                <div className="flex justify-between items-start gap-4">
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold text-slate-900 truncate">{selectedConversation.name || selectedConversation.id}</h2>
                    <div className="flex gap-4 mt-2">
                      <button onClick={() => selectAll(selectedConversationMessages.map((m) => m.id))} className="text-[13px] font-medium text-indigo-600 hover:underline">Chọn tất cả</button>
                      <button onClick={clearAll} className="text-[13px] font-medium text-slate-500 hover:text-slate-800">Bỏ chọn</button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={async () => {
                        const current = ignoredConversations.has(selectedConversation.id);
                        const nextState = !current;
                        setIgnoredConversations((prev) => {
                          const next = new Set(prev);
                          if (nextState) next.add(selectedConversation.id);
                          else next.delete(selectedConversation.id);
                          return next;
                        });
                        const res = await ignoreConversation(selectedConversation.id, nextState);
                        if (!res.ok) setToastMessage(res.message);
                      }}
                      className="p-2 rounded-lg border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                    >
                      <Ban size={16} />
                    </button>
                    <button className="p-2 rounded-lg border border-slate-200 text-slate-400"><User size={16} /></button>
                    <button className="p-2 rounded-lg border border-slate-200 text-slate-400"><MoreVertical size={16} /></button>
                  </div>
                </div>
              </div>

              <div
                ref={messageListRef}
                onScroll={handleMessageListScroll}
                className="flex-1 overflow-y-auto px-6 py-6 space-y-6 pb-28 relative bg-[#F8FAFC] min-w-0"
              >
                {messagesLoading ? <p className="text-xs text-slate-500 text-center">Đang tải tin nhắn cũ...</p> : null}
                {selectedConversationMessages.map((msg) => {
                  const checked = selectedIds.has(msg.id);
                  const isExpanded = expandedMsgIds.includes(msg.id);
                  return (
                    <div key={msg.id} className={`relative flex gap-3 p-2 -mx-2 rounded-xl min-w-0 ${checked ? "bg-indigo-50/60 ring-1 ring-indigo-200" : "hover:bg-slate-100/50"}`}>
                      <div className="pt-2 shrink-0 w-6 flex justify-center">
                        <input type="checkbox" checked={checked} onChange={() => toggleSelection(msg.id)} className="w-[18px] h-[18px] rounded border-slate-300 text-indigo-600" />
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-baseline gap-2 min-w-0">
                          <span className="text-[13px] font-semibold text-slate-900 break-words [overflow-wrap:anywhere]">{msg.senderDisplay}</span>
                          <span className="text-[11px] text-slate-400">{timeAgo(msg.receivedAt)}</span>
                        </div>
                        <div className="inline-block bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[95%] min-w-0 overflow-hidden break-words [overflow-wrap:anywhere]">
                          <MessageRenderer
                            content={msg.content}
                            bodyHtml={msg.bodyHtml}
                            isExpanded={isExpanded}
                            onToggleExpand={() =>
                              setExpandedMsgIds((p) => (p.includes(msg.id) ? p.filter((x) => x !== msg.id) : [...p, msg.id]))
                            }
                          />
                        </div>
                        {((msg.projectIds?.length ?? 0) > 0 || msg.project?.name) ? (
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {(msg.projectIds ?? []).map((pid) => (
                              <span
                                key={`${msg.id}-${pid}`}
                                className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700"
                              >
                                {projectNameById.get(String(pid)) ?? `Project #${pid}`}
                              </span>
                            ))}
                            {msg.project?.name && !(msg.projectIds ?? []).some((pid) => String(pid) === String(msg.project?.id)) ? (
                              <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700">
                                {msg.project.name}
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>

              <AnimatePresence>
                {selectedCount > 0 ? (
                  <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white rounded-xl px-4 py-3 flex items-center gap-6 z-20">
                    <span className="text-[13px] font-medium">{selectedCount} tin nhắn đã chọn</span>
                    <button onClick={() => setIsMappingOpen(true)} className="px-4 py-1.5 text-[13px] font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition flex items-center gap-1">
                      Gán vào Project <ChevronRight size={14} />
                    </button>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </>
          )}
        </div>

        <AnimatePresence>
          {isMappingOpen ? (
            <MappingPanel
              selectedMessages={selectedConversationMessages.filter((m) => selectedIds.has(m.id))}
              projects={localProjects}
              isSaving={saving}
              onClose={() => setIsMappingOpen(false)}
              onRemoveMessage={(id) => toggleSelection(id)}
              onCreateProject={(code) => {
                const id = `proj-${Date.now()}`;
                setLocalProjects((prev) => [
                  { id, code, name: code, ownerName: "", status: "new", lastUpdateAt: new Date().toISOString(), unreadCount: 0, summary: "", todoList: [] },
                  ...prev,
                ]);
              }}
              onSaveMapping={handleSaveMapping}
            />
          ) : null}
        </AnimatePresence>
      </div>

      {toastMessage ? <Toast message={toastMessage} onClose={() => setToastMessage(null)} /> : null}
    </div>
  );
}
