import React from 'react';
import ProjectDetailClient from '@/components/features/projects/ProjectDetailClient';

interface Props {
  params: Promise<{ id: string }> | { id: string };
}

export default async function ProjectDetailPage({ params }: Props) {
  const { id } = await params;
  if (!id) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold">Missing project id</h1>
      </div>
    );
  }

  // Use client-side fetch so browser credentials (cookie/Authorization) are sent
  return (
    <div className="p-6">
      <ProjectDetailClient projectId={String(id)} />
    </div>
  );
}
