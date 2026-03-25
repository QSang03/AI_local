"use client";

import React, { useEffect, useState } from 'react';
import { Project } from '@/types/domain';

type OwnerOption = { id: string; name: string };

type ExtendedProject = Project & Partial<{ tags: string[]; startDate: string; endDate: string; ownerName: string }>;

interface EditProjectFormProps {
  project: Project | null;
  onCancel: () => void;
  onSave: (p: Project) => void;
  loading?: boolean;
}
export default function EditProjectForm({ project, onCancel, onSave, loading = false }: EditProjectFormProps) {
  const ext = project as ExtendedProject | null;
  const [name, setName] = useState(ext?.name ?? '');
  const [description, setDescription] = useState(ext?.description ?? '');
  const [status, setStatus] = useState<Project['status']>(ext?.status ?? 'new');
  const [errors, setErrors] = useState<Record<string,string>>({});

  // Sync states from project prop when project changes.
  useEffect(() => {
    const e = project as ExtendedProject | null;
    setTimeout(() => {
      setName(e?.name ?? '');
      setDescription(e?.description ?? '');
      setStatus(e?.status ?? 'new');
    }, 0);
  }, [project]);

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
