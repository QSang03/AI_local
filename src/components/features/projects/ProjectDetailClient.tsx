'use client';

import React, { useEffect, useState } from 'react';
import { 
  getProjectById, 
  getProjectAIOutput, 
  getProjectChats, 
  getProjectSummariesList, 
  getProjectMessagesList,
  ProjectSummaryResponse
} from '@/lib/api';
import { Project, PlatformMessage, ProjectChatThread } from '@/types/domain';
import ProjectDetailTabs from './ProjectDetailTabs';

// --- Types ---

interface ProjectOwner {
  id: string;
  username: string;
  name: string;
}

interface ProjectData {
  id: string;
  name: string;
  description?: string;
  status: string;
  owner: ProjectOwner;
  createdAt: string;
  updatedAt: string;
  raw: Project;
}

interface PageData {
  project: ProjectData;
  ai: {
    todoList?: string[];
    summary?: string;
  };
  chats: ProjectChatThread[];
  summaries: ProjectSummaryResponse[];
  messages: PlatformMessage[];
}

// --- Loading Component ---

function Loader() {
  return (
    <div className="flex justify-center items-center py-12 h-screen">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600"></div>
    </div>
  );
}

// --- Main Data Fetching Component ---

export default function ProjectDetailClient({ projectId }: { projectId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PageData | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [proj, ai, chats, summariesData, messagesData] = await Promise.all([
          getProjectById(projectId),
          getProjectAIOutput(String(projectId)),
          getProjectChats(),
          getProjectSummariesList(projectId),
          getProjectMessagesList(projectId),
        ]);
        if (!mounted) return;
        const projectChats = (chats || []).filter((t: ProjectChatThread) => String(t.projectId) === String(projectId));
        const rawProj = proj as unknown as Record<string, unknown>;
        
        // Read owner directly from API response's owner object
        const rawOwner = rawProj.owner as Record<string, unknown> | undefined;
        const ownerId = rawOwner?.id ? String(rawOwner.id) : String(rawProj.owner_id ?? '');
        const ownerUsername = String(rawOwner?.username ?? rawOwner?.name ?? proj.ownerName ?? '');
        const owner: ProjectOwner = {
          id: ownerId,
          username: ownerUsername,
          name: ownerUsername,
        };
        const createdAt = String(rawProj.created_at ?? rawProj.createdAt ?? proj.lastUpdateAt ?? new Date().toISOString());
        const updatedAt = String(rawProj.updated_at ?? rawProj.updatedAt ?? proj.lastUpdateAt ?? new Date().toISOString());
        
        setData({
          project: {
            id: String(proj.id),
            name: proj.name || 'Untitled Project',
            description: proj.description,
            status: proj.status || 'Active',
            owner,
            createdAt,
            updatedAt,
            raw: proj,
          },
          ai,
          chats: projectChats,
          summaries: (summariesData as ProjectSummaryResponse[]) || [],
          messages: (messagesData as PlatformMessage[]) || [],
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

  if (loading) return <div className="min-h-screen bg-slate-50 font-sans text-slate-900"><Loader /></div>;
  if (error) return (
    <div className="min-h-screen bg-slate-50 font-sans p-6">
      <h2 className="text-lg font-semibold text-red-600">{error}</h2>
      <p className="text-sm text-slate-600 mt-2">You may need to login or be the project owner to view details.</p>
    </div>
  );
  if (!data) return <div className="min-h-screen bg-slate-50 font-sans p-6">No data</div>;

  return <ProjectDetailView data={data} />;
}

// --- View Component ---

function ProjectDetailView({ data }: { data: PageData }) {
  return (
    <ProjectDetailTabs
      project={data.project}
      ai={data.ai}
      chats={data.chats}
      summaries={data.summaries}
      messagesList={data.messages}
    />
  );
}
