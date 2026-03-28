"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { 
  getInboxConversations, 
  getInboxMessages, 
  ignoreConversation, 
  saveMessageProjectMapping 
} from "@/lib/api";
import { 
  InboxConversationSummary, 
  MessageChannel, 
  PlatformMessage, 
  Project 
} from "@/types/domain";

import Toast from "@/components/ui/Toast";
import { MessageRenderer } from "./components/MessageRenderer";
import { MappingPanel } from "./components/MappingPanel";
import { useMessageSelection } from "./hooks/useMessageSelection";

// New Components
import { ConversationItem } from "./components/ConversationItem";
import { ChannelTabs } from "./components/ChannelTabs";
import { FilterBar } from "./components/FilterBar";
import { ChatHeader } from "./components/ChatHeader";
import { DetailsPanel } from "./components/DetailsPanel";
import { EmptyState } from "./components/EmptyState";
import { ConversationListSkeleton, MessageSkeleton } from "./components/SkeletonLoader";
import { BulkActionBar } from "./components/BulkActionBar";
import { AlertBanner } from "./components/AlertBanner";

type ChannelFilter = "all" | MessageChannel;

interface OmniInboxBoardProps {
  projects: Project[];
  initialConversations: InboxConversationSummary[];
  initialMessagesByConversation?: Record<string, PlatformMessage[]>;
  initialSelectedConversationId?: string | null;
}

const PAGE_SIZE = 20;

const INBOX_VIEW_STATE_KEY = "omniInboxViewState";

type InboxViewState = {
  channelFilter: ChannelFilter;
  selectedByChannel: Partial<Record<Exclude<ChannelFilter, "all">, string>>;
};

