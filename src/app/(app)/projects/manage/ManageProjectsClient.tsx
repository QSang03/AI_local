"use client";

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { Project } from '@/types/domain';
import Toast from '@/components/ui/Toast';
import { updateProject, getProjects, getOwners, deleteProject } from '@/lib/api';
import EditProjectForm from '@/components/features/projects/EditProjectForm';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import CreateProjectModal from '@/components/features/projects/CreateProjectModal';




export default function ManageProjectsClient({ initialProjects }: { initialProjects: Project[] }) {
  const [projects, setProjects] = useState<Project[]>(initialProjects || []);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [ownerFilterId, setOwnerFilterId] = useState<string>("");
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);
  const [showCreate, setShowCreate] = useState(false);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Project | null>(null);
  const [toastMessage, setToastMessage] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | number | null>(null);
  const [ownerQuery, setOwnerQuery] = useState('');
  const [ownerSuggestions, setOwnerSuggestions] = useState<Array<{ id: string; name: string }>>([]);
  const [globalAnnounce, setGlobalAnnounce] = useState<string | undefined>(undefined);
  const [total, setTotal] = useState(initialProjects?.length ?? 0);
  const [loadingPage, setLoadingPage] = useState(false);

  // owners derived from projects kept intentionally; suggestions are fetched via getOwners

  const totalPages = Math.max(1, Math.ceil(total / rowsPerPage));
  const pageItems = projects;
  const prevPageRef = useRef<number>(page);
  useEffect(() => {
    let mounted = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const doFetch = async (pg: number) => {
      setLoadingPage(true);
      try {
        let ownerIdToUse = ownerFilterId;
        if (!ownerIdToUse && ownerQuery.trim()) {
          try {
            const ownersRes = await getOwners({ q: ownerQuery.trim(), page: 1, pageSize: 1 });
            if (ownersRes && ownersRes.items && ownersRes.items.length > 0) {
              ownerIdToUse = ownersRes.items[0].id;
            }
          } catch {
            // ignore owner lookup failure
          }
        }

        const paged = await getProjects({ page: pg, pageSize: rowsPerPage, q: search, ownerId: ownerIdToUse });
        if (!mounted) return;
        let items = paged.items;
        if (statusFilter) items = items.filter((it) => it.status === statusFilter);
        setProjects(items);
        setTotal(paged.total);
        setOwnerFilterId(ownerIdToUse || "");
      } catch {
        if (!mounted) return;
        setToastMessage('Load failed');
        setGlobalAnnounce('Load failed');
      } finally {
        if (mounted) setLoadingPage(false);
      }
    };

    // If page changed (user clicked Prev/Next), fetch immediately
    if (page !== prevPageRef.current) {
      prevPageRef.current = page;
      void doFetch(page);
    } else {
      // debounce filter changes
      timer = setTimeout(() => void doFetch(page), 350);
    }

    return () => {
      mounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [search, statusFilter, ownerFilterId, ownerQuery, rowsPerPage, page]);

  

  // owner autocomplete
  useEffect(() => {
    const q = ownerQuery.trim();
    if (q.length === 0) {
      setOwnerSuggestions([]);
      return;
    }
    let mounted = true;
    const t = setTimeout(() => {
      void (async () => {
        try {
          const res = await getOwners({ q, page: 1, pageSize: 6 });
          if (!mounted) return;
          setOwnerSuggestions(res.items.map((i) => ({ id: i.id, name: i.name })));
        } catch {
          // swallow
        }
      })();
    }, 250);

    return () => {
      mounted = false;
      clearTimeout(t);
    };
  }, [ownerQuery]);

  async function handleSave(updated: Project) {
    setSaving(true);
    try {
      // Simple client-side validation
      if (!updated.name || updated.name.trim().length === 0) throw new Error('Name required');
      if (updated.name.length > 200) throw new Error('Name too long');

      const res = await updateProject(updated.id, {
        name: updated.name,
        description: (updated as unknown as { description?: string }).description,
        status: updated.status,
      });
      // If API returns updated project, use it; otherwise merge
      if (res && typeof res === 'object' && 'id' in res) {
        const updatedProject = res as Project;
        setProjects((prev) => prev.map((p) => (p.id === updated.id ? updatedProject : p)));
      } else {
        setProjects((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
      }
      setToastMessage('Project updated');
      setGlobalAnnounce('Project updated');
      setEditing(null);
    } catch {
      setToastMessage('Update failed');
      setGlobalAnnounce('Update failed');
    } finally {
      setSaving(false);
    }
  }

  function getStatusBadgeClass(status?: string) {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'urgent':
      case 'pending':
        return 'bg-amber-100 text-amber-800';
      case 'closed':
        return 'bg-gray-100 text-gray-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  }

  function relativeTime(dt: string | undefined) {
    if (!dt) return '-';
    try {
      const d = new Date(dt);
      const diff = Date.now() - d.getTime();
      const sec = Math.floor(diff / 1000);
      if (sec < 60) return `${sec}s ago`;
      const min = Math.floor(sec / 60);
      if (min < 60) return `${min}m ago`;
      const hr = Math.floor(min / 60);
      if (hr < 24) return `${hr}h ago`;
      const days = Math.floor(hr / 24);
      return `${days}d ago`;
    } catch {
      return dt;
    }
  }

  async function handleDelete(projectId: string | number) {
    try {
      await deleteProject(projectId);
      // refetch current page after delete
      const paged = await getProjects({ page, pageSize: rowsPerPage });
      setProjects(paged.items);
      setTotal(paged.total);
      setToastMessage('Deleted');
      setGlobalAnnounce('Project deleted');
    } catch {
      setToastMessage('Delete failed');
      setGlobalAnnounce('Delete failed');
    } finally {
      setConfirmDeleteId(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900">Manage Projects</h1>
          <div className="text-sm text-gray-600 rounded-full bg-gray-50 px-3 py-1">Total: {total}</div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
            aria-label="Create new project"
          >
            + New Project
          </button>
        </div>
      </div>

      {/* Toolbar: search + filters */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3 w-full md:w-2/3">
          <div className="relative w-full">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or code"
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
              disabled={loadingPage}
              aria-label="Search projects"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
            disabled={loadingPage}
            aria-label="Filter by status"
          >
            <option value="">All status</option>
            <option value="new">New</option>
            <option value="active">Active</option>
            <option value="urgent">Urgent</option>
            <option value="closed">Closed</option>
          </select>

          <div className="relative">
            <input
              placeholder="Filter by owner"
              value={ownerQuery}
              onChange={(e) => {
                setOwnerQuery(e.target.value);
                // clear selected owner id when typing
                setOwnerFilterId("");
              }}
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
              disabled={loadingPage}
              aria-label="Filter by owner"
            />
            {ownerSuggestions.length > 0 && (
              <ul className="absolute left-0 right-0 z-20 mt-1 max-h-40 overflow-auto rounded border bg-white">
                {ownerSuggestions.map((s) => (
                  <li
                    key={s.id}
                    onClick={() => {
                      setOwnerQuery(s.name);
                      setOwnerFilterId(s.id);
                      setOwnerSuggestions([]);
                    }}
                    className="cursor-pointer px-3 py-2 hover:bg-slate-100"
                  >
                    {s.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {loadingPage ? <div className="text-sm text-gray-500">Loading…</div> : null}
          <button
            onClick={() => {
              setSearch("");
              setStatusFilter("");
              setOwnerFilterId("");
              setOwnerQuery("");
              setPage(1);
            }}
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
            aria-label="Clear filters"
            disabled={loadingPage}
          >
            Clear
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full table-auto text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr className="text-left text-xs text-gray-500 uppercase tracking-wider">
                <th className="px-3 py-3 w-16 text-center">No.</th>
                <th className="px-3 py-3">Name</th>
                <th className="px-3 py-3">Owner</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Updated</th>
                <th className="px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loadingPage ? (
                // skeleton rows
                Array.from({ length: rowsPerPage }).map((_, i) => (
                  <tr key={i} className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} animate-pulse`}>
                    <td className="px-3 py-4 text-center">&nbsp;</td>
                    <td className="px-3 py-4"><div className="h-4 w-3/4 rounded bg-gray-200" /></td>
                    <td className="px-3 py-4"><div className="h-4 w-1/2 rounded bg-gray-200" /></td>
                    <td className="px-3 py-4"><div className="h-4 w-20 rounded bg-gray-200" /></td>
                    <td className="px-3 py-4"><div className="h-4 w-24 rounded bg-gray-200" /></td>
                    <td className="px-3 py-4 text-right"><div className="h-6 w-16 rounded bg-gray-200 inline-block" /></td>
                  </tr>
                ))
              ) : pageItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">
                    No projects found. Create your first project!
                  </td>
                </tr>
              ) : (
                pageItems.map((p, idx) => {
                  const rowClass = idx % 2 === 0 ? 'bg-white' : 'bg-gray-50';
                  const ownerName = typeof p.ownerName === 'string' ? p.ownerName : '';
                  const initials = ownerName ? ownerName.split(' ').map((s) => s[0]).join('').slice(0,2).toUpperCase() : 'U';
                    const displayIndex = (page - 1) * rowsPerPage + idx + 1;
                  return (
                    <tr key={p.id} className={`${rowClass} hover:bg-gray-100`}>
                        <td className="px-3 py-3 text-center align-middle text-xs font-medium">{displayIndex}</td>
                      <td className="px-3 py-3 align-middle">
                        {(!p.id || String(p.id).startsWith('temp-')) ? (
                          <button title={p.id ? `Temp project (id: ${p.id})` : 'Temp project'} onClick={() => setEditing(p)} className="text-indigo-600 font-semibold hover:underline">
                            {p.name}
                          </button>
                        ) : (
                          <Link title={`Project ID: ${p.id}`} href={`/projects/${p.id}`} className="text-indigo-600 font-semibold hover:underline">{p.name}</Link>
                        )}
                      </td>
                      <td className="px-3 py-3 align-middle">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 flex flex-shrink-0 items-center justify-center rounded-full bg-gray-200 text-sm font-semibold text-gray-700 leading-none">
                            {initials}
                          </div>
                          <div className="text-sm text-gray-700">{ownerName}</div>
                        </div>
                      </td>
                      <td className="px-3 py-3 align-middle">
                        <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${getStatusBadgeClass(p.status)}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 align-middle text-sm text-gray-600">{relativeTime(p.lastUpdateAt)}</td>
                      <td className="px-3 py-3 align-middle text-right">
                        <div className="relative inline-block text-left">
                          <button onClick={() => setEditing(p)} title="Edit" aria-label={`Edit ${p.name}`} className="rounded bg-slate-100 px-2 py-1 text-xs mr-2">✎</button>
                          <button onClick={() => setConfirmDeleteId(p.id)} title="Delete" aria-label={`Delete ${p.name}`} className="rounded bg-rose-50 px-2 py-1 text-xs">🗑</button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="text-xs text-gray-600">Page {page} of {totalPages}</div>
          <div className="flex items-center gap-3">
            <select value={rowsPerPage} onChange={(e) => { setRowsPerPage(Number(e.target.value)); setPage(1); }} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm" aria-label="Rows per page">
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
            <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded px-3 py-1 bg-white border disabled:opacity-50">Prev</button>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="rounded px-3 py-1 bg-white border disabled:opacity-50">Next</button>
          </div>
        </div>
      </div>

      {editing ? (
        // Side Drawer
        <div className={`fixed inset-0 z-60 flex`} aria-hidden={!editing}>
          <div className={`absolute inset-0 bg-black/40`} onClick={() => setEditing(null)} />
          <aside
            className={`fixed right-0 top-0 h-full w-full sm:w-3/4 md:w-1/2 lg:w-1/3 bg-white shadow-2xl transform transition-transform duration-200 ${editing ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-project-title"
            onKeyDown={(e) => {
              if (e.key === 'Escape') setEditing(null);
              if (e.key === 'Tab') {
                const el = e.currentTarget as HTMLElement;
                const nodes = Array.from(el.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])')).filter(x => !x.hasAttribute('disabled'));
                if (nodes.length === 0) return;
                const first = nodes[0];
                const last = nodes[nodes.length - 1];
                if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
                else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
              }
            }}
          >
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b px-6 py-4">
                <h3 id="edit-project-title" className="text-lg font-semibold">Edit Project</h3>
                <button aria-label="Close drawer" onClick={() => setEditing(null)} className="text-slate-600">✕</button>
              </div>
              <div className="flex-1 overflow-auto p-6">
                <EditProjectForm project={editing} onCancel={() => setEditing(null)} onSave={async (data: Project) => { await handleSave(data); }} loading={saving} />
              </div>
              <div className="border-t px-6 py-3 text-sm text-gray-600">
                Last updated by {editing?.ownerName || 'N/A'} at {editing?.lastUpdateAt || '-'}
              </div>
            </div>
          </aside>
        </div>
      ) : null}
      {toastMessage ? <Toast message={toastMessage} onClose={() => setToastMessage(undefined)} /> : null}

      <ConfirmationModal open={!!confirmDeleteId} title="Xác nhận xóa" description="Bạn có chắc muốn xóa project này? Hành động không thể hoàn tác." confirmLabel="Xóa" cancelLabel="Hủy" onConfirm={() => { if (confirmDeleteId) void handleDelete(confirmDeleteId); }} onCancel={() => setConfirmDeleteId(null)} />

      <CreateProjectModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onOptimisticCreated={(temp) => {
          setProjects((prev) => [temp, ...prev]);
          setTotal((t) => t + 1);
        }}
        onCreated={(p, tempId) => {
          // If we have a tempId, replace the temp entry with the server project
          if (tempId) {
            setProjects((prev) => prev.map((it) => (it.id === tempId ? p : it)));
          } else if (p && p.id) {
            // no temp: just add
            setProjects((prev) => [p, ...prev]);
            setTotal((t) => t + 1);
          } else {
            void (async () => { const paged = await getProjects({ page: 1, pageSize: rowsPerPage }); setProjects(paged.items); setTotal(paged.total); setPage(1); })();
          }
          setShowCreate(false);
          setToastMessage('Project created');
        }}
        onCreateFailed={(tempId) => {
          // remove temp entry
          setProjects((prev) => prev.filter((it) => it.id !== tempId));
          setTotal((t) => Math.max(0, t - 1));
          setToastMessage('Create failed');
        }}
        onAnnounce={(m) => setGlobalAnnounce(m)}
      />

      <div aria-live="assertive" className="sr-only">{globalAnnounce}</div>
    </div>
  );
}
