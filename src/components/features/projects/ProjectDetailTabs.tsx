"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { sendProjectChatMessage } from '@/lib/api';

type ProjectDetailTabsProps = {
  project: {
    id: string;
    name?: string;
    description?: string;
    status?: string;
    owner?: { id?: string; username?: string; name?: string };
    createdAt?: string;
    updatedAt?: string;
    raw?: { todoList?: string[] } | unknown;
  };
  ai?: { todoList?: string[]; summary?: string };
  chats?: Array<{ messages?: Array<{ id: string; role?: string; content?: string; createdAt?: string }> }>;
};

export default function ProjectDetailTabs({ project, ai, chats }: ProjectDetailTabsProps) {
  const router = useRouter();
  const [active, setActive] = useState<'overview'|'activity'|'todos'>('overview');
  const [messages, setMessages] = useState<{ id: string; role?: string; content?: string; createdAt?: string }[]>(() => (chats && chats[0] ? chats[0].messages || [] : []));
  const [newMsg, setNewMsg] = useState('');
  const [todos, setTodos] = useState<string[]>(() => {
    if (ai && ai.todoList) return ai.todoList.slice();
    // project.raw may be unknown at compile-time; safely check for todoList
    const rawObj = project.raw as Record<string, unknown> | undefined;
    return rawObj && Array.isArray(rawObj['todoList']) ? (rawObj['todoList'] as string[]) : [];
  });

  async function handleSend() {
    if (!newMsg.trim()) return;
    const payload = { projectId: project.id, content: newMsg.trim() };
    try {
      await sendProjectChatMessage(payload);
      setMessages((s) => [...s, { id: `local-${Date.now()}`, role: 'sale', content: newMsg.trim(), createdAt: new Date().toISOString() }]);
      setNewMsg('');
    } catch {
      // ignore
    }
  }

  function addTodo() {
    const v = (document.getElementById('todo-input') as HTMLInputElement)?.value?.trim();
    if (!v) return;
    setTodos((t) => [v, ...t]);
    (document.getElementById('todo-input') as HTMLInputElement).value = '';
  }

  function removeTodo(i: number) {
    setTodos((t) => t.filter((_, idx) => idx !== i));
  }

  return (
    <div>
      <div className="flex items-center gap-4 border-b pb-3">
        <button onClick={() => router.back()} className="rounded px-2 py-1 text-sm text-slate-600 hover:bg-slate-100">← Back</button>
        <button onClick={() => setActive('overview')} className={`px-3 py-2 ${active==='overview' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-600'}`}>Overview</button>
        <button onClick={() => setActive('activity')} className={`px-3 py-2 ${active==='activity' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-600'}`}>Activity</button>
        <button onClick={() => setActive('todos')} className={`px-3 py-2 ${active==='todos' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-600'}`}>Todos</button>
      </div>

      <div className="mt-6">
        {active === 'overview' && (
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">{project.name}</h1>
                <div className="text-sm text-gray-600">{project.description}</div>
              </div>
              <div className="text-sm text-gray-500">Status: <span className="font-medium">{project.status}</span></div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4">
              <div className="rounded border bg-white p-4">
                <h3 className="text-sm font-semibold text-gray-700">Owner</h3>
                <div className="mt-2 text-sm text-gray-800">{project.owner?.username ?? project.owner?.name ?? 'N/A'}</div>
                <div className="text-xs text-gray-500">ID: {project.owner?.id ?? 'N/A'}</div>
              </div>

              <div className="rounded border bg-white p-4">
                <h3 className="text-sm font-semibold text-gray-700">Timestamps</h3>
                <div className="mt-2 text-sm text-gray-800">Created: {project.createdAt ?? 'N/A'}</div>
                <div className="text-sm text-gray-800">Updated: {project.updatedAt ?? 'N/A'}</div>
              </div>
            </div>

            <div className="mt-6">
              <h3 className="text-sm font-semibold text-gray-700">AI Summary</h3>
              <div className="mt-2 text-sm text-gray-700">{ai?.summary || 'No summary available'}</div>
            </div>
          </div>
        )}

        {active === 'activity' && (
          <div>
            <div className="mb-4">
              <div className="rounded border bg-white p-4">
                <h3 className="text-sm font-semibold">Chat</h3>
                <div className="mt-3 space-y-3 max-h-64 overflow-auto">
                  {messages.length === 0 ? <div className="text-sm text-gray-500">No messages</div> : messages.map((m) => (
                    <div key={m.id} className="text-sm">
                      <div className="text-xs text-gray-500">{m.role} • {m.createdAt ? new Date(m.createdAt).toLocaleString() : ''}</div>
                      <div className="mt-1 text-gray-800">{m.content}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex gap-2">
                  <input id="msg-input" value={newMsg} onChange={(e) => setNewMsg(e.target.value)} placeholder="Type a message" className="flex-1 rounded border px-3 py-2" />
                  <button onClick={handleSend} className="rounded bg-indigo-600 px-4 py-2 text-white">Send</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {active === 'todos' && (
          <div>
            <div className="rounded border bg-white p-4">
              <h3 className="text-sm font-semibold">Todos</h3>
              <div className="mt-3 space-y-2">
                <div className="flex gap-2">
                  <input id="todo-input" placeholder="New todo" className="flex-1 rounded border px-3 py-2" />
                  <button onClick={addTodo} className="rounded bg-indigo-600 px-4 py-2 text-white">Add</button>
                </div>

                {todos.length === 0 ? <div className="text-sm text-gray-500">No todos</div> : (
                  <ul className="space-y-2">
                    {todos.map((t, i) => (
                      <li key={i} className="flex items-center justify-between rounded bg-slate-50 px-3 py-2">
                        <div className="text-sm text-gray-800">{t}</div>
                        <button onClick={() => removeTodo(i)} className="text-xs text-rose-600">Remove</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
