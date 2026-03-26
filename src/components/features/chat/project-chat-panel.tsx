"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Menu, MessageCircle, Send } from "lucide-react";
import { ChatSession, ChatSessionMessage, getChatSessionMessages } from "@/lib/api";
import { getAccessToken } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth-store";
import { useAiStore } from "@/store/useAiStore";

interface ProjectChatPanelProps {
  sessions: ChatSession[];
}

function formatTimeLabel(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function markdownContent(content: string, mine: boolean) {
  const inlineCodeClass = mine
    ? "rounded bg-slate-700 px-1 py-0.5 text-xs text-white"
    : "rounded bg-slate-100 px-1 py-0.5 text-xs text-slate-800";

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="whitespace-pre-wrap leading-relaxed">{children}</p>,
        ul: ({ children }) => <ul className="ml-4 list-disc space-y-1">{children}</ul>,
        ol: ({ children }) => <ol className="ml-4 list-decimal space-y-1">{children}</ol>,
        code: ({ inline, children }: { inline?: boolean; children?: React.ReactNode }) =>
          inline ? <code className={inlineCodeClass}>{children}</code> : <code>{children}</code>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

export function ProjectChatPanel({ sessions }: ProjectChatPanelProps) {
  const [selectedSessionId, setSelectedSessionId] = useState<string>(sessions[0]?.id ?? "");
  const [messagesBySession, setMessagesBySession] = useState<Record<string, ChatSessionMessage[]>>({});
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [typingBySession, setTypingBySession] = useState<Record<string, boolean>>({});
  const [statusMessage, setStatusMessage] = useState("Dang ket noi AI server...");
  const [isRoomsOpen, setIsRoomsOpen] = useState(false);
  const messageViewportRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const selectedSessionIdRef = useRef<string>(selectedSessionId);

  const user = useAuthStore((state) => state.user);
  const saleName = user?.username ?? "You";
  const { aiStatus: containerStatus } = useAiStore();

  const selectedSession = useMemo(
    () => sessions.find((s) => s.id === selectedSessionId),
    [sessions, selectedSessionId],
  );

  const currentMessages = useMemo(
    () => messagesBySession[selectedSessionId] ?? [],
    [messagesBySession, selectedSessionId],
  );

  useEffect(() => {
    if (!selectedSessionId && sessions.length > 0) {
      setSelectedSessionId(sessions[0].id);
    }
  }, [sessions, selectedSessionId]);

  useEffect(() => {
    selectedSessionIdRef.current = selectedSessionId;
  }, [selectedSessionId]);

  useEffect(() => {
    if (!selectedSessionId) return;
    if (messagesBySession[selectedSessionId]) return;

    let mounted = true;
    setLoadingMessages(true);

    void (async () => {
      try {
        const msgs = await getChatSessionMessages(selectedSessionId, { limit: 200, offset: 0 });
        if (!mounted) return;
        setMessagesBySession((prev) => ({ ...prev, [selectedSessionId]: msgs }));
      } finally {
        if (mounted) setLoadingMessages(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [selectedSessionId, messagesBySession]);


  useEffect(() => {
    if (containerStatus !== "ready") {
      if (containerStatus === "starting") setStatusMessage("AI container dang khoi dong. Tam thoi chua gui duoc tin.");
      else if (containerStatus === "stopped") setStatusMessage("AI container dang tam dung. Vui long bat ket noi AI.");
      else if (containerStatus === "not_exists") setStatusMessage("AI container chua duoc tao. Vui long bat ket noi AI.");
      else if (containerStatus === "error") setStatusMessage("Khong kiem tra duoc trang thai AI container.");
    }
  }, [containerStatus]);

  useEffect(() => {
    const backendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8080/api").replace(/\/$/, "");
    const wsBaseUrl = (process.env.NEXT_PUBLIC_CHAT_WS_URL?.trim() || `${backendUrl.replace(/^http/i, "ws")}/chat/ws`).replace(/\/$/, "");

    let disposed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleReconnect = (delayMs = 2500) => {
      if (disposed) return;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(connect, delayMs);
    };

    const connect = () => {
      if (disposed) return;
      const token = getAccessToken();
      if (!token) {
        setStatusMessage("Chua co token, dang cho xac thuc...");
        scheduleReconnect(1200);
        return;
      }

      const ws = new WebSocket(`${wsBaseUrl}?token=${encodeURIComponent(token)}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatusMessage("Da ket noi AI server.");
      };

      ws.onmessage = (event) => {
        let data: unknown;
        try {
          data = JSON.parse(event.data);
        } catch {
          return;
        }

        const incoming = data as {
          type?: string;
          role?: string;
          content?: string;
          message?: string;
          created_at?: string;
          session_id?: string;
        };

        const targetSessionId = incoming.session_id || selectedSessionIdRef.current;
        if (!targetSessionId) return;

        if (incoming.type === "status") {
          if (typeof incoming.message === "string") setStatusMessage(incoming.message);
          return;
        }

        if (incoming.type === "thinking") {
          setTypingBySession((prev) => ({ ...prev, [targetSessionId]: true }));
          return;
        }

        if (incoming.type === "error") {
          const errText = incoming.message || incoming.content || "Co loi khi nhan phan hoi.";
          setMessagesBySession((prev) => ({
            ...prev,
            [targetSessionId]: [
              ...(prev[targetSessionId] ?? []),
              {
                id: `err-${Date.now()}`,
                role: "assistant",
                content: errText,
                createdAt: new Date().toISOString(),
              },
            ],
          }));
          setTypingBySession((prev) => ({ ...prev, [targetSessionId]: false }));
          setSending(false);
          return;
        }

        if (incoming.type === "stream" || incoming.type === "system" || incoming.type === "message") {
          const content = incoming.content ?? incoming.message ?? "";
          if (!content) return;
          setMessagesBySession((prev) => ({
            ...prev,
            [targetSessionId]: [
              ...(prev[targetSessionId] ?? []),
              {
                id: `ws-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                role: incoming.role ?? "assistant",
                content,
                createdAt: incoming.created_at ?? new Date().toISOString(),
              },
            ],
          }));
          setTypingBySession((prev) => ({ ...prev, [targetSessionId]: false }));
          setSending(false);
        }

        if (incoming.type === "done") {
          // stop showing typing animation when done
          setTypingBySession((prev) => ({ ...prev, [targetSessionId]: false }));
          setSending(false);
        }
      };

      ws.onclose = () => {
        if (disposed) return;
        setStatusMessage("Mat ket noi AI server, dang thu lai...");
        scheduleReconnect();
      };

      ws.onerror = () => {
        if (disposed) return;
        setStatusMessage("Loi ket noi WebSocket.");
      };
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  useEffect(() => {
    const viewport = messageViewportRef.current;
    if (!viewport) return;
    viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
  }, [currentMessages.length, selectedSessionId]);

  async function handleSend() {
    if (!draft.trim() || !selectedSession) return;
    if (containerStatus !== "ready") {
      setStatusMessage("AI container chua san sang. Vui long bat ket noi AI truoc khi gui tin nhan.");
      return;
    }

    const content = draft.trim();
    const localMsg: ChatSessionMessage = {
      id: `local-${Date.now()}`,
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };

    setMessagesBySession((prev) => ({
      ...prev,
      [selectedSession.id]: [...(prev[selectedSession.id] ?? []), localMsg],
    }));

    setDraft("");
    setSending(true);

    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setStatusMessage("AI server khong ket noi. Khong the gui tin nhan.");
      setSending(false);
      return;
    }

    try {
      ws.send(
        JSON.stringify({
          type: "chat",
          content,
          session_id: selectedSession.id,
          project_id: selectedSession.project_id,
        }),
      );
      setStatusMessage("Dang gui tin nhan...");
    } catch {
      setStatusMessage("Loi khi gui tin nhan.");
      setSending(false);
    }
  }

  const sessionsPanel = (
    <aside className="h-full min-h-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <h2 className="px-1 text-sm font-semibold text-slate-800">Chat Sessions</h2>
      <p className="px-1 pt-1 text-xs text-slate-500">Sidebar su dung GET /chat/sessions</p>

      <div className="mt-3 space-y-2 overflow-y-auto pr-1">
        {sessions.map((session) => {
          const active = session.id === selectedSessionId;
          const projectName = session.project?.name ?? `Project #${session.project_id}`;
          const msgCount = (messagesBySession[session.id] ?? []).length;
          return (
            <button
              key={session.id}
              type="button"
              onClick={() => {
                setSelectedSessionId(session.id);
                setIsRoomsOpen(false);
              }}
              className={`group relative flex min-h-[52px] w-full items-center gap-3 rounded-xl border-l-2 px-3 py-2 text-left transition ${active
                ? "border-l-blue-300 bg-blue-700 text-white"
                : "border-l-transparent border-slate-200 bg-slate-50 text-slate-700 hover:border-l-blue-500 hover:bg-blue-50"
                }`}
            >
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${active ? "bg-blue-600" : "bg-white"}`}>
                <MessageCircle className={active ? "h-4 w-4 text-white" : "h-4 w-4 text-slate-500"} />
              </div>
              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm font-semibold ${active ? "text-white" : "text-slate-900"}`}>{session.name}</p>
                <p className={`truncate text-[11px] ${active ? "text-blue-100" : "text-slate-400"}`}>{projectName}</p>
              </div>
              {msgCount > 0 ? (
                <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold ${active ? "bg-white/20 text-white" : "bg-teal-500 text-white"}`}>
                  {msgCount}
                </span>
              ) : null}
            </button>
          );
        })}

        {sessions.length === 0 ? <p className="px-2 py-2 text-sm text-slate-500">Khong co session nao.</p> : null}
      </div>
    </aside>
  );

  return (
    <div className="relative h-full min-h-0">
      <div className="grid h-full min-h-0 gap-4 md:grid-cols-[280px_1fr]">
        <div className="hidden min-h-0 md:block">{sessionsPanel}</div>

        <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <header className="border-b border-slate-200 px-4 py-3 md:px-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsRoomsOpen(true)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700 md:hidden"
                  aria-label="Mo danh sach session"
                >
                  <Menu className="h-4 w-4" />
                </button>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100 text-lg text-teal-700">
                  <MessageCircle className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-lg font-bold text-slate-900">{selectedSession?.name ?? "Chat voi Agent"}</h3>
                  <p className="truncate text-xs text-slate-400">{selectedSession?.project?.name ?? (selectedSession ? `Project #${selectedSession.project_id}` : "")}</p>
                </div>
              </div>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${containerStatus === "ready"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-amber-100 text-amber-700"
                  }`}
              >
                {containerStatus === "ready" ? "AI ready" : "AI not ready"}
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-400">{statusMessage}</p>
          </header>

          <div ref={messageViewportRef} className="min-h-0 flex-1 overflow-y-auto bg-slate-50 px-3 py-4 md:px-5" role="log" aria-live="polite">
            {loadingMessages ? <p className="text-sm text-slate-500">Dang tai lich su tin nhan...</p> : null}
            {!loadingMessages && currentMessages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-500">
                <MessageCircle className="h-8 w-8 opacity-40" />
                <p>Chon session de bat dau xem chat.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {currentMessages.map((message) => {
                  const role = String(message.role || "").toLowerCase();
                  const mine = role === "user" || role === "sale";
                  return (
                    <div key={message.id} className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}>
                      {!mine ? (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-100 text-xs font-bold text-teal-700">
                          <MessageCircle className="h-4 w-4" />
                        </div>
                      ) : null}

                      <div className={`max-w-[72%] ${mine ? "order-1" : "order-2"}`}>
                        <article
                          className={`px-4 py-2 text-sm shadow-sm ${mine
                            ? "rounded-[18px_18px_4px_18px] bg-blue-600 text-white"
                            : "rounded-[18px_18px_18px_4px] border border-slate-200 bg-white text-slate-800"
                            }`}
                        >
                          {markdownContent(message.content, mine)}
                        </article>
                        <p className={`mt-1 text-xs text-slate-400 ${mine ? "text-right" : "text-left"}`}>
                          {mine ? "User" : "Assistant"} • {formatTimeLabel(message.createdAt)}
                        </p>
                      </div>

                      {mine ? (
                        <div className="order-2 flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-white">
                          {saleName.slice(0, 1).toUpperCase()}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
                {typingBySession[selectedSessionId] ? (
                  <div className={`flex items-end gap-2 justify-start`}>
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-100 text-xs font-bold text-teal-700">
                      <MessageCircle className="h-4 w-4" />
                    </div>

                    <div className={`max-w-[72%] order-2`}>
                      <article className={`px-4 py-2 text-sm rounded-[18px_18px_18px_4px] border border-slate-200 bg-white text-slate-800 shadow-sm`}>
                        <span className="inline-flex items-center gap-1">
                          <span className="inline-block h-2 w-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "0s" }} />
                          <span className="inline-block h-2 w-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "0.12s" }} />
                          <span className="inline-block h-2 w-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "0.24s" }} />
                        </span>
                      </article>
                      <p className={`mt-1 text-xs text-slate-400 text-left`}>Assistant • {formatTimeLabel(new Date().toISOString())}</p>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 bg-white px-3 py-3 md:px-5">
            <div className="rounded-xl border border-slate-200 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20">
              <div className="flex items-end gap-2 p-2">
                <textarea
                  rows={1}
                  value={draft}
                  disabled={sending || !selectedSession || containerStatus !== "ready"}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      if (!sending) void handleSend();
                    }
                  }}
                  aria-label="Nhap cau hoi cho agent"
                  placeholder={
                    !selectedSession
                      ? "Chon session de nhan tin"
                      : containerStatus !== "ready"
                        ? "AI container chua san sang. Vui long bat ket noi AI"
                        : "Nhap cau hoi cho agent..."
                  }
                  className="min-h-[44px] max-h-[120px] w-full resize-none bg-transparent px-2 py-2 text-sm outline-none"
                />

                <button
                  type="button"
                  disabled={sending || !selectedSession || containerStatus !== "ready"}
                  onClick={handleSend}
                  aria-label="Gui tin nhan"
                  className="inline-flex h-9 items-center gap-1 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  <Send className="h-4 w-4" />
                  <span>{sending ? "Dang gui..." : "Gui"}</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      {isRoomsOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setIsRoomsOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-[85%] max-w-sm bg-white p-3 shadow-2xl">{sessionsPanel}</div>
        </div>
      ) : null}
    </div>
  );
}
