"use client";

import { useEffect, useState } from "react";
import { ProjectDashboard } from "@/components/features/projects/project-dashboard";
import { PageHeader } from "@/components/ui/page-header";
import { getProjects } from "@/lib/api";
import { Project } from "@/types/domain";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const paged = await getProjects({ page: 1, pageSize: 100 });
        if (!mounted) {
          return;
        }
        setProjects(paged.items);
      } catch (e) {
        if (!mounted) {
          return;
        }
        setError(e instanceof Error ? e.message : "Khong tai duoc danh sach project.");
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
        title="Project Dashboard"
        subtitle="Tong hop project, summary AI va todo list de team sale follow ngay."
      />
      {loading ? <p className="text-sm text-slate-500">Dang tai project...</p> : null}
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
      ) : null}
      {!loading && !error ? <ProjectDashboard projects={projects} /> : null}
    </div>
  );
}
