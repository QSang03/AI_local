"use client";

import React, { useEffect, useState } from 'react';
import { getProjectById, getProjectAIOutput, getProjectChats } from '@/lib/api';
import ProjectDetailTabs from './ProjectDetailTabs';

export default function ProjectDetailClient({ projectId }: { projectId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  type DetailData = {
    project: {
      id: string;
      name?: string;
      description?: string;
      status?: string;
      owner?: { id?: string; username?: string; name?: string };
      createdAt?: string;
      updatedAt?: string;
      raw: { todoList?: string[] } | unknown;
    };
    ai?: { todoList?: string[]; summary?: string };
    chats: Array<{ messages?: Array<{ id: string; role?: string; content?: string; createdAt?: string }> }>;
  } | null;
  const [data, setData] = useState<DetailData>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [proj, ai, chats] = await Promise.all([
          getProjectById(projectId),
          getProjectAIOutput(String(projectId)),
          getProjectChats(),
        ]);
        if (!mounted) return;
        const projectChats = (chats || []).filter((t) => String(t.projectId) === String(projectId));
        const rawProj = proj as unknown as Record<string, unknown>;
        const ownerId = proj.ownerId ?? String(rawProj.owner_id ?? '');
        const owner = {
          id: ownerId,
          username: proj.ownerName ?? '',
          name: proj.ownerName ?? '',
        };
        const createdAt = rawProj.created_at as string | undefined ?? (proj as unknown as { createdAt?: string }).createdAt ?? '';
        const updatedAt = rawProj.updated_at as string | undefined ?? (proj as unknown as { updatedAt?: string }).updatedAt ?? '';
        setData({
          project: {
            id: String(proj.id),
            name: proj.name,
            description: proj.description,
            status: proj.status,
            owner,
            createdAt,
            updatedAt,
            raw: proj,
          },
          ai,
          chats: projectChats,
        });
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Load failed');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    if (projectId) load();
    return () => { mounted = false; };
  }, [projectId]);

  if (loading) return <div className="p-6">Loading…</div>;
  if (error) return <div className="p-6"><h2 className="text-lg font-semibold">{error}</h2><p className="text-sm text-gray-600 mt-2">You may need to login or be the project owner to view details.</p></div>;
  if (!data) return <div className="p-6">No data</div>;

  return <ProjectDetailTabs {...data} />;
}
