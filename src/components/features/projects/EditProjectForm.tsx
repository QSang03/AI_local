"use client";

import React, { useEffect, useState } from 'react';
import { Project } from '@/types/domain';
import { getProjectSummary } from '@/lib/api';

type OwnerOption = { id: string; name: string };

type ExtendedProject = Project & Partial<{ tags: string[]; startDate: string; endDate: string; ownerName: string }>;

interface EditProjectFormProps {
  project: Project | null;
  onCancel: () => void;
  onSave: (p: Project) => void;
  loading?: boolean;
}

function getTodayDateString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function EditProjectForm({ project, onCancel, onSave, loading = false }: EditProjectFormProps) {
  const ext = project as ExtendedProject | null;
  const [name, setName] = useState(ext?.name ?? '');
  const [description, setDescription] = useState(ext?.description ?? '');
  const [status, setStatus] = useState<Project['status']>(ext?.status ?? 'new');
  const [selectedDate, setSelectedDate] = useState(getTodayDateString());
  const [summarySource, setSummarySource] = useState<'quick' | 'daily'>('quick');
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string,string>>({});

  // Sync states from project prop when project changes.
  useEffect(() => {
    const e = project as ExtendedProject | null;
    setTimeout(() => {
      setName(e?.name ?? '');
      setDescription(e?.description ?? '');
      setStatus(e?.status ?? 'new');
      setSelectedDate(getTodayDateString());
      setSummarySource('quick');
      setSummaryError(null);
    }, 0);
  }, [project]);

  async function loadQuickSummary(projectId: string) {
    setLoadingSummary(true);
    setSummaryError(null);
    try {
      const res = await getProjectSummary(projectId);
      const summaryContent = (res?.content ?? '').trim();
      if (summaryContent) setDescription(summaryContent);
      setSummarySource('quick');
    } catch {
      setSummaryError('Khong tai duoc quick summary');
    } finally {
      setLoadingSummary(false);
    }
  }

  useEffect(() => {
    const projectId = String(project?.id ?? '').trim();
    if (!projectId || projectId.startsWith('temp-')) return;

    let mounted = true;
    void (async () => {
      await loadQuickSummary(projectId);
    })();

    return () => {
      mounted = false;
    };
  }, [project?.id]);

  async function handleLoadSummaryByDate() {
    const projectId = String(project?.id ?? '').trim();
    if (!projectId || !selectedDate) return;

    setLoadingSummary(true);
    setSummaryError(null);
    try {
      const res = await getProjectSummary(projectId, selectedDate);
      const summaryContent = (res?.content ?? '').trim();
      setDescription(summaryContent || 'No summary available for selected date');
      setSummarySource('daily');
    } catch {
      setSummaryError('Khong tai duoc summary theo ngay da chon');
    } finally {
      setLoadingSummary(false);
    }
  }

  async function handleResetQuickSummary() {
    const projectId = String(project?.id ?? '').trim();
    if (!projectId) return;
    await loadQuickSummary(projectId);
  }

  // only name, description, status are editable

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const errs: Record<string,string> = {};
        if (!name || name.trim().length === 0) errs.name = 'Name is required';
        setErrors(errs);
        if (Object.keys(errs).length > 0) return;

        const updatedExt: ExtendedProject = {
          ...((project || {}) as ExtendedProject),
          name,
          description,
          status,
        };

        onSave(updatedExt as unknown as Project);
      }}
    >
      <div className="grid gap-3">
        <label className="text-sm font-medium">Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className={`w-full rounded border px-3 py-2 ${errors.name ? 'border-rose-500' : ''}`} />
        {errors.name && <div className="text-rose-600 text-sm">{errors.name}</div>}

        <label className="text-sm font-medium">Description</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full rounded border px-3 py-2 h-28" />
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="rounded border px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={handleLoadSummaryByDate}
            disabled={loadingSummary || !selectedDate}
            className="rounded bg-indigo-600 px-3 py-2 text-sm text-white disabled:opacity-60"
          >
            {loadingSummary ? 'Loading...' : 'Load by date'}
          </button>
          <button
            type="button"
            onClick={() => { void handleResetQuickSummary(); }}
            className="rounded border px-3 py-2 text-sm"
          >
            Quick summary
          </button>
        </div>
        <div className="text-xs text-gray-500">
          {summarySource === 'quick' ? 'Dang hien thi quick summary' : `Dang hien thi summary ngay ${selectedDate}`}
        </div>
        {loadingSummary ? <div className="text-xs text-gray-500">Loading project summary...</div> : null}
        {summaryError ? <div className="text-xs text-rose-600">{summaryError}</div> : null}

        {/* Owner is not editable here (creator is owner) */}

        <label className="text-sm font-medium">Status</label>
        <div className="flex gap-2">
          {(['active','urgent','closed','new'] as Project['status'][]).map((s) => (
            <button key={s} type="button" onClick={() => setStatus(s)} className={`px-3 py-1 rounded ${status===s? 'bg-indigo-600 text-white' : 'bg-gray-100'}`}>{s}</button>
          ))}
        </div>

        {/* only Name, Description, Status are editable */}

      </div>

      <div className="mt-6 flex justify-end gap-3">
        <button type="button" onClick={onCancel} className="rounded border px-4 py-2">Cancel</button>
        <button type="submit" disabled={loading} className="rounded bg-indigo-600 px-4 py-2 text-white">{loading ? 'Saving...' : 'Save Changes'}</button>
      </div>
    </form>
  );
}
