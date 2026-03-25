"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { confirmFileUpload, requestFileUploadUrl } from "@/lib/api";
import { ChatMessage, Project, ProjectChatThread } from "@/types/domain";
import { useAuthStore } from "@/store/auth-store";

interface ProjectChatPanelProps {
  projects: Project[];
  initialThreads: ProjectChatThread[];
}

interface UploadingFile {
  id: string;
  name: string;
  progress: number;
  status: "uploading" | "confirming" | "done" | "error";
  error?: string;
}

function nowTimeLabel() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function renderMessageContent(content: string, mine: boolean) {
  const inlineCodeClass = mine
    ? "rounded bg-slate-700 px-1 py-0.5 text-xs text-white"
    : "rounded bg-slate-100 px-1 py-0.5 text-xs text-slate-800";
  const preClass = mine
    ? "mt-2 overflow-x-auto rounded-lg bg-slate-950/70 p-2 text-xs"
    : "mt-2 overflow-x-auto rounded-lg bg-slate-900 p-2 text-xs text-slate-100";

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="whitespace-pre-wrap leading-relaxed">{children}</p>,
        ul: ({ children }) => <ul className="ml-4 list-disc space-y-1">{children}</ul>,
        ol: ({ children }) => <ol className="ml-4 list-decimal space-y-1">{children}</ol>,
        code: ({ inline, children }: { inline?: boolean; children?: React.ReactNode }) =>
          inline ? <code className={inlineCodeClass}>{children}</code> : <code>{children}</code>,
        pre: ({ children }) => <pre className={preClass}>{children}</pre>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

export function ProjectChatPanel({ projects, initialThreads }: ProjectChatPanelProps) {
  const wsRef = useRef<WebSocket | null>(null);
  const streamMessageIdRef = useRef<string | null>(null);
  const selectedProjectIdRef = useRef<string>(initialThreads[0]?.projectId ?? projects[0]?.id ?? "");
  const messageViewportRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const atBottomRef = useRef(true);

  const bridgeUrl = process.env.NEXT_PUBLIC_CHAT_BRIDGE_WS_URL ?? "";
  const bridgeEnabled = bridgeUrl.length > 0;

  const user = useAuthStore((state) => state.user);
  const saleId = user?.id ?? process.env.NEXT_PUBLIC_SALE_ID ?? "sale_sang";
  const saleName = user?.username ?? process.env.NEXT_PUBLIC_SALE_NAME ?? "Sang";

  const [threads, setThreads] = useState<ProjectChatThread[]>(initialThreads);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    initialThreads[0]?.projectId ?? projects[0]?.id ?? "",
  );
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [bridgeConnected, setBridgeConnected] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Dang ket noi chat-bridge...");
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [isRoomsOpen, setIsRoomsOpen] = useState(false);
  const [showJumpToNew, setShowJumpToNew] = useState(false);
  const [isAgentThinking, setIsAgentThinking] = useState(false);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId),
    [projects, selectedProjectId],
  );

  const selectedThread = useMemo(() => {
    return threads.find((thread) => thread.projectId === selectedProjectId);
  }, [selectedProjectId, threads]);

  const messageCount = selectedThread?.messages.length ?? 0;

  function ensureThread(projectId: string, projectName: string) {
    setThreads((prev) => {
      const existing = prev.find((thread) => thread.projectId === projectId);
      if (existing) {
        return prev;
      }
      return [...prev, { projectId, projectName, messages: [] }];
    });
  }

  function pushMessage(projectId: string, message: ChatMessage) {
    setThreads((prev) =>
      prev.map((thread) =>
        thread.projectId === projectId
          ? { ...thread, messages: [...thread.messages, message] }
          : thread,
      ),
    );
  }

  function appendToMessage(projectId: string, messageId: string, chunk: string) {
    setThreads((prev) =>
      prev.map((thread) => {
        if (thread.projectId !== projectId) {
          return thread;
        }

        return {
          ...thread,
          messages: thread.messages.map((message) =>
            message.id === messageId
              ? { ...message, content: `${message.content}${chunk}` }
              : message,
          ),
        };
      }),
    );
  }

  function scrollToBottom(behavior: ScrollBehavior = "auto") {
    const viewport = messageViewportRef.current;
    if (!viewport) return;
    viewport.scrollTo({ top: viewport.scrollHeight, behavior });
  }

  function handleMessageViewportScroll() {
    const viewport = messageViewportRef.current;
    if (!viewport) return;
    const nearBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 72;
    atBottomRef.current = nearBottom;
    if (nearBottom) {
      setShowJumpToNew(false);
    }
  }

  function clearCurrentRoomHistory() {
    if (!selectedProject) return;
    setThreads((prev) =>
      prev.map((thread) =>
        thread.projectId === selectedProject.id ? { ...thread, messages: [] } : thread,
      ),
    );
    setIsAgentThinking(false);
    streamMessageIdRef.current = null;
    setShowJumpToNew(false);
  }

  useEffect(() => {
    selectedProjectIdRef.current = selectedProjectId;
  }, [selectedProjectId]);

  useEffect(() => {
    if (!bridgeEnabled) {
      return;
    }

    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      const url = `${bridgeUrl}?saleId=${encodeURIComponent(saleId)}&saleName=${encodeURIComponent(saleName)}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatusMessage("Da ket noi chat-bridge.");
        setBridgeConnected(true);
      };

      ws.onmessage = (event) => {
        let data: unknown;

        try {
          data = JSON.parse(event.data);
        } catch {
          return;
        }

        const projectId = selectedProjectIdRef.current;
        const project = projects.find((item) => item.id === projectId);
        if (!projectId || !project) {
          return;
        }

        ensureThread(project.id, project.name);

        const incoming = data as {
          type?: string;
          content?: string;
          message?: string;
          connected?: boolean;
        };

        if (incoming.type === "status") {
          setBridgeConnected(Boolean(incoming.connected));
          setStatusMessage(incoming.connected ? "Bridge online." : "Bridge offline.");
          return;
        }

        if (incoming.type === "thinking") {
          setIsAgentThinking(true);
          return;
        }

        if (incoming.type === "stream") {
          setIsAgentThinking(false);
          const streamId = streamMessageIdRef.current;
          if (!streamId) {
            const newId = createId("agent-stream");
            streamMessageIdRef.current = newId;
            pushMessage(project.id, {
              id: newId,
              role: "agent",
              content: incoming.content ?? "",
              createdAt: nowTimeLabel(),
            });
            return;
          }
          appendToMessage(project.id, streamId, incoming.content ?? "");
          return;
        }

        if (incoming.type === "system") {
          pushMessage(project.id, {
            id: createId("system"),
            role: "agent",
            content: incoming.content ?? "He thong dang xu ly.",
            createdAt: nowTimeLabel(),
          });
          return;
        }

        if (incoming.type === "error") {
          pushMessage(project.id, {
            id: createId("error"),
            role: "agent",
            content: incoming.message ?? incoming.content ?? "Co loi khi nhan phan hoi.",
            createdAt: nowTimeLabel(),
          });
          streamMessageIdRef.current = null;
          setIsAgentThinking(false);
          setSending(false);
          return;
        }

        if (incoming.type === "done") {
          streamMessageIdRef.current = null;
          setIsAgentThinking(false);
          setSending(false);
          setStatusMessage("Nhan phan hoi xong.");
        }
      };

      ws.onclose = () => {
        setBridgeConnected(false);
        setStatusMessage("Mat ket noi bridge, dang thu lai...");
        reconnectTimer = setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [bridgeEnabled, bridgeUrl, projects, saleId, saleName]);

  useEffect(() => {
    const input = composerRef.current;
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
  }, [draft]);

  useEffect(() => {
    composerRef.current?.focus();
    setTimeout(() => {
      scrollToBottom("auto");
      atBottomRef.current = true;
      setShowJumpToNew(false);
    }, 0);
  }, [selectedProjectId]);

  useEffect(() => {
    if (atBottomRef.current) {
      scrollToBottom("smooth");
      setTimeout(() => setShowJumpToNew(false), 0);
    } else {
      setTimeout(() => setShowJumpToNew(true), 0);
    }
  }, [messageCount, isAgentThinking]);

  async function handleFileUpload(files: FileList) {
    if (!files.length) return;

    const file = files[0];
    const uploadId = createId("upload");
    const uploadingFile: UploadingFile = {
      id: uploadId,
      name: file.name,
      progress: 0,
      status: "uploading",
    };

    setUploadingFiles((prev) => [...prev, uploadingFile]);

    try {
      const uploadResponse = await requestFileUploadUrl({
        content_type: file.type || "application/octet-stream",
        filename: file.name,
        owner_id: 1,
        size_bytes: file.size,
      });

      setUploadingFiles((prev) =>
        prev.map((f) => (f.id === uploadId ? { ...f, progress: 50 } : f)),
      );

      const uploadXhr = new XMLHttpRequest();
      uploadXhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          setUploadingFiles((prev) =>
            prev.map((f) =>
              f.id === uploadId ? { ...f, progress: 50 + percentComplete / 2 } : f,
            ),
          );
        }
      });

      await new Promise<void>((resolve, reject) => {
        uploadXhr.onload = () => {
          if (uploadXhr.status >= 200 && uploadXhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed with status ${uploadXhr.status}`));
          }
        };
        uploadXhr.onerror = () => reject(new Error("Upload failed"));
        uploadXhr.open("PUT", uploadResponse.upload_url);
        uploadXhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
        uploadXhr.send(file);
      });

      setUploadingFiles((prev) =>
        prev.map((f) => (f.id === uploadId ? { ...f, progress: 100, status: "confirming" } : f)),
      );

      await confirmFileUpload(uploadResponse.file_id);

      setUploadingFiles((prev) =>
        prev.map((f) => (f.id === uploadId ? { ...f, status: "done" } : f)),
      );

      setDraft((prev) => `${prev}\n[File: ${file.name} (${uploadResponse.file_id})]`.trim());

      setTimeout(() => {
        setUploadingFiles((prev) => prev.filter((f) => f.id !== uploadId));
      }, 2000);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Loi khi upload file";
      setUploadingFiles((prev) =>
        prev.map((f) => (f.id === uploadId ? { ...f, status: "error", error: errorMsg } : f)),
      );
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleSend() {
    if (!selectedProject || draft.trim().length === 0) {
      setStatusMessage("Vui long chon project va nhap noi dung.");
      return;
    }

    const content = draft.trim();
    ensureThread(selectedProject.id, selectedProject.name);

    const saleMessage: ChatMessage = {
      id: createId("sale"),
      role: "sale",
      content,
      createdAt: nowTimeLabel(),
    };

    pushMessage(selectedProject.id, saleMessage);
    setDraft("");
    setSending(true);

    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setStatusMessage("Bridge khong ket noi. Khong the gui tin nhan.");
      setSending(false);
      return;
    }

    setStatusMessage("Dang gui qua chat-bridge...");
    try {
      ws.send(
        JSON.stringify({
          type: "chat",
          content: `[Project ${selectedProject.code} - ${selectedProject.name}] ${content}`,
        }),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      pushMessage(selectedProject.id, {
        id: createId("error"),
        role: "agent",
        content: `Loi khi gui tin: ${msg}`,
        createdAt: nowTimeLabel(),
      });
      setStatusMessage("Loi khi gui tin nhan.");
      setSending(false);
    }
  }

  const roomsPanel = (
    <aside className="h-full min-h-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm md:p-3">
      <h2 className="px-1 text-sm font-semibold text-slate-800">Du an</h2>
      <p className="px-1 pt-1 text-xs text-slate-500">Moi du an la mot room rieng voi Agent.</p>

      <div className="mt-3 space-y-2 overflow-y-auto pr-1">
        {projects.map((project) => {
          const active = project.id === selectedProjectId;
          const msgCount = threads.find((thread) => thread.projectId === project.id)?.messages.length ?? 0;

          return (
            <button
              key={project.id}
              type="button"
              onClick={() => {
                ensureThread(project.id, project.name);
                setSelectedProjectId(project.id);
                setIsRoomsOpen(false);
              }}
              className={`group relative flex min-h-[52px] w-full items-center gap-3 rounded-xl border-l-2 px-3 py-2 text-left transition ${
                active
                  ? "border-l-blue-300 bg-blue-700 text-white"
                  : "border-l-transparent border-slate-200 bg-slate-50 text-slate-700 hover:border-l-blue-500 hover:bg-blue-50"
              }`}
            >
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${active ? "bg-blue-600" : "bg-white"}`}>
                🤖
              </div>
              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm font-semibold ${active ? "text-white" : "text-slate-900"}`}>
                  {project.name}
                </p>
                <p className={`truncate text-[11px] ${active ? "text-blue-100" : "text-slate-400"}`}>
                  {project.code}
                </p>
              </div>
              {msgCount > 0 ? (
                <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold ${active ? "bg-white/20 text-white" : "bg-teal-500 text-white"}`}>
                  {msgCount}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </aside>
  );

  return (
    <div className="relative h-full min-h-0">
      <div className="grid h-full min-h-0 gap-4 md:grid-cols-[200px_1fr] lg:grid-cols-[280px_1fr]">
        <div className="hidden min-h-0 md:block">{roomsPanel}</div>

        <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <header className="relative border-b border-slate-200 px-4 py-3 md:px-5">
            {sending ? <div className="absolute inset-x-0 bottom-0 h-0.5 animate-pulse bg-teal-500" /> : null}
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsRoomsOpen(true)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700 md:hidden"
                  aria-label="Mo danh sach du an"
                >
                  ☰
                </button>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100 text-lg text-teal-700">
                  🤖
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-lg font-bold text-slate-900">
                    {selectedProject ? selectedProject.name : "Chat voi Agent"}
                  </h3>
                  <p className="truncate text-xs text-slate-400">
                    {bridgeConnected ? "Chat-bridge WebSocket" : "Local fallback"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                    bridgeConnected ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                  }`}
                >
                  ● {bridgeConnected ? "Da ket noi" : "Mat ket noi"}
                </span>
                <button
                  type="button"
                  title="Xoa lich su chat"
                  onClick={clearCurrentRoomHistory}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100"
                  aria-label="Xoa lich su chat"
                >
                  🗑️
                </button>
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-400">{statusMessage}</p>
          </header>

          <div className="relative min-h-0 flex-1 bg-slate-50">
            <div
              ref={messageViewportRef}
              onScroll={handleMessageViewportScroll}
              className="h-full overflow-y-auto px-3 py-4 md:px-5"
              role="log"
              aria-live="polite"
            >
              {messageCount === 0 && !isAgentThinking ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-400">
                  <div className="text-5xl opacity-30">🤖</div>
                  <p className="font-medium text-slate-500">Bat dau cuoc tro chuyen</p>
                  <p className="text-sm">Hoi agent ve du an {selectedProject?.name ?? '...'}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {(selectedThread?.messages ?? []).map((message) => {
                    const mine = message.role === "sale";
                    return (
                      <div key={message.id} className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}>
                        {!mine ? (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-100 text-xs font-bold text-teal-700">
                            🤖
                          </div>
                        ) : null}

                        <div className={`max-w-[72%] ${mine ? "order-1" : "order-2"}`}>
                          <article
                            className={`px-4 py-2 text-sm shadow-sm ${
                              mine
                                ? "rounded-[18px_18px_4px_18px] bg-blue-600 text-white"
                                : "rounded-[18px_18px_18px_4px] border border-slate-200 bg-white text-slate-800"
                            }`}
                          >
                            {renderMessageContent(message.content, mine)}
                          </article>
                          <p className={`mt-1 text-xs text-slate-400 ${mine ? "text-right" : "text-left"}`}>
                            {mine ? "Ban" : "Agent"} • {message.createdAt}
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

                  {isAgentThinking ? (
                    <div className="flex items-end gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-100 text-xs font-bold text-teal-700">
                        🤖
                      </div>
                      <div className="flex items-center gap-1 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                        <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:0ms]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:150ms]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:300ms]" />
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            {showJumpToNew ? (
              <button
                type="button"
                onClick={() => {
                  atBottomRef.current = true;
                  setShowJumpToNew(false);
                  scrollToBottom("smooth");
                }}
                className="absolute bottom-3 right-4 rounded-full bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-lg hover:bg-blue-700"
              >
                ↓ Tin moi
              </button>
            ) : null}
          </div>

          <div className="border-t border-slate-200 bg-white px-3 py-3 md:px-5">
            {sending ? <div className="mb-2 h-0.5 animate-pulse bg-teal-500" /> : null}

            {uploadingFiles.length > 0 ? (
              <div className="mb-2 space-y-2">
                {uploadingFiles.map((file) => (
                  <div key={file.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="truncate pr-2 font-medium text-slate-700">{file.name}</span>
                      <span className="text-slate-500">
                        {file.status === "error" ? "Loi" : file.status === "done" ? "Xong" : `${Math.round(file.progress)}%`}
                      </span>
                    </div>
                    {(file.status === "uploading" || file.status === "confirming") && (
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className={`h-full transition-all ${file.status === "confirming" ? "bg-amber-500" : "bg-blue-500"}`}
                          style={{ width: `${file.progress}%` }}
                        />
                      </div>
                    )}
                    {file.error ? <p className="mt-1 text-rose-600">{file.error}</p> : null}
                  </div>
                ))}
              </div>
            ) : null}

            <div className="rounded-xl border border-slate-200 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20">
              <div className="flex items-end gap-2 p-2">
                <textarea
                  ref={composerRef}
                  rows={1}
                  value={draft}
                  disabled={sending}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      if (!sending) {
                        void handleSend();
                      }
                    }
                  }}
                  aria-label="Nhap cau hoi cho agent"
                  placeholder="Nhap cau hoi cho agent..."
                  className="min-h-[44px] max-h-[120px] w-full resize-none bg-transparent px-2 py-2 text-sm outline-none"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title="Dinh kem file"
                  disabled={sending}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-60"
                >
                  📎
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple={false}
                  disabled={sending}
                  onChange={(e) => {
                    if (e.target.files) {
                      void handleFileUpload(e.target.files);
                    }
                  }}
                  className="hidden"
                />

                <button
                  type="button"
                  disabled={sending}
                  onClick={handleSend}
                  aria-label="Gui tin nhan"
                  className="inline-flex h-9 items-center gap-1 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {sending ? (
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <span>▶</span>
                  )}
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
          <div className="absolute left-0 top-0 h-full w-[85%] max-w-sm bg-white p-3 shadow-2xl">
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="text-sm font-semibold text-slate-800">Danh sach du an</p>
              <button
                type="button"
                onClick={() => setIsRoomsOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-700"
                aria-label="Dong danh sach du an"
              >
                ✕
              </button>
            </div>
            <div className="h-[calc(100%-2.75rem)] overflow-y-auto">{roomsPanel}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
