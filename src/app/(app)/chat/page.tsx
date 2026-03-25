"use client";

import { useEffect, useState } from "react";
import { ProjectChatPanel } from "@/components/features/chat/project-chat-panel";
import { PageHeader } from "@/components/ui/page-header";
import { getProjectChats, getProjects } from "@/lib/api";
import { Project, ProjectChatThread } from "@/types/domain";

export default function ChatPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [threads, setThreads] = useState<ProjectChatThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [projectsPaged, chats] = await Promise.all([
          getProjects({ page: 1, pageSize: 200 }),
          getProjectChats(),
        ]);
        if (!mounted) return;
        setProjects(projectsPaged.items ?? []);
        setThreads(chats ?? []);
      } catch (e) {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : "Khong tai duoc du lieu chat.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, []);

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
          <ProjectChatPanel projects={projects} initialThreads={threads} />
        </div>
      ) : null}
    </div>
  );
}
