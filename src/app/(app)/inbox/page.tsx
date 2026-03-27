"use client";

import { useEffect, useRef, useState } from "react";
import { OmniInboxBoard } from "@/components/features/inbox/omni-inbox-board";
import { getInboxConversations, getInboxMessages, getProjects } from "@/lib/api";
import { InboxConversationSummary, PlatformMessage, Project } from "@/types/domain";

export default function InboxPage() {
  const [conversations, setConversations] = useState<InboxConversationSummary[]>([]);
  const [initialMessagesByConversation, setInitialMessagesByConversation] = useState<Record<string, PlatformMessage[]>>({});
  const [initialSelectedConversationId, setInitialSelectedConversationId] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadPromiseRef = useRef<
    Promise<{
      conversations: InboxConversationSummary[];
      projects: Project[];
      selectedConversationId: string | null;
      messagesByConversation: Record<string, PlatformMessage[]>;
    }> | null
  >(null);

  useEffect(() => {
    let mounted = true;

    if (!loadPromiseRef.current) {
      loadPromiseRef.current = (async () => {
        const [conversationsRes, projectsPaged] = await Promise.all([
          getInboxConversations({ provider: "email", limit: 20, offset: 0, include_ignored: false }),
          getProjects({ page: 1, pageSize: 200 }),
        ]);

        const first20 = Array.isArray(conversationsRes.items) ? conversationsRes.items : [];
        const firstConversationId = first20[0]?.id ?? null;
        const messagesByConversation: Record<string, PlatformMessage[]> = {};
        if (firstConversationId) {
          const msgRes = await getInboxMessages({
            provider: "email",
            conversation_id: firstConversationId,
            include_ignored: false,
            limit: 20,
            offset: 0,
          });
          messagesByConversation[firstConversationId] = [...msgRes.items].sort((a, b) =>
            a.receivedAt.localeCompare(b.receivedAt),
          );
        }

        return {
          conversations: first20,
          projects: projectsPaged.items,
          selectedConversationId: firstConversationId,
          messagesByConversation,
        };
      })();
    }

    void loadPromiseRef.current
      .then((data) => {
        if (!mounted) return;
        setConversations(data.conversations);
        setProjects(data.projects);
        setInitialSelectedConversationId(data.selectedConversationId);
        setInitialMessagesByConversation(data.messagesByConversation);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : "Khong tai duoc inbox data.");
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="h-[calc(100vh-2rem)] md:h-[calc(100vh-4rem)] flex flex-col min-w-0">
      {loading ? <p className="text-sm text-slate-500">Dang tai inbox...</p> : null}
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
      ) : null}
      {!loading && !error ? (
        <OmniInboxBoard
          projects={projects}
          initialConversations={conversations}
          initialMessagesByConversation={initialMessagesByConversation}
          initialSelectedConversationId={initialSelectedConversationId}
        />
      ) : null}
    </div>
  );
}
