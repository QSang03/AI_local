"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addBlacklistEntry,
  removeBlacklistEntry,
  saveMessageProjectMapping,
  getOmniInboxData,
} from "@/lib/api";
import {
  BlacklistEntry,
  MessageChannel,
  PlatformMessage,
  Project,
} from "@/types/domain";
import Toast from "@/components/ui/Toast";
import Loader from "@/components/ui/Loader";
import {
  MappingHistoryEntry,
  MappingHistoryPanel,
} from "@/components/features/inbox/mapping-history-panel";
import ShortcutHint from "@/components/ui/ShortcutHint";

function mapProviderToChannel(provider?: string | null): MessageChannel {
  if (!provider) return "email";
  const p = provider.toLowerCase();
  if (p.includes("zalo")) return "zalo";
  if (p.includes("whatsapp")) return "whatsapp";
  if (p.includes("email")) return "email";
  return "email";
}

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

interface MappingUndoEntry extends MappingHistoryEntry {
  previousByMessage: Record<string, string[]>;
}

const VIRTUAL_ROW_HEIGHT = 128;
const VIRTUAL_VIEWPORT_HEIGHT = 540;

export function OmniInboxBoard({
  initialMessages,
  initialBlacklist,
  projects,
}: OmniInboxBoardProps) {
  const [messages, setMessages] = useState<PlatformMessage[]>(initialMessages ?? []);
  const [blacklist, setBlacklist] = useState<BlacklistEntry[]>(initialBlacklist ?? []);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("all");
  const [query, setQuery] = useState("");
  const [hideBlacklisted, setHideBlacklisted] = useState(true);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [selectedMsgIds, setSelectedMsgIds] = useState<string[]>([]);
  const [expandedMsgIds, setExpandedMsgIds] = useState<string[]>([]);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [blacklistReason, setBlacklistReason] = useState("Spam / khong lien quan");
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<MappingUndoEntry[]>([]);
  const [redoStack, setRedoStack] = useState<MappingUndoEntry[]>([]);
  const [localProjects, setLocalProjects] = useState<Project[]>(projects ?? []);
  const [newProjectCode, setNewProjectCode] = useState("");
  const [newProjectName, setNewProjectName] = useState("");
  const [showAssignPanel, setShowAssignPanel] = useState(false);
  const [showConfirmSave, setShowConfirmSave] = useState(false);
  const showCopyControls = false;
  const [listPage, setListPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [scrollTop, setScrollTop] = useState(0);

  const blacklistedSet = useMemo(
    () => new Set(blacklist.map((e) => `${e.channel}:${e.senderId}`)),
    [blacklist],
  );

  const filteredMessages = useMemo(() => {
    return messages.filter((m) => {
      const byChannel = channelFilter === "all" || m.channel === channelFilter;
      const byQuery =
        query.trim().length === 0 ||
        m.subject.toLowerCase().includes(query.toLowerCase()) ||
        m.senderDisplay.toLowerCase().includes(query.toLowerCase()) ||
        m.snippet.toLowerCase().includes(query.toLowerCase());
      const isBlacklisted = blacklistedSet.has(`${m.channel}:${m.senderId}`);
      const byBlacklist = hideBlacklisted ? !isBlacklisted : true;
      return byChannel && byQuery && byBlacklist;
    });
  }, [messages, channelFilter, query, blacklistedSet, hideBlacklisted]);

  // Fetch server-side when channel filter changes so backend can apply provider filter
  useEffect(() => {
    let mounted = true;
    async function loadFiltered() {
      // Map frontend channel to backend provider parameter
      const providerParam =
        channelFilter === "all"
          ? undefined
          : channelFilter === "email"
          ? "email"
          : channelFilter === "zalo"
          ? "zalo_personal"
          : channelFilter === "whatsapp"
          ? "whatsapp_personal"
          : undefined;

      if (!providerParam) {
        // For 'all' we can keep local messages (no server call needed)
        return;
      }

      setRemoteLoading(true);
      try {
        const data = await getOmniInboxData(providerParam);
        if (!mounted) return;
        setMessages(data.messages ?? []);
        setBlacklist(data.blacklist ?? []);
      } catch (err) {
        // ignore; keep existing messages
      } finally {
        if (mounted) setRemoteLoading(false);
      }
    }

    void loadFiltered();
    return () => {
      mounted = false;
    };
  }, [channelFilter]);

  const filteredConversations = useMemo(() => {
    const grouped = new Map<string, PlatformMessage[]>();

    filteredMessages.forEach((message) => {
      const key = message.conversationId;
      const bucket = grouped.get(key) ?? [];
      bucket.push(message);
      grouped.set(key, bucket);
    });

    const conversations: InboxConversation[] = Array.from(grouped.entries()).map(
      ([id, convoMessages]) => {
        const sorted = [...convoMessages].sort((a, b) =>
          b.receivedAt.localeCompare(a.receivedAt),
        );
        const latest = sorted[0];
        const projectIds = Array.from(
          new Set(convoMessages.flatMap((item) => item.projectIds ?? [])),
        );

        const computedChannel = latest.channel ?? mapProviderToChannel((latest.rawChannel as any)?.provider);
        const computedThreadTitle = latest.subject || (latest.rawConversation as any)?.name || latest.snippet || "(No title)";

        return {
          id,
          threadTitle: computedThreadTitle,
          channel: computedChannel,
          senderId: latest.senderId,
          senderDisplay: latest.senderDisplay,
          messageIds: convoMessages.map((item) => item.id),
          messageCount: convoMessages.length,
          latestReceivedAt: latest.receivedAt,
          latestSubject: latest.subject,
          latestSnippet: latest.snippet,
          latestContent: latest.content,
          projectIds,
          latestExternalId: latest.externalId ?? null,
          latestRawChannelProvider: (latest.rawChannel as any)?.provider ?? null,
        };
      },
    );

    return conversations.sort((a, b) =>
      b.latestReceivedAt.localeCompare(a.latestReceivedAt),
    );
  }, [filteredMessages]);

  const totalPages = Math.max(1, Math.ceil(filteredConversations.length / pageSize));
  const safePage = Math.min(listPage, totalPages);

  const pagedConversations = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredConversations.slice(start, start + pageSize);
  }, [filteredConversations, pageSize, safePage]);

  const overscan = 4;
  const visibleCount = Math.ceil(VIRTUAL_VIEWPORT_HEIGHT / VIRTUAL_ROW_HEIGHT);
  const startIndex = Math.max(0, Math.floor(scrollTop / VIRTUAL_ROW_HEIGHT) - overscan);
  const endIndex = Math.min(
    pagedConversations.length,
    startIndex + visibleCount + overscan * 2,
  );

  const virtualItems = pagedConversations.slice(startIndex, endIndex);
  const topSpacer = startIndex * VIRTUAL_ROW_HEIGHT;
  const bottomSpacer = Math.max(0, (pagedConversations.length - endIndex) * VIRTUAL_ROW_HEIGHT);

  const primarySelected = useMemo(
    () => filteredConversations.find((convo) => convo.id === selectedConversationId) ?? filteredConversations[0] ?? null,
    [filteredConversations, selectedConversationId],
  );

  const primarySelectedMessages = useMemo(() => {
    if (!primarySelected) return [];
    return filteredMessages
      .filter((m) => m.conversationId === primarySelected.id)
      .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
  }, [filteredMessages, primarySelected]);

  // Optionally auto-select all messages when a new conversation is clicked
  // We can just rely on the user visually seeing it, but let's implement select logic:
  function toggleProject(projectId: string) {
    setSelectedProjectIds((prev) =>
      prev.includes(projectId) ? prev.filter((id) => id !== projectId) : [...prev, projectId],
    );
  }

  function handleSelectConversation(conversationId: string) {
    setSelectedConversationId(conversationId);
    const convo = filteredConversations.find((c) => c.id === conversationId);
    if (convo) {
      setSelectedMsgIds([...convo.messageIds]);
    }
  }

  function toggleMessageSelection(messageId: string) {
    setSelectedMsgIds((prev) => {
      if (prev.includes(messageId)) {
        const next = prev.filter((id) => id !== messageId);
        if (next.length === 0) setShowAssignPanel(false);
        return next;
      }
      setShowAssignPanel(true);
      return [...prev, messageId];
    });
  }

  function toggleExpandMessage(messageId: string) {
    setExpandedMsgIds((prev) => (prev.includes(messageId) ? prev.filter((id) => id !== messageId) : [...prev, messageId]));
  }

  function isContentLongOrUnbroken(content: string | undefined | null) {
    if (!content) return false;
    if (content.length > 400) return true;
    const tokens = content.split(/\s+/);
    return tokens.some((t) => t.length > 120);
  }

  const handleUndoMapping = useCallback(async (entryId: string) => {
    const entry = undoStack.find((item) => item.id === entryId);
    if (!entry) {
      return;
    }

    setSaving(true);

    const results = await Promise.all(
      entry.messageIds.map((messageId) =>
        saveMessageProjectMapping({
          messageIds: [messageId],
          projectIds: entry.previousByMessage[messageId] ?? [],
        }),
      ),
    );

    const okCount = results.filter((r) => r.ok).length;

    if (okCount > 0) {
      setMessages((prev) =>
        prev.map((m) =>
          entry.messageIds.includes(m.id)
            ? { ...m, projectIds: entry.previousByMessage[m.id] ?? [] }
            : m,
        ),
      );
      setUndoStack((prev) => prev.filter((item) => item.id !== entryId));
      setRedoStack((prev) => [entry, ...prev].slice(0, 30));
    }

    setToastMessage(
      okCount === entry.messageIds.length
        ? "Da undo mapping thanh cong."
        : `Undo thanh cong ${okCount}/${entry.messageIds.length} tin nhan.`,
    );
    setSaving(false);
  }, [undoStack]);

  const handleRedoMapping = useCallback(async (entryId: string) => {
    const entry = redoStack.find((item) => item.id === entryId);
    if (!entry) {
      return;
    }

    setSaving(true);

    const result = await saveMessageProjectMapping({
      messageIds: entry.messageIds,
      projectIds: entry.toProjectIds,
    });

    if (result.ok) {
      setMessages((prev) =>
        prev.map((m) =>
          entry.messageIds.includes(m.id)
            ? { ...m, projectIds: [...entry.toProjectIds] }
            : m,
        ),
      );
      setRedoStack((prev) => prev.filter((item) => item.id !== entryId));
      setUndoStack((prev) => [entry, ...prev].slice(0, 30));
    }

    setToastMessage(result.message || "Redo mapping xong.");
    setSaving(false);
  }, [redoStack]);

  useEffect(() => {
    function handleKeydown(ev: KeyboardEvent) {
      const meta = ev.ctrlKey || ev.metaKey;
      if (!meta) return;

      const target = ev.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;

      const key = ev.key.toLowerCase();
      if (key === "z" && !ev.shiftKey) {
        if (undoStack.length === 0) return;
        ev.preventDefault();
        handleUndoMapping(undoStack[0].id);
        return;
      }

      if (key === "y" || (key === "z" && ev.shiftKey)) {
        if (redoStack.length === 0) return;
        ev.preventDefault();
        handleRedoMapping(redoStack[0].id);
      }
    }

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [undoStack, redoStack, handleUndoMapping, handleRedoMapping]);

  async function handleSaveMapping() {
    if (selectedMsgIds.length === 0 || selectedProjectIds.length === 0) {
      setToastMessage("Can chon it nhat 1 tin nhan va 1 project.");
      return;
    }

    const previousByMessage = Object.fromEntries(
      selectedMsgIds.map((messageId) => {
        const found = messages.find((m) => m.id === messageId);
        return [messageId, found?.projectIds ?? []];
      }),
    );

    setSaving(true);
    const result = await saveMessageProjectMapping({
      messageIds: selectedMsgIds,
      projectIds: selectedProjectIds,
    });

    if (result.ok) {
      setMessages((prev) =>
        prev.map((m) =>
          selectedMsgIds.includes(m.id)
            ? { ...m, projectIds: [...selectedProjectIds] }
            : m,
        ),
      );

      setUndoStack((prev) => [
        {
          id: `map-${Date.now()}`,
          messageIds: [...selectedMsgIds],
          toProjectIds: [...selectedProjectIds],
          previousByMessage,
          createdAt: Date.now(),
        },
        ...prev,
      ].slice(0, 30));
      setRedoStack([]);
    }

    setToastMessage(result.message);
    setSaving(false);
  }

  async function handleAddBlacklist() {
    if (!primarySelected) {
      setToastMessage("Chua co cuoc hoi thoai de them blacklist.");
      return;
    }

    setSaving(true);
    const result = await addBlacklistEntry({
      channel: primarySelected.channel,
      senderId: primarySelected.senderId,
      senderDisplay: primarySelected.senderDisplay,
      reason: blacklistReason,
    });

    if (result.ok && result.entry) {
      setBlacklist((prev) => [result.entry as BlacklistEntry, ...prev]);
    }

    setToastMessage(result.message);
    setSaving(false);
  }

  async function handleRemoveBlacklist(entryId: string) {
    setSaving(true);
    const result = await removeBlacklistEntry(entryId);
    if (result.ok) {
      setBlacklist((prev) => prev.filter((e) => e.id !== entryId));
    }
    setToastMessage(result.message);
    setSaving(false);
  }

  async function handleCopyConversationId(conversationId: string) {
    try {
      await navigator.clipboard.writeText(conversationId);
      setToastMessage(`Da copy conversationId: ${conversationId}`);
    } catch {
      setToastMessage("Khong copy duoc conversationId. Vui long thu lai.");
    }
  }

  async function handleCopyThreadTitle(threadTitle: string) {
    try {
      await navigator.clipboard.writeText(threadTitle);
      setToastMessage(`Da copy threadTitle: ${threadTitle}`);
    } catch {
      setToastMessage("Khong copy duoc threadTitle. Vui long thu lai.");
    }
  }

  async function handleCopyConversationBundle(conversation: InboxConversation) {
    const text = `${conversation.id} | ${conversation.threadTitle} | ${conversation.senderId}`;
    try {
      await navigator.clipboard.writeText(text);
      setToastMessage(`Da copy: ${text}`);
    } catch {
      setToastMessage("Khong copy duoc thong tin. Vui long thu lai.");
    }
  }

  function handleCreateProject() {
    const code = newProjectCode.trim();
    if (!code) {
      setToastMessage("Vui long nhap ma project.");
      return;
    }

    const id = `proj-${Date.now()}`;
    const proj: Project = {
      id,
      code,
      name: newProjectName.trim() || code,
      ownerName: "",
      status: "new",
      lastUpdateAt: new Date().toISOString(),
      unreadCount: 0,
      summary: "",
      todoList: [],
    };

    setLocalProjects((prev) => [proj, ...prev]);
    setSelectedProjectIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setNewProjectCode("");
    setNewProjectName("");
    setToastMessage("Tao project moi thanh cong.");
  }

  const selectedMessagesDetails = useMemo(() => {
    return messages.filter((m) => selectedMsgIds.includes(m.id));
  }, [messages, selectedMsgIds]);

  const isDrawerOpen = showAssignPanel || selectedMsgIds.length > 0;

  return (
    <div className={`space-y-4 transition-[padding] duration-300 ${isDrawerOpen ? "xl:pr-[320px]" : ""}`}>
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {(["all", "email", "zalo", "whatsapp"] as ChannelFilter[]).map((ch) => {
              const active = channelFilter === ch;
              return (
                <button
                  key={ch}
                  onClick={() => {
                    setChannelFilter(ch);
                    setListPage(1);
                    setScrollTop(0);
                  }}
                  className={`rounded-xl px-3 py-1.5 text-sm font-semibold transition ${
                    active
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {ch === "all" ? "Tat ca" : ch.toUpperCase()}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setListPage(1);
                setScrollTop(0);
              }}
              placeholder="Tim theo nguoi gui, tieu de, noi dung..."
              className="w-72 rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
            />
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={hideBlacklisted}
                onChange={(e) => {
                  setHideBlacklisted(e.target.checked);
                  setListPage(1);
                  setScrollTop(0);
                }}
              />
              An nguoi trong blacklist
            </label>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_2fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Du lieu tin nhan</h2>
            <span className="text-xs text-slate-500">
              {filteredConversations.length} cuoc hoi thoai • trang {safePage}/{totalPages}
            </span>
          </div>

          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span>Page size</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setListPage(1);
                  setScrollTop(0);
                }}
                className="rounded-md border border-slate-300 px-2 py-1"
              >
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => {
                  setListPage((prev) => Math.max(1, prev - 1));
                  setScrollTop(0);
                }}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 disabled:opacity-40"
              >
                Prev
              </button>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => {
                  setListPage((prev) => Math.min(totalPages, prev + 1));
                  setScrollTop(0);
                }}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>

          <div
            className="max-h-[540px] overflow-auto pr-1"
            style={{ height: VIRTUAL_VIEWPORT_HEIGHT }}
            onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
          >
            <div style={{ height: topSpacer }} />
            <div className="space-y-2">
              {virtualItems.map((conversation) => {
                const active = selectedConversationId === conversation.id;
                const isBlacklisted = blacklistedSet.has(
                  `${conversation.channel}:${conversation.senderId}`,
                );
                return (
                  <div
                    key={conversation.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleSelectConversation(conversation.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handleSelectConversation(conversation.id);
                      }
                    }}
                    className={`w-full cursor-pointer rounded-xl border p-3 text-left transition focus:outline-none focus:ring-2 focus:ring-sky-400 ${
                      active
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-slate-50 hover:border-slate-400"
                    }`}
                    style={{ minHeight: VIRTUAL_ROW_HEIGHT - 8 }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
                        {conversation.channel} • {conversation.messageCount} tin
                      </p>
                      <p className="text-xs opacity-70">{conversation.latestReceivedAt}</p>
                    </div>
                    <p className="mt-1 text-sm font-semibold">{conversation.latestSubject}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => e.stopPropagation()}
                        title={`Internal\nconversationId: ${conversation.id}\nthreadTitle: ${conversation.threadTitle}\nexternalId: ${conversation.latestExternalId ?? "-"}\nprovider: ${conversation.latestRawChannelProvider ?? conversation.channel}`}
                        className="text-[11px] opacity-70 rounded-md border border-slate-200 px-2 py-0.5"
                      >
                        i
                      </button>
                    </div>
                    <p className="text-xs opacity-80">{conversation.senderDisplay}</p>
                    <p className="mt-1 text-xs opacity-80 line-clamp-2">{conversation.latestSnippet}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {conversation.projectIds.map((pid) => (
                        <span
                          key={pid}
                          className="rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800"
                        >
                          {localProjects.find((p) => p.id === pid)?.code ?? pid}
                        </span>
                      ))}
                      {isBlacklisted ? (
                        <span className="rounded-md bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-800">
                          Blacklisted
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ height: bottomSpacer }} />
          </div>
        </section>

        <section className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm h-[800px]">
          <h2 className="text-lg font-semibold text-slate-900">Chi tiet hoi thoai</h2>
          {primarySelected ? (
            <div className="mt-3 flex flex-col flex-1 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-col gap-2 pb-3 mb-3 border-b border-slate-200">
                <p className="font-semibold text-sm text-slate-900">{primarySelected.threadTitle}</p>
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs text-slate-500 mr-2 self-center">
                    {primarySelected.senderDisplay} • {primarySelected.latestRawChannelProvider ?? primarySelected.channel}
                  </span>
                  {showCopyControls ? (
                    <>
                      <button
                        type="button"
                        onClick={() => void handleCopyConversationId(primarySelected.id)}
                        className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        Copy auto ID
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleCopyThreadTitle(primarySelected.threadTitle)}
                        className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        Copy title
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleCopyConversationBundle(primarySelected)}
                        className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        Copy all
                      </button>
                    </>
                  ) : null}
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedMsgIds(primarySelectedMessages.map(m => m.id))}
                    className="text-[11px] text-sky-600 hover:underline font-semibold"
                  >
                    Chon tat ca tin nhan
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedMsgIds([])}
                    className="text-[11px] text-slate-500 hover:underline font-semibold"
                  >
                    Bo chon tat ca
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                {primarySelectedMessages.map((msg) => (
                  <div key={msg.id} className="flex gap-3">
                    <input
                      type="checkbox"
                      checked={selectedMsgIds.includes(msg.id)}
                      onChange={() => toggleMessageSelection(msg.id)}
                      className="mt-1 flex-shrink-0 cursor-pointer h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                    />
                    <div className="flex-1 rounded-xl border border-slate-200 bg-white p-3 shadow-sm hover:border-slate-300 transition">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-semibold text-slate-900">{msg.senderDisplay}</p>
                        <p className="text-[11px] text-slate-500">{msg.receivedAt}</p>
                      </div>
                      {(() => {
                        const isExpanded = expandedMsgIds.includes(msg.id);
                        const needsToggle = isContentLongOrUnbroken(msg.content);
                        return (
                          <>
                            <div
                              className={`text-sm text-slate-700 whitespace-pre-wrap leading-relaxed break-all ${!isExpanded && needsToggle ? "max-h-44 overflow-hidden" : ""}`}
                            >
                              {msg.content}
                            </div>
                            {needsToggle ? (
                              <div className="mt-2">
                                <button
                                  type="button"
                                  onClick={() => toggleExpandMessage(msg.id)}
                                  className="text-xs text-sky-600 font-semibold"
                                >
                                  {isExpanded ? "Thu gọn" : "Xem thêm"}
                                </button>
                              </div>
                            ) : null}
                          </>
                        );
                      })()}
                      {msg.projectIds && msg.projectIds.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1 border-t border-slate-50 pt-2">
                          {msg.projectIds.map((pid) => (
                            <span
                              key={pid}
                              className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800"
                            >
                              {localProjects.find((p) => p.id === pid)?.code ?? pid}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500">
              Chon 1 cuoc hoi thoai trong danh sach ben trai de xem
            </div>
          )}
        </section>
      </div>

      {/* Top action banner shown when messages are selected */}
      {selectedMsgIds.length > 0 ? (
        <div className="my-4 rounded-2xl border border-transparent bg-gradient-to-r from-indigo-50 to-white p-4 shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-indigo-700">{selectedMsgIds.length} tin nhan da duoc chon</p>
              <p className="text-xs text-slate-500">Chon hanh dong nhanh hoac gan vao project</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAssignPanel((s) => !s)}
                className="rounded-full bg-slate-900 px-3 py-1 text-sm font-semibold text-white"
              >
                {showAssignPanel ? "Đóng" : "Gán vào project"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Drawer: slide-in mapping panel from right */}
      {isDrawerOpen ? (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30 xl:hidden"
            onClick={() => {
              setShowAssignPanel(false);
              setSelectedMsgIds([]);
            }}
          />

          <aside className="fixed right-0 top-0 z-50 h-full w-[320px] bg-white shadow-xl flex flex-col border-l border-slate-200">
            <div className="flex items-center justify-between border-b p-4">
              <div>
                <p className="text-sm font-semibold">Gán dự án</p>
                <p className="text-xs text-slate-500 font-medium">{selectedMsgIds.length} tin nhắn đã chọn</p>
              </div>
              <button
                onClick={() => {
                  setShowAssignPanel(false);
                  setSelectedMsgIds([]);
                }}
                className="text-slate-400 hover:text-slate-900 px-2 py-1 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <div className="p-4 flex-1 overflow-auto flex flex-col gap-5">
              {/* Selected messages list */}
              <div className="rounded-md border border-slate-200 bg-slate-50 p-2 max-h-48 overflow-y-auto space-y-1 shadow-inner">
                {selectedMessagesDetails.map(msg => (
                  <div key={msg.id} className="flex items-center justify-between gap-2 border-b border-slate-200 last:border-0 pb-1.5 pt-1 last:pb-0 first:pt-0">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-slate-800 truncate">{msg.senderDisplay}</p>
                      <p className="text-[10px] text-slate-500 truncate">{msg.receivedAt}</p>
                    </div>
                    <button 
                      onClick={() => toggleMessageSelection(msg.id)}
                      className="text-slate-400 hover:text-rose-600 text-sm px-1.5"
                      title="Bỏ chọn"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>

              {/* Project Selection */}
              <div>
                <div className="mb-3 flex gap-2">
                  <input
                    value={newProjectCode}
                    onChange={(e) => setNewProjectCode(e.target.value)}
                    placeholder="Tìm hoặc mã project mới"
                    className="flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm bg-white focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  />
                  <button
                    type="button"
                    onClick={handleCreateProject}
                    className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-700 transition"
                  >
                    + Tạo
                  </button>
                </div>

                <div className="space-y-1 border border-slate-200 rounded-md p-1 bg-slate-50 max-h-[300px] overflow-y-auto">
                  {localProjects.map((project) => (
                    <label key={project.id} className="flex items-center gap-3 rounded-md p-2 hover:bg-white hover:shadow-sm cursor-pointer transition">
                      <input
                        type="checkbox"
                        checked={selectedProjectIds.includes(project.id)}
                        onChange={() => toggleProject(project.id)}
                        className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                      />
                      <div className="flex-1 text-left min-w-0">
                        <div className="font-semibold text-sm truncate text-slate-800">{project.code}</div>
                        {project.name !== project.code && (
                          <div className="text-[11px] text-slate-500 truncate">{project.name}</div>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 p-4 bg-slate-50">
              <div className="flex gap-2 w-full">
                <button
                  onClick={() => {
                    setShowAssignPanel(false);
                    setSelectedMsgIds([]);
                  }}
                  className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 font-medium transition"
                >
                  Hủy
                </button>
                <button
                  onClick={() => setShowConfirmSave(true)}
                  disabled={saving || selectedMsgIds.length === 0}
                  className="flex-1 rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 transition"
                >
                  Lưu mapping
                </button>
              </div>
            </div>
          </aside>
        </>
      ) : null}

      {saving ? <Loader /> : null}
      {/* Confirm modal for saving mapping */}
      {showConfirmSave ? (
        <div className="fixed inset-0 z-60 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowConfirmSave(false)}
          />

          <div className="relative z-70 w-[440px] rounded-lg bg-white p-6 shadow-lg">
            <p className="text-sm font-semibold">Xác nhận lưu mapping</p>
            <p className="mt-2 text-sm text-slate-600">
              Bạn sắp gán {selectedMsgIds.length} tin nhắn vào {selectedProjectIds.length} project.
              Tiếp tục?
            </p>

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setShowConfirmSave(false)}
                className="rounded-md border px-3 py-2 text-sm text-slate-700"
              >
                Hủy
              </button>
              <button
                onClick={async () => {
                  setShowConfirmSave(false);
                  await handleSaveMapping();
                  setShowAssignPanel(false);
                  setSelectedMsgIds([]);
                }}
                disabled={saving || selectedMsgIds.length === 0}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <ShortcutHint />
      {toastMessage ? (
        <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
      ) : null}
    </div>
  );
}
