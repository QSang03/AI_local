"use client";

import { useEffect, useState } from "react";
import { OmniInboxBoard } from "@/components/features/inbox/omni-inbox-board";
import { getOmniInboxData, getProjects } from "@/lib/api";
import { BlacklistEntry, PlatformMessage, Project } from "@/types/domain";

export default function InboxPage() {
  const [messages, setMessages] = useState<PlatformMessage[]>([]);
  const [blacklist, setBlacklist] = useState<BlacklistEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const [inboxData, projectsPaged] = await Promise.all([
          getOmniInboxData({ limit: 50, offset: 0 }),
          getProjects({ page: 1, pageSize: 200 }),
        ]);

        if (!mounted) {
          return;
        }

        setMessages(Array.isArray(inboxData.messages) ? inboxData.messages : []);
        setBlacklist(Array.isArray(inboxData.blacklist) ? inboxData.blacklist : []);
        setProjects(projectsPaged.items);
      } catch (e) {
        if (!mounted) {
          return;
        }
        setError(e instanceof Error ? e.message : "Khong tai duoc inbox data.");
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
    <div className="h-[calc(100vh-2rem)] md:h-[calc(100vh-4rem)] flex flex-col">
      {loading ? <p className="text-sm text-slate-500">Dang tai inbox...</p> : null}
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
      ) : null}
      {!loading && !error ? (
        <OmniInboxBoard
          initialMessages={messages}
          initialBlacklist={blacklist}
          projects={projects}
        />
      ) : null}
    </div>
  );
}
