"use client";

import { useCallback, useEffect, useState } from "react";
import { ProjectChatPanel } from "@/components/features/chat/project-chat-panel";
import { PageHeader } from "@/components/ui/page-header";
import { getChatSessions, ChatSession } from "@/lib/api";

export default function ChatPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshChatData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sessionsRes = await getChatSessions({ limit: 200, offset: 0 });
      setSessions(sessionsRes ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Khong tai duoc du lieu chat.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshChatData();
  }, [refreshChatData]);

  return (
    <div className="flex h-[calc(100vh-5.5rem)] min-h-[620px] flex-col gap-4">
      <PageHeader
        title="Chat voi Agent"
        subtitle="Tro chuyen voi AI Agent theo tung du an"
      />
      {loading ? <p className="text-sm text-slate-500">Dang tai chat...</p> : null}
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div> : null}
      {!loading && !error ? (
        <div className="min-h-0 flex-1">
          <ProjectChatPanel sessions={sessions} />
        </div>
      ) : null}
    </div>
  );
}