export function OmniInboxBoard({
  projects,
  initialConversations,
  initialMessagesByConversation,
  initialSelectedConversationId,
}: OmniInboxBoardProps) {
  const persistedState: InboxViewState | null = useMemo(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(INBOX_VIEW_STATE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<InboxViewState>;
      const cf = parsed.channelFilter;
      const channelFilter: ChannelFilter =
        cf === "email" || cf === "zalo" || cf === "whatsapp" || cf === "all" ? cf : "email";
      const selectedByChannel = (parsed.selectedByChannel ?? {}) as InboxViewState["selectedByChannel"];
      return { channelFilter, selectedByChannel };
    } catch {
      return null;
    }
  }, []);

  const [remoteLoading, setRemoteLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>(persistedState?.channelFilter ?? "email");
  const [searchQuery, setSearchQuery] = useState("");
  const [hideBlacklisted, setHideBlacklisted] = useState(true);
  const [ignoredConversations, setIgnoredConversations] = useState<Set<string>>(new Set());
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(initialSelectedConversationId ?? null);
  const [isMappingOpen, setIsMappingOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [localProjects, setLocalProjects] = useState<Project[]>(projects ?? []);
  const [expandedMsgIds, setExpandedMsgIds] = useState<string[]>([]);
  const [persistedSelectionByChannel, setPersistedSelectionByChannel] = useState<InboxViewState["selectedByChannel"]>(
    persistedState?.selectedByChannel ?? {},
  );

  const [mediaOnlyMsgs, setMediaOnlyMsgs] = useState<Set<string>>(new Set());

  // FIX v13: Stabilize callback and prevent unnecessary state updates that cause infinite loops
  const handleMediaOnlyChange = useCallback((msgId: string, isMedia: boolean) => {
    setMediaOnlyMsgs(prev => {
      // Comparison check: If set state already matches incoming value, skip update to avoid loop
      const alreadyHas = prev.has(msgId);
      if (isMedia === alreadyHas) return prev;
      
      const next = new Set(prev);
      if (isMedia) next.add(msgId);
      else next.delete(msgId);
      return next;
    });
  }, []);

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
  const loadMoreOldestSentinelRef = useRef<HTMLDivElement | null>(null);
  const lastLoadTimeRef = useRef<number>(0);

  const prevScrollHeightRef = useRef<number>(0);
  const isAppendingRef = useRef<boolean>(false);
  
  const conversationFetchesRef = useRef<Set<string>>(new Set());
  const messageFetchesRef = useRef<Set<string>>(new Set());
  const initializedProviderRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (conversations.length > 0) {
      setIgnoredConversations(prev => {
        const next = new Set(prev);
        conversations.forEach(c => {
          if (c.isIgnored) next.add(c.id);
        });
        return next;
      });
    }
  }, [conversations]);

  const persistInboxViewState = useCallback(
    (
      nextChannelFilter: ChannelFilter,
      selectedByChannelPatch?: Partial<InboxViewState["selectedByChannel"]>,
    ) => {
      if (typeof window === "undefined") return;
      const nextSelectedByChannel =
        selectedByChannelPatch && Object.keys(selectedByChannelPatch).length > 0
          ? {
              ...persistedSelectionByChannel,
              ...selectedByChannelPatch,
            }
          : persistedSelectionByChannel;
      if (nextSelectedByChannel !== persistedSelectionByChannel) {
        setPersistedSelectionByChannel(nextSelectedByChannel);
      }
      try {
        const nextState: InboxViewState = {
          channelFilter: nextChannelFilter,
          selectedByChannel: nextSelectedByChannel,
        };
        localStorage.setItem(INBOX_VIEW_STATE_KEY, JSON.stringify(nextState));
      } catch {
        // ignore storage errors
      }
    },
    [persistedSelectionByChannel],
  );

  const providerParam = useMemo(() => {
    if (channelFilter === "all") return undefined;
    if (channelFilter === "zalo") return "zalo_personal";
    if (channelFilter === "whatsapp") return "whatsapp_personal";
    return "email";
  }, [channelFilter]);

  const loadConversationsPage = useCallback(
    async (append: boolean) => {
      if (remoteLoading) return;
      if (append && !conversationHasMore) return;

      const offset = append ? conversationOffset : 0;
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
        
        // Match message pattern: use data.items.length === PAGE_SIZE for hasMore
        const hasMore = data.items.length === PAGE_SIZE;
        setConversationHasMore(hasMore);
      } catch (err) {
        console.error("Error loading conversations:", err);
        // Remove key to allow retry if it failed
        conversationFetchesRef.current.delete(key);
      } finally {
        setRemoteLoading(false);
      }
    },
    [providerParam, conversationOffset, conversationHasMore, remoteLoading],
  );

  const loadConversationMessages = useCallback(
    async (conversationId: string, appendOlder: boolean) => {
      const now = Date.now();
      if (appendOlder && now - lastLoadTimeRef.current < 1500) return; // Prevent loop
      
      const meta = messageMetaByConversation[conversationId] ?? { offset: 0, hasMore: true, loading: false };
      if (meta.loading) return;
      if (appendOlder && !meta.hasMore) return;
      
      const offset = appendOlder ? meta.offset : 0;
      const key = `${providerParam ?? "all"}:${conversationId}:${offset}:${appendOlder ? "append" : "replace"}`;
      if (messageFetchesRef.current.has(key)) return;
      messageFetchesRef.current.add(key);

      if (appendOlder && messageListRef.current) {
        // Precise capture before state update
        prevScrollHeightRef.current = messageListRef.current.scrollHeight;
        isAppendingRef.current = true;
      }

      setMessageMetaByConversation((prev) => ({
        ...prev,
        [conversationId]: { ...(prev[conversationId] ?? { offset: 0, hasMore: true }), loading: true },
      }));
      setMessagesLoading(true);

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
        const hasMore = data.items.length === PAGE_SIZE;
        setMessageMetaByConversation((prev) => ({
          ...prev,
          [conversationId]: { offset: nextOffset, hasMore, loading: false },
        }));
        if (appendOlder) lastLoadTimeRef.current = Date.now();
      } finally {
        setMessagesLoading(false);
      }
    },
    [messageMetaByConversation, providerParam],
  );

  useLayoutEffect(() => {
    if (isAppendingRef.current && messageListRef.current) {
      const container = messageListRef.current;
      const heightDiff = container.scrollHeight - prevScrollHeightRef.current;
      if (heightDiff > 0) {
        // Force manual anchoring for flex-col-reverse because native anchoring
        // sometimes jumps in React's async rendering cycles.
        container.scrollTop += heightDiff;
      }
      isAppendingRef.current = false;
    }
  }, [messagesByConversation]);

  useEffect(() => {
    // If we have initial data and we're on the default provider (email), skip the first reset
    if (!initializedProviderRef.current && initialConversations.length > 0 && providerParam === 'email') {
      initializedProviderRef.current = providerParam;
      return;
    }
    
    if (initializedProviderRef.current === providerParam) return;
    initializedProviderRef.current = providerParam;
    
    // THOROUGH RESET on tab change - Always load fresh
    conversationFetchesRef.current.clear();
    messageFetchesRef.current.clear();
    setConversationOffset(0);
    setConversationHasMore(true);
    setConversations([]);
    setSelectedConversationId(null);
    setMessagesByConversation({});
    setMessageMetaByConversation({});
    setMediaOnlyMsgs(new Set());
    
    void loadConversationsPage(false);
  }, [providerParam, loadConversationsPage]);

  useEffect(() => {
    if (conversations.length === 0) return;
    const firstId = conversations[0]?.id;
    if (!firstId) return;

    const savedId =
      channelFilter === "all"
        ? null
        : (persistedSelectionByChannel[channelFilter] ?? null);

    setSelectedConversationId((prev) => {
      if (prev && conversations.some((c) => c.id === prev)) return prev;
      if (savedId && conversations.some((c) => c.id === savedId)) return savedId;
      return firstId;
    });
  }, [conversations, channelFilter, persistedSelectionByChannel]);

  useEffect(() => {
    if (!selectedConversationId) return;
    const hasLoaded = (messagesByConversation[selectedConversationId]?.length ?? 0) > 0;
    if (!hasLoaded) {
      void loadConversationMessages(selectedConversationId, false);
    }
  }, [selectedConversationId, messagesByConversation, loadConversationMessages]);

  // Match message observer pattern for robust trigger
  useEffect(() => {
    const root = convoListRef.current;
    const sentinel = convoSentinelRef.current;
    if (!root || !sentinel) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry && entry.isIntersecting && !remoteLoading && conversationHasMore) {
          void loadConversationsPage(true);
        }
      },
      { root, rootMargin: "0px", threshold: 0.1 },
    );

    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [conversationHasMore, remoteLoading, loadConversationsPage]);

  useEffect(() => {
    const scrollContainer = messageListRef.current;
    const sentinel = loadMoreOldestSentinelRef.current;
    if (!scrollContainer || !sentinel || !selectedConversationId) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && !messagesLoading) {
          const meta = messageMetaByConversation[selectedConversationId];
          if (meta && meta.hasMore && !meta.loading) {
            void loadConversationMessages(selectedConversationId, true);
          }
        }
      },
      { root: scrollContainer, rootMargin: "0px", threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [selectedConversationId, messagesLoading, messageMetaByConversation, loadConversationMessages]);

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

  const handleSelectConversation = (id: string) => {
    if (id === selectedConversationId) return;
    if (channelFilter !== "all") {
      persistInboxViewState(channelFilter, { [channelFilter]: id });
    }
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

  const handleToggleIgnore = async () => {
    if (!selectedConversation) return;
    const current = ignoredConversations.has(selectedConversation.id);
    const nextState = !current;
    setIgnoredConversations((prev) => {
      const next = new Set(prev);
      if (nextState) next.add(selectedConversation.id);
      else next.delete(selectedConversation.id);
      return next;
    });
    const res = await ignoreConversation(selectedConversation.id, nextState);
    if (!res.ok) {
      setToastMessage(res.message);
      setIgnoredConversations((prev) => {
        const next = new Set(prev);
        if (current) next.add(selectedConversation.id);
        else next.delete(selectedConversation.id);
        return next;
      });
    }
  };

  const unreadCounts = useMemo(() => {
    return {
      email: conversations.filter(c => c.provider === 'email').length,
      zalo: conversations.filter(c => c.provider === 'zalo_personal').length,
      whatsapp: conversations.filter(c => c.provider === 'whatsapp_personal').length,
    };
  }, [conversations]);

  const hasMoreMessages = useMemo(() => {
    if (!selectedConversationId) return false;
    return messageMetaByConversation[selectedConversationId]?.hasMore ?? false;
  }, [selectedConversationId, messageMetaByConversation]);

  return (
    <div className="flex h-full bg-white overflow-hidden shadow-2xl border-l border-slate-200">
      <aside className="w-[320px] bg-white border-r border-slate-200 flex flex-col shrink-0 h-full relative z-20 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
        <ChannelTabs 
          active={channelFilter} 
          counts={unreadCounts} 
          onChange={(ch) => {
            persistInboxViewState(ch);
            setChannelFilter(ch);
          }} 
        />
        
        <FilterBar 
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          hideBlacklisted={hideBlacklisted}
          onHideBlacklistedChange={setHideBlacklisted}
          totalCount={filteredConversations.length}
        />

        <div ref={convoListRef} className="flex-1 overflow-y-auto bg-white custom-scrollbar">
          {remoteLoading && conversations.length === 0 ? (
            <ConversationListSkeleton />
          ) : (
            filteredConversations.map((c) => (
              <ConversationItem
                key={c.id}
                conversation={c}
                channel={channelFilter === "all" ? "email" : (channelFilter as MessageChannel)}
                isSelected={selectedConversationId === c.id}
                isIgnored={ignoredConversations.has(c.id)}
                messageCount={(messagesByConversation[c.id] ?? []).length}
                onClick={() => handleSelectConversation(c.id)}
                lastMessage={messagesByConversation[c.id]?.at(-1)}
              />
            ))
          )}
          <div ref={convoSentinelRef} className="h-4 w-full" />
          {remoteLoading && conversations.length > 0 && <div className="p-4 text-center"><ConversationListSkeleton /></div>}
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-full min-w-0 bg-[#F8FAFC] relative">
        {selectedConversation ? (
          <>
            <ChatHeader 
              conversation={selectedConversation}
              channel={channelFilter === "all" ? "email" : (channelFilter as MessageChannel)}
              isIgnored={ignoredConversations.has(selectedConversation.id)}
              isDetailsOpen={isDetailsOpen}
              onToggleIgnore={handleToggleIgnore}
              onToggleDetails={() => setIsDetailsOpen(!isDetailsOpen)}
            />


            <div
              ref={messageListRef}
              className="flex-1 overflow-y-auto px-6 py-4 flex flex-col-reverse relative custom-scrollbar"
              style={{ overflowAnchor: "auto" }}
            >
              {hasMoreMessages && (
                <div ref={loadMoreOldestSentinelRef} className="h-4 w-full shrink-0 order-last" />
              )}

              {messagesLoading && <div className="py-4 order-last"><MessageSkeleton /></div>}
              
              {(() => {
                const groups: { date: string, messages: PlatformMessage[] }[] = [];
                selectedConversationMessages.forEach(msg => {
                  const date = new Date(msg.receivedAt).toLocaleDateString('vi-VN');
                  const last = groups[groups.length - 1];
                  if (last && last.date === date) last.messages.push(msg);
                  else groups.push({ date, messages: [msg] });
                });

                return [...groups].reverse().map((group, gIdx) => (
                  <div key={`group-${gIdx}`} className="flex flex-col-reverse gap-4 mb-4">
                    {[...group.messages].reverse().map((msg) => {
                      const isChecked = selectedIds.has(msg.id);
                      const isExpanded = expandedMsgIds.includes(msg.id);
                      const isOutbound = msg.isOutbound === true;
                      const isMediaOnly = mediaOnlyMsgs.has(msg.id);
                      
                      const timeStr = (() => {
                        const d = new Date(msg.receivedAt);
                        return !isNaN(d.getTime()) 
                          ? d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) 
                          : "";
                      })();

                      return (
                        <div
                          key={msg.id}
                          className={`relative flex gap-3 px-2 py-1 -mx-2 rounded-2xl group/row transition-colors ${
                            isChecked ? "bg-violet-50/50 ring-1 ring-violet-200" : "hover:bg-slate-200/20"
                          } ${isOutbound ? "flex-row-reverse" : "flex-row"}`}
                        >
                          <div className={`shrink-0 flex items-center justify-center w-6 transition-opacity ${isChecked ? 'opacity-100' : 'opacity-0 group-hover/row:opacity-100'}`}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleSelection(msg.id)}
                              className="w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500 cursor-pointer"
                            />
                          </div>

                          {!isOutbound && (
                            <div className="shrink-0 pt-1">
                              {msg.senderAvatarUrl ? (
                                <img src={msg.senderAvatarUrl} alt={msg.senderDisplay} className="w-8 h-8 rounded-full shadow-sm" />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-[11px] font-bold text-slate-500 border border-slate-300">
                                  {msg.senderDisplay?.slice(0, 1).toUpperCase()}
                                </div>
                              )}
                            </div>
                          )}

                          <div className={`flex-1 min-w-0 flex flex-col ${isOutbound ? "items-end" : "items-start"}`}>
                            {!isOutbound && (
                              <span className="text-[11px] font-bold text-slate-500 mb-1 ml-1 tracking-tight">
                                {msg.senderDisplay}
                              </span>
                            )}
                            
                            <div
                              className={`relative inline-block transition-all duration-200 overflow-hidden break-words ${
                                isMediaOnly 
                                  ? "bg-transparent border-transparent p-0 shadow-none ring-0 w-fit" 
                                  : `max-w-[85%] w-fit rounded-2xl px-4 py-3 shadow-sm border ${
                                      isOutbound 
                                        ? "bg-[#e5efff] border-[#d8e8ff] text-slate-900 rounded-tr-sm" 
                                        : "bg-white border-slate-200 text-slate-800 rounded-tl-sm shadow-[0_2px_4px_rgba(0,0,0,0.02)]"
                                    }`
                              }`}
                            >
                              <div className="min-w-0">
                                <MessageRenderer
                                  content={msg.content}
                                  bodyHtml={msg.channel === "email" ? msg.bodyHtml : undefined}
                                  mediaUrls={msg.mediaUrls}
                                  isExpanded={isExpanded}
                                  onMediaOnlyChange={(isMedia) => handleMediaOnlyChange(msg.id, isMedia)}
                                  onToggleExpand={() =>
                                    setExpandedMsgIds((p) =>
                                      p.includes(msg.id) ? p.filter((x) => x !== msg.id) : [...p, msg.id]
                                    )
                                  }
                                />
                              </div>
                              
                              {!isMediaOnly && (
                                <div className={`flex items-center gap-1 mt-2 ${isOutbound ? 'justify-end text-slate-500' : 'justify-start text-slate-400'}`}>
                                  <span className="text-[10px] font-bold tabular-nums opacity-60">
                                    {timeStr}
                                  </span>
                                </div>
                              )}

                              {isMediaOnly && (
                                <div className={`mt-1 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/5 backdrop-blur-sm text-slate-400 text-[10px] font-bold w-fit ${isOutbound ? 'self-end' : 'self-start'}`}>
                                  {timeStr}
                                </div>
                              )}
                            </div>

                            {((msg.projectIds?.length ?? 0) > 0 || msg.project?.name) && (
                              <div className={`mt-2 flex flex-wrap gap-1.5 ${isOutbound ? "justify-end" : "justify-start"}`}>
                                {(msg.projectIds ?? []).map((pid) => (
                                  <span
                                    key={`${msg.id}-${pid}`}
                                    className="inline-flex items-center rounded-lg border border-violet-100 bg-violet-50 px-2 py-0.5 text-[9px] font-bold text-violet-700 uppercase"
                                  >
                                    {projectNameById.get(String(pid)) ?? `Project #${pid}`}
                                  </span>
                                ))}
                                {msg.project && (
                                  <span className="inline-flex items-center rounded-lg border border-teal-100 bg-teal-50 px-2 py-0.5 text-[9px] font-bold text-teal-700 uppercase">
                                    {msg.project.name}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* Date Tag moved to bottom of code - will appear at the TOP of the group in flex-col-reverse */}
                    <div className="flex justify-center sticky top-2 z-10 mb-4 mt-2">
                      <span className="px-3 py-1 bg-white/90 backdrop-blur-sm border border-slate-100 rounded-full text-[11px] font-bold text-slate-500 shadow-sm uppercase tracking-wider">
                        {(() => {
                          const today = new Date().toLocaleDateString('vi-VN');
                          const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('vi-VN');
                          if (group.date === today) return "Hôm nay";
                          if (group.date === yesterday) return "Hôm qua";
                          return group.date;
                        })()}
                      </span>
                    </div>
                  </div>
                ));
              })()}
            </div>

            <AnimatePresence>
              {selectedCount > 0 && (
                <BulkActionBar 
                  selectedCount={selectedCount}
                  onAssignToProject={() => setIsMappingOpen(true)}
                  onClear={clearAll}
                />
              )}
            </AnimatePresence>
          </>
        ) : (
          <EmptyState />
        )}
      </main>

      <div className="flex-none">
        <DetailsPanel 
          conversation={selectedConversation}
          isOpen={isDetailsOpen}
          onClose={() => setIsDetailsOpen(false)}
        />
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

      {toastMessage ? <Toast message={toastMessage} onClose={() => setToastMessage(null)} /> : null}
    </div>
  );
}
