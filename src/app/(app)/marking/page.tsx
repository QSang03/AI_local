"use client";

import { useEffect, useState } from "react";
import { MarkingBoard } from "@/components/features/marking/marking-board";
import { PageHeader } from "@/components/ui/page-header";
import { getProjects, getThreads } from "@/lib/api";
import { MessageThread, Project } from "@/types/domain";

export default function MarkingPage() {
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const [threadData, projectsPaged] = await Promise.all([
          getThreads(),
          getProjects({ page: 1, pageSize: 200 }),
        ]);

        if (!mounted) {
          return;
        }

        setThreads(threadData);
        setProjects(projectsPaged.items);
      } catch (e) {
        if (!mounted) {
          return;
        }
        setError(e instanceof Error ? e.message : "Khong tai duoc du lieu marking.");
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marking Message vao Project"
        subtitle="Chon email/chat thread va gan vao dung project, ho tro multi-select cho chat cum tin."
      />
      {loading ? <p className="text-sm text-slate-500">Dang tai du lieu marking...</p> : null}
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
      ) : null}
      {!loading && !error ? <MarkingBoard threads={threads} projects={projects} /> : null}
    </div>
  );
}
