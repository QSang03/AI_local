"use client";

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { Project } from '@/types/domain';
import Toast from '@/components/ui/Toast';
import { updateProject, getProjects, getOwners, deleteProject } from '@/lib/api';
import EditProjectForm from '@/components/features/projects/EditProjectForm';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import CreateProjectModal from '@/components/features/projects/CreateProjectModal';
import { Search, Plus, Edit2, Trash2, ChevronDown, X, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';




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
  const [viewMode, setViewMode] = useState<'card' | 'table'>('table');
  const [total, setTotal] = useState(initialProjects?.length ?? 0);
  const [loadingPage, setLoadingPage] = useState(false);
  
  // Derive whether any filters are active
  const hasActiveFilters = search.trim() !== '' || statusFilter !== '' || ownerFilterId !== '';
  
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
        return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
      case 'urgent':
      case 'pending':
        return 'bg-amber-100 text-amber-700 border border-amber-200';
      case 'closed':
        return 'bg-slate-100 text-slate-700 border border-slate-200';
      case 'new':
        return 'bg-blue-100 text-blue-700 border border-blue-200';
      default:
        return 'bg-slate-100 text-slate-700 border border-slate-200';
    }
  }

  function getStatusColor(status?: string): string {
    switch (status) {
      case 'active': return '#10b981';
      case 'urgent': case 'pending': return '#f59e0b';
      case 'closed': return '#64748b';
      case 'new': return '#3b82f6';
      default: return '#64748b';
    }
  }

  function getStatusDot(status?: string) {
    const colors = {
      'active': 'bg-emerald-500',
      'urgent': 'bg-amber-500',
      'pending': 'bg-amber-500',
      'closed': 'bg-slate-400',
      'new': 'bg-blue-500',
    };
    return colors[status as keyof typeof colors] || 'bg-slate-400';
  }

  function relativeTime(dt: string | undefined) {
    if (!dt) return '-';
    try {
      return formatDistanceToNow(new Date(dt), { addSuffix: true });
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
    <div className="space-y-6 px-2 py-6 md:px-6">
      {/* Page Header */}
      <div className="flex flex-col items-start justify-between gap-4 xs:flex-row xs:items-center">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-slate-800">Projects</h1>
          <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
            {total} project{total !== 1 ? 's' : ''}
          </span>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-white font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
          aria-label="Create new project"
        >
          <Plus size={18} />
          <span>New Project</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:flex md:items-center md:gap-3 md:space-y-0">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or code..."
            className="w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 py-2 text-sm placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
            disabled={loadingPage}
            aria-label="Search projects"
          />
        </div>

        {/* Status Filter - Custom Dropdown */}
        <div className="relative flex-shrink-0">
          <div className="relative group">
            <button
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loadingPage}
              aria-label="Filter by status"
            >
              <span className={`h-2 w-2 rounded-full ${statusFilter ? getStatusDot(statusFilter) : 'bg-slate-300'}`} />
              {statusFilter ? statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1) : 'All Status'}
              <ChevronDown size={16} />
            </button>
            <div className="absolute right-0 top-full z-20 mt-1 hidden rounded-lg border border-slate-200 bg-white shadow-lg group-hover:block">
              {['All Status', 'new', 'active', 'urgent', 'closed'].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status === 'All Status' ? '' : status)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-sm text-left hover:bg-slate-100 first:rounded-t-lg last:rounded-b-lg transition-colors ${
                    (status === 'All Status' ? statusFilter === '' : statusFilter === status) ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700'
                  }`}
                >
                  {status !== 'All Status' && <span className={`h-2 w-2 rounded-full ${getStatusDot(status)}`} />}
                  {status}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Owner Filter */}
        <div className="relative flex-shrink-0">
          <input
            placeholder="Filter by owner"
            value={ownerQuery}
            onChange={(e) => {
              setOwnerQuery(e.target.value);
              setOwnerFilterId("");
            }}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed md:w-48"
            disabled={loadingPage}
            aria-label="Filter by owner"
          />
          {ownerSuggestions.length > 0 && (
            <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-40 overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
              {ownerSuggestions.map((s) => (
                <li
                  key={s.id}
                  onClick={() => {
                    setOwnerQuery(s.name);
                    setOwnerFilterId(s.id);
                    setOwnerSuggestions([]);
                  }}
                  className="cursor-pointer px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 first:rounded-t-lg last:rounded-b-lg transition-colors"
                >
                  {s.name}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Clear Filters & View Toggle */}
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <button
              onClick={() => {
                setSearch("");
                setStatusFilter("");
                setOwnerFilterId("");
                setOwnerQuery("");
                setPage(1);
              }}
              className="text-sm text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
              aria-label="Clear filters"
              disabled={loadingPage}
            >
              Clear
            </button>
          )}
          {loadingPage && <span className="text-xs text-slate-500">Loading…</span>}
        </div>
      </div>

      {/* View Toggle & Content */}
      <div className="space-y-4">
        {/* View Toggle */}
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setViewMode('card')}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              viewMode === 'card'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
            aria-label="Card view"
          >
            Card
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              viewMode === 'table'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
            aria-label="Table view"
          >
            Table
          </button>
        </div>

        {/* Card View */}
        {viewMode === 'card' && (
          <div>
            {loadingPage ? (
              <div className="grid gap-4 md:grid-cols-2">
                {Array.from({ length: rowsPerPage }).map((_, i) => (
                  <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm animate-pulse">
                    <div className="mb-3 flex items-start justify-between">
                      <div className="h-6 w-2/3 rounded bg-slate-200" />
                      <div className="h-6 w-16 rounded bg-slate-200" />
                    </div>
                    <div className="mb-3 h-4 w-1/2 rounded bg-slate-200" />
                    <div className="h-4 w-full rounded bg-slate-200" />
                  </div>
                ))}
              </div>
            ) : pageItems.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 py-12 text-center">
                <p className="text-slate-500">No projects found. Create your first project!</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {pageItems.map((p) => {
                  const ownerName = typeof p.ownerName === 'string' ? p.ownerName : '';
                  const initials = ownerName
                    ? ownerName
                        .split(' ')
                        .map((s) => s[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase()
                    : 'U';

                  return (
                    <div
                      key={p.id}
                      className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-indigo-200 hover:shadow-md transition-all"
                    >
                      {/* Header */}
                      <div className="mb-3 flex items-start justify-between gap-2">
                        <Link
                          href={`/projects/${p.id}`}
                          className="flex-1 text-base font-semibold text-indigo-700 hover:text-indigo-800 line-clamp-2 transition-colors"
                        >
                          {p.name}
                        </Link>
                        <span
                          className={`flex-shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusBadgeClass(
                            p.status
                          )}`}
                        >
                          {p.status}
                        </span>
                      </div>

                      {/* Owner */}
                      <div className="mb-3 flex items-center gap-2">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
                          {initials}
                        </div>
                        <span className="text-sm text-slate-700">{ownerName || 'Unassigned'}</span>
                      </div>

                      {/* Description */}
                      {p.description && (
                        <p className="mb-3 text-sm text-slate-600 line-clamp-2">
                          {typeof p.description === 'string' ? p.description : ''}
                        </p>
                      )}

                      {/* Footer */}
                      <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                        <span className="text-xs text-slate-500">{relativeTime(p.lastUpdateAt)}</span>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setEditing(p)}
                            className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                            title="Edit"
                            aria-label={`Edit ${p.name}`}
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(p.id)}
                            className="rounded-lg p-1.5 text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors"
                            title="Delete"
                            aria-label={`Delete ${p.name}`}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Table View */}
        {viewMode === 'table' && (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr className="text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Owner</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Updated</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {loadingPage ? (
                    Array.from({ length: rowsPerPage }).map((_, i) => (
                      <tr key={i} className="animate-pulse hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="h-4 w-8 rounded bg-slate-200" />
                        </td>
                        <td className="px-4 py-3">
                          <div className="h-4 w-1/2 rounded bg-slate-200" />
                        </td>
                        <td className="px-4 py-3">
                          <div className="h-4 w-1/3 rounded bg-slate-200" />
                        </td>
                        <td className="px-4 py-3">
                          <div className="h-4 w-20 rounded bg-slate-200" />
                        </td>
                        <td className="px-4 py-3">
                          <div className="h-4 w-24 rounded bg-slate-200" />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="h-4 w-16 rounded bg-slate-200 ml-auto" />
                        </td>
                      </tr>
                    ))
                  ) : pageItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                        No projects found
                      </td>
                    </tr>
                  ) : (
                    pageItems.map((p, idx) => {
                      const ownerName = typeof p.ownerName === 'string' ? p.ownerName : '';
                      const displayIndex = (page - 1) * rowsPerPage + idx + 1;

                      return (
                        <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 text-xs font-medium text-slate-600">{displayIndex}</td>
                          <td className="px-4 py-3">
                            <Link href={`/projects/${p.id}`} className="text-indigo-600 font-medium hover:text-indigo-700 transition-colors">
                              {p.name}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-700">{ownerName || 'Unassigned'}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusBadgeClass(p.status)}`}>
                              {p.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600">{relativeTime(p.lastUpdateAt)}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => setEditing(p)}
                                className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                                title="Edit"
                                aria-label={`Edit ${p.name}`}
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(p.id)}
                                className="rounded-lg p-1.5 text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors"
                                title="Delete"
                                aria-label={`Delete ${p.name}`}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pagination */}
        <div className="flex flex-col items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 md:flex-row">
          <div className="text-sm text-slate-600">
            Showing {pageItems.length > 0 ? (page - 1) * rowsPerPage + 1 : 0}–{Math.min(page * rowsPerPage, total)} of {total} project
            {total !== 1 ? 's' : ''}
          </div>

          <div className="flex items-center gap-4">
            {/* Rows per page selector */}
            <select
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(Number(e.target.value));
                setPage(1);
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
              aria-label="Rows per page"
            >
              <option value={10}>10 per page</option>
              <option value={20}>20 per page</option>
              <option value={50}>50 per page</option>
            </select>

            {/* Pagination buttons */}
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1 || loadingPage}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label="Previous page"
              >
                Prev
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }).map((_, i) => {
                  const pageNum = i + 1;
                  const isCurrentPage = pageNum === page;
                  const showPage =
                    isCurrentPage ||
                    pageNum === 1 ||
                    pageNum === totalPages ||
                    (pageNum >= page - 1 && pageNum <= page + 1);

                  if (!showPage && pageNum === 2) {
                    return (
                      <span key="ellipsis-left" className="text-slate-500">
                        …
                      </span>
                    );
                  }
                  if (!showPage && pageNum === totalPages - 1) {
                    return (
                      <span key="ellipsis-right" className="text-slate-500">
                        …
                      </span>
                    );
                  }

                  if (!showPage) return null;

                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                        isCurrentPage
                          ? 'bg-indigo-600 text-white'
                          : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                      aria-current={isCurrentPage ? 'page' : undefined}
                      aria-label={`Page ${pageNum}`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                disabled={page >= totalPages || loadingPage}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label="Next page"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Drawer */}
      {editing ? (
        <div className={`fixed inset-0 z-50 flex overflow-hidden`} aria-hidden={!editing}>
          <div
            className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${editing ? 'opacity-100' : 'opacity-0'}`}
            onClick={() => setEditing(null)}
          />
          <aside
            className={`fixed right-0 top-0 h-full w-full max-w-lg bg-white shadow-2xl transform transition-transform duration-200 ${
              editing ? 'translate-x-0' : 'translate-x-full'
            }`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-project-title"
            onKeyDown={(e) => {
              if (e.key === 'Escape') setEditing(null);
              if (e.key === 'Tab') {
                const el = e.currentTarget as HTMLElement;
                const nodes = Array.from(
                  el.querySelectorAll<HTMLElement>(
                    'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
                  )
                ).filter((x) => !x.hasAttribute('disabled'));
                if (nodes.length === 0) return;
                const first = nodes[0];
                const last = nodes[nodes.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                  e.preventDefault();
                  last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                  e.preventDefault();
                  first.focus();
                }
              }
            }}
          >
            <div className="flex h-full flex-col bg-white">
              {/* Header */}
              <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                <div>
                  <h2 id="edit-project-title" className="text-lg font-semibold text-slate-900">
                    Edit Project
                  </h2>
                  <p className="text-sm text-slate-600 mt-0.5">{editing.name}</p>
                </div>
                <button
                  aria-label="Close drawer"
                  onClick={() => setEditing(null)}
                  className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-auto">
                <div className="p-6">
                  <EditProjectForm
                    project={editing}
                    onCancel={() => setEditing(null)}
                    onSave={async (data: Project) => {
                      await handleSave(data);
                    }}
                    loading={saving}
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="border-t border-slate-200 px-6 py-4 bg-slate-50 text-xs text-slate-600">
                Last updated by {editing?.ownerName || 'Unknown'} at{' '}
                {editing?.lastUpdateAt
                  ? new Date(editing.lastUpdateAt).toLocaleString()
                  : 'N/A'}
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      {/* Modals & Toasts */}
      {toastMessage && <Toast message={toastMessage} onClose={() => setToastMessage(undefined)} />}

      {/* Delete Confirmation Modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-full bg-red-100">
                <AlertTriangle className="text-red-600" size={20} />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Delete Project?</h3>
            </div>

            <div className="text-sm text-slate-600">
              This action cannot be undone. All data for{' '}
              <span className="font-semibold">"{pageItems.find((p) => p.id === confirmDeleteId)?.name || 'this project'}"</span> will be
              permanently deleted.
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-slate-500 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (confirmDeleteId) void handleDelete(confirmDeleteId);
                }}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-1 focus:ring-red-500 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <CreateProjectModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onOptimisticCreated={(temp) => {
          setProjects((prev) => [temp, ...prev]);
          setTotal((t) => t + 1);
        }}
        onCreated={(p, tempId) => {
          if (tempId) {
            setProjects((prev) => prev.map((it) => (it.id === tempId ? p : it)));
          } else if (p && p.id) {
            setProjects((prev) => [p, ...prev]);
            setTotal((t) => t + 1);
          } else {
            void (async () => {
              const paged = await getProjects({ page: 1, pageSize: rowsPerPage });
              setProjects(paged.items);
              setTotal(paged.total);
              setPage(1);
            })();
          }
          setShowCreate(false);
          setToastMessage('Project created successfully');
        }}
        onCreateFailed={(tempId) => {
          setProjects((prev) => prev.filter((it) => it.id !== tempId));
          setTotal((t) => Math.max(0, t - 1));
          setToastMessage('Create failed');
        }}
        onAnnounce={(m) => setGlobalAnnounce(m)}
      />

      <div aria-live="assertive" className="sr-only">
        {globalAnnounce}
      </div>
    </div>
  );
}
