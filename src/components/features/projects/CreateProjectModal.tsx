"use client";

import React, { useEffect, useState } from 'react';
import { createProject } from '@/lib/api';
import { Project } from '@/types/domain';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated?: (p: Project, tempId?: string) => void;
  onOptimisticCreated?: (p: Project) => void;
  onCreateFailed?: (tempId: string) => void;
  onAnnounce?: (msg: string) => void;
}

export default function CreateProjectModal({ open, onClose, onCreated, onOptimisticCreated, onCreateFailed, onAnnounce }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = React.useRef<HTMLDivElement | null>(null);
  const prevFocus = React.useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const nameInputRef = React.useRef<HTMLInputElement | null>(null);

  function getFocusable(el: HTMLElement | null) {
    if (!el) return [] as HTMLElement[];
    return Array.from(el.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])')).filter(x => !x.hasAttribute('disabled'));
  }

  useEffect(() => {
    if (!open) return;
    prevFocus.current = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => {
      const first = getFocusable(ref.current)[0];
      first?.focus();
    }, 0);
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { onClose(); }
      if (e.key === 'Tab') {
        const nodes = getFocusable(ref.current);
        if (nodes.length === 0) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener('keydown', onKey);
    return () => { clearTimeout(t); document.removeEventListener('keydown', onKey); prevFocus.current?.focus(); };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      setName('');
      setDescription('');
      setError(null);
      setVisible(false);
    } else {
      setVisible(true);
    }
  }, [open]);

  // No owner autocomplete: creator is owner by backend.

  async function handleCreate() {
    setLoading(true);
    setError(null);

    // create optimistic project (no owner fields - backend will set owner to creator)
    const tempId = `temp-${Date.now()}`;
    const tempProj: Project = {
      id: tempId,
      code: `TEMP${Date.now() % 10000}`,
      name: name.trim(),
      description: description.trim(),
      ownerId: '',
      ownerName: '',
      status: 'new',
      lastUpdateAt: new Date().toISOString(),
      unreadCount: 0,
      summary: '',
      todoList: [],
    };

    onOptimisticCreated?.(tempProj);

    try {
      const res = await createProject({ name: name.trim(), description: description.trim() });
      // If backend returned a project object, call onCreated with tempId so caller can reconcile
      if (res && typeof res === 'object' && 'id' in res) {
        onCreated?.(res as Project, tempId);
        onAnnounce?.('Project created successfully');
      } else {
        onCreated?.(res as Project);
      }

      // animate out then close
      setVisible(false);
      setTimeout(() => onClose(), 220);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Create failed';
      setError(msg);
      onAnnounce?.(msg);
      onCreateFailed?.(tempId);
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="create-title">
      <div className="absolute inset-0 bg-black/40" onClick={() => { setVisible(false); setTimeout(() => onClose(), 220); }} />
      <div ref={ref} className={`relative z-10 w-full max-w-2xl rounded bg-white p-6 shadow-lg transform transition-all duration-200 ease-out ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'} motion-reduce:transition-none`}>
        <h3 id="create-title" className="text-lg font-semibold">Create Project</h3>
        <div className="mt-4">
          <div className="grid gap-3">
            <label className="text-sm font-medium">Name</label>
            <input ref={nameInputRef} value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded border px-3 py-2" aria-invalid={validationErrors.length > 0} aria-describedby={validationErrors.length > 0 ? 'create-name-error' : undefined} />
            {validationErrors.length > 0 && (
              <div id="create-name-error" role="alert" aria-live="assertive" className="text-sm text-rose-600">{validationErrors.join('. ')}</div>
            )}
            <label className="text-sm font-medium">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full rounded border px-3 py-2 h-28" />
            {/* status is assigned by backend (creator becomes owner); no selection on create */}
          </div>
        </div>

        {error && <div role="alert" aria-live="assertive" className="mt-4 text-sm text-rose-600">{error}</div>}

        <div className="mt-6 flex justify-between items-center">
          <div className="text-sm text-gray-600">Create new project</div>
          <div className="flex gap-3">
            <button onClick={onClose} className="rounded border px-4 py-2">Cancel</button>
            <button onClick={() => {
              const errs: string[] = [];
              if (!name.trim()) errs.push('Name is required');
              if (errs.length > 0) {
                setValidationErrors(errs);
                setTimeout(() => nameInputRef.current?.focus(), 0);
                return;
              }
              setValidationErrors([]);
              void handleCreate();
            }} disabled={!name.trim() || loading} className="rounded bg-indigo-600 px-4 py-2 text-white">{loading ? 'Creating...' : 'Create'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
