"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Project } from "@/types/domain";
import { getProjectAIOutput } from "@/lib/api";
import { createProject, deleteProject, getProjects } from "@/lib/api";
import { StatusPill } from "@/components/ui/status-pill";

interface ProjectDashboardProps {
  projects: Project[];
}

function statusToTone(
  status: Project["status"],
): { tone: "neutral" | "success" | "warning" | "danger"; label: string } {
  if (status === "active") return { tone: "success", label: "active" };
  if (status === "urgent") return { tone: "danger", label: "urgent" };
  if (status === "closed") return { tone: "neutral", label: "closed" };
  return { tone: "warning", label: "new" };
}

export function ProjectDashboard({ projects }: ProjectDashboardProps) {
  const [statusFilter, setStatusFilter] = useState<Project["status"] | "all">("all");
  const [query, setQuery] = useState("");
  const [localProjects, setLocalProjects] = useState<Project[]>(projects);
  const [loadingAiMap, setLoadingAiMap] = useState<Record<string, boolean>>({});
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);

  const stats = useMemo(() => {
    return {
      total: localProjects.length,
      urgent: localProjects.filter((project) => project.status === "urgent").length,
      active: localProjects.filter((project) => project.status === "active").length,
      unread: localProjects.reduce((sum, project) => sum + project.unreadCount, 0),
    };
  }, [localProjects]);

  const filteredProjects = useMemo(() => {
    const keyword = query.trim().toLowerCase();

    return localProjects.filter((project) => {
      const matchStatus = statusFilter === "all" || project.status === statusFilter;
      const matchKeyword =
        keyword.length === 0 ||
        project.name.toLowerCase().includes(keyword) ||
        project.code.toLowerCase().includes(keyword) ||
        project.ownerName.toLowerCase().includes(keyword);

      return matchStatus && matchKeyword;
    });
  }, [localProjects, query, statusFilter]);


  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Tong project
          </p>
          <p className="mt-1 text-2xl font-black text-slate-900">{stats.total}</p>
        </article>
        <article className="rounded-2xl border border-rose-200 bg-rose-50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">
            Urgent
          </p>
          <p className="mt-1 text-2xl font-black text-rose-800">{stats.urgent}</p>
        </article>
        <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            Active
          </p>
          <p className="mt-1 text-2xl font-black text-emerald-800">{stats.active}</p>
        </article>
        <article className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
            Unread message
          </p>
          <p className="mt-1 text-2xl font-black text-amber-800">{stats.unread}</p>
        </article>
      </section>

      <div className="flex items-center justify-between">
        <div />
        <div>
          <button
            type="button"
            onClick={() => setShowNew((s) => !s)}
            className="rounded-xl bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-700"
          >
            {showNew ? "Cancel" : "New Project"}
          </button>
        </div>
      </div>

      {showNew ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setCreating(true);
              try {
                const res = await createProject({ name: newName, description: newDesc });
                // If backend returned created Project object, push optimistically
                if (res && typeof res === 'object' && 'id' in res) {
                  const created = res as Project;
                  setLocalProjects((prev) => [created, ...prev]);
                } else {
                  // fallback: refetch a reasonable page size
                  try {
                    const paged = await getProjects({ page: 1, pageSize: 100 });
                    setLocalProjects(paged.items);
                  } catch {
                    // swallow
                  }
                }
                setNewName("");
                setNewDesc("");
                setShowNew(false);
              } catch (err) {
                // TODO: show toast
              } finally {
                setCreating(false);
              }
            }}
          >
            <div className="grid gap-2 md:grid-cols-2">
              <input
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Project name"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none"
              />
              <input
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Description (optional)"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none"
              />
            </div>
            <div className="mt-3 flex justify-end">
              <button
                type="submit"
                disabled={creating}
                className="rounded-xl bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {creating ? "Creating..." : "Create Project"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          {["all", "new", "active", "urgent", "closed"].map((status) => {
            const isActive = statusFilter === status;
            return (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status as Project["status"] | "all")}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                  isActive
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {status}
              </button>
            );
          })}
        </div>

        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Tim theo ma du an, ten, owner"
          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-700 md:max-w-xs"
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {filteredProjects.map((project) => {
          const status = statusToTone(project.status);

          return (
            <article
              key={project.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {project.code}
                  </p>
                  <h2 className="text-lg font-bold text-slate-900">{project.name}</h2>
                </div>
                <StatusPill label={status.label} tone={status.tone} />
              </div>

              <p className="text-sm text-slate-600">Owner: {project.ownerName}</p>
              <p className="mt-2 text-sm text-slate-700">{project.summary}</p>

              <div className="mt-4 rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  AI Todo
                </p>
                <ul className="mt-2 space-y-1 text-sm text-slate-700">
                  {project.todoList.map((item) => (
                    <li key={item}>- {item}</li>
                  ))}
                </ul>
              </div>

              <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                <span>Cap nhat: {project.lastUpdateAt}</span>
                <span>{project.unreadCount} unread</span>
              </div>

              <div className="mt-3">
                <div className="flex gap-2">
                  <Link
                    href="/chat"
                    className="inline-flex rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
                  >
                    Mo chat voi agent
                  </Link>
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = window.confirm(`Xác nhận xóa project \"${project.name}\"?`);
                      if (!ok) return;
                      try {
                        await deleteProject(project.id);
                        setLocalProjects((prev) => prev.filter((p) => p.id !== project.id));
                      } catch (e) {
                        // swallow or show toast
                      }
                    }}
                    className="inline-flex items-center rounded-xl bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                  >
                    Xoa
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(loadingAiMap[project.id])}
                    onClick={async () => {
                      setLoadingAiMap((m) => ({ ...m, [project.id]: true }));
                      try {
                        const res = await getProjectAIOutput(project.id);
                        setLocalProjects((prev) => prev.map((p) => (p.id === project.id ? { ...p, summary: res.summary, todoList: res.todoList } : p)));
                      } catch (e) {
                        // swallow - UI could show toast
                      } finally {
                        setLoadingAiMap((m) => ({ ...m, [project.id]: false }));
                      }
                    }}
                    className="inline-flex items-center rounded-xl bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white transition disabled:opacity-60"
                  >
                    {loadingAiMap[project.id] ? "Refreshing..." : "Refresh AI"}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {filteredProjects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">
          Khong co project phu hop voi bo loc hien tai.
        </div>
      ) : null}
    </div>
  );
}
