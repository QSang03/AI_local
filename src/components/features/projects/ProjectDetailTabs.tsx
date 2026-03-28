"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getProjectSummary, getProjectTodoList, updateProjectTodoItemStatus } from '@/lib/api';
import { ProjectSummaryResponse } from '@/lib/api';
import { PlatformMessage } from '@/types/domain';
import { BarChart3, MessageCircle, CheckCircle2, Clock } from 'lucide-react';
import { ArrowLeft, Sparkles, Calendar, Trash2, Copy, Check, AlertCircle } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { MessageRenderer } from '@/components/features/inbox/components/MessageRenderer';

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
  quickSummary?: string;
  chats?: Array<{ messages?: Array<{ id: string; role?: string; content?: string; createdAt?: string }> }>;
  summaries?: ProjectSummaryResponse[];
  messagesList?: PlatformMessage[];
};

function getTodayDateString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

type TodoItem = {
  id: string;
  itemIndex: number;
  text: string;
  description?: string;
  priority: 'low' | 'medium' | 'high';
  dueDate?: string;
  completed: boolean;
  assignee?: string;
};

function getPriorityColor(priority: 'low' | 'medium' | 'high'): string {
  switch (priority) {
    case 'high': return 'bg-red-100 text-red-700 border border-red-200';
    case 'medium': return 'bg-amber-100 text-amber-700 border border-amber-200';
    case 'low': return 'bg-slate-100 text-slate-700 border border-slate-200';
  }
}

function getPriorityDot(priority: 'low' | 'medium' | 'high'): string {
  switch (priority) {
    case 'high': return 'bg-red-500';
    case 'medium': return 'bg-amber-500';
    case 'low': return 'bg-slate-400';
  }
}

export default function ProjectDetailTabs({ project, ai, quickSummary, chats, summaries, messagesList }: ProjectDetailTabsProps) {
  const router = useRouter();
  const [active, setActive] = useState<'overview'|'todos'|'summaries'|'messages'>('overview');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString());
  const [summaryContent, setSummaryContent] = useState<string>((quickSummary ?? '').trim() || (ai?.summary ?? ''));
  const [summarySource, setSummarySource] = useState<'quick' | 'daily'>('quick');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [messages] = useState<{ id: string; role?: string; content?: string; createdAt?: string }[]>(() => (chats && chats[0] ? chats[0].messages || [] : []));
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [todoLoading, setTodoLoading] = useState(false);
  const [todoError, setTodoError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Load todos from API on component mount and date change
  const loadTodosList = useCallback(async () => {
    setTodoLoading(true);
    setTodoError(null);
    try {
      const response = await getProjectTodoList(project.id, selectedDate);
      if (response && response.items) {
        const apiTodos: TodoItem[] = response.items.map((item, idx) => ({
          id: `todo-api-${idx}`,
          itemIndex: idx,
          text: item.title,
          description: item.description,
          priority: (item.priority?.toLowerCase() || 'medium') as 'low' | 'medium' | 'high',
          completed: item.status?.toLowerCase() === 'completed' || item.status?.toLowerCase() === 'done',
        }));
        setTodos(apiTodos);
      } else {
        setTodos([]);
        if (response && response.items === undefined) {
           setTodoError('Todo list items not found in response');
        }
      }
    } catch (err) {
      console.error('Failed to load todos:', err);
      setTodoError('Failed to load todo list');
    } finally {
      setTodoLoading(false);
    }
  }, [project.id, selectedDate]);

  useEffect(() => {
    loadTodosList();
  }, [loadTodosList]);


  async function handleLoadSummaryByDate() {
    if (!selectedDate) return;
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const res = await getProjectSummary(project.id, selectedDate);
      const content = (res?.content ?? '').trim();
      setSummaryContent(content || 'No summary available for selected date');
      setSummarySource('daily');
    } catch {
      setSummaryError('Could not load summary for the selected date');
    } finally {
      setSummaryLoading(false);
    }
  }

  function handleResetToQuickSummary() {
    setSummarySource('quick');
    setSummaryError(null);
    setSummaryLoading(true);
    
    // Load quick summary from API (no date parameter)
    getProjectSummary(project.id)
      .then((res: ProjectSummaryResponse | null) => {
        if (res && res.content) {
          setSummaryContent(res.content);
        } else {
          setSummaryContent((quickSummary ?? '').trim() || (ai?.summary ?? 'No summary available'));
        }
      })
      .catch((err: Error | unknown) => {
        console.error('Failed to load quick summary:', err);
        setSummaryContent((quickSummary ?? '').trim() || (ai?.summary ?? 'No summary available'));
      })
      .finally(() => {
        setSummaryLoading(false);
      });
  }


  function removeTodo(id: string) {
    setTodos((prev) => prev.filter((t) => t.id !== id));
  }

  async function toggleTodoComplete(id: string) {
    const todo = todos.find(t => t.id === id);
    if (!todo) return;

    const newStatus = !todo.completed ? 'done' : 'todo';
    
    // Optimistic update
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    );

    try {
      const res = await updateProjectTodoItemStatus(project.id, todo.itemIndex, newStatus);
      if (!res.ok) {
        throw new Error(res.message);
      }
      // Reload to ensure sync with server
      loadTodosList();
    } catch (err) {
      console.error('Failed to update todo status:', err);
      // Revert optimistic update
      setTodos((prev) =>
        prev.map((t) => (t.id === id ? { ...t, completed: todo.completed } : t))
      );
      alert(`Khong the cap nhat trang thai: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId('project-id');
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  // Group todos by completion status
  const inProgressTodos = todos.filter((t) => !t.completed);
  const completedTodos = todos.filter((t) => t.completed);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 border-b border-slate-200 bg-white shadow-sm">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              <ArrowLeft size={16} />
              Back to Projects
            </button>
            <span className="text-slate-300">|</span>
            <h1 className="text-xl font-bold text-slate-900">{project.name}</h1>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${
                project.status === 'active'
                  ? 'bg-emerald-100 text-emerald-700'
                  : project.status === 'urgent' || project.status === 'pending'
                  ? 'bg-amber-100 text-amber-700'
                  : project.status === 'closed'
                  ? 'bg-slate-100 text-slate-700'
                  : 'bg-blue-100 text-blue-700'
              }`}
            >
              {project.status ?? 'Unknown'}
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 border-t border-slate-200 flex items-center gap-0">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'todos', label: 'Todos', count: todos.length, icon: CheckCircle2 },
            { id: 'summaries', label: 'Summaries', count: summaries?.length, icon: Sparkles },
            { id: 'messages', label: 'Messages', count: messagesList?.length, icon: MessageCircle },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = active === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActive(tab.id as typeof active)}
                className={`inline-flex items-center gap-2 px-4 py-4 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon size={16} />
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="ml-1 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {active === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-6 md:grid-cols-1 lg:grid-cols-3">
              {/* Left Column (60%) */}
              <div className="lg:col-span-2 space-y-6">
                {/* Project Info Card */}
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="text-lg font-semibold text-slate-900 mb-4">Project Info</h2>
                  <div className="space-y-4">
                    {/* Owner */}
                    <div className="flex items-start justify-between pb-4 border-b border-slate-200">
                      <span className="text-sm font-medium text-slate-600">Owner</span>
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
                          {project.owner?.name
                            ? project.owner.name
                                .split(' ')
                                .map((n) => n[0])
                                .join('')
                                .slice(0, 2)
                                .toUpperCase()
                            : 'U'}
                        </div>
                        <span className="text-sm text-slate-900 font-medium">
                          {project.owner?.name || project.owner?.username || 'Unassigned'}
                        </span>
                      </div>
                    </div>

                    {/* Created */}
                    <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                      <span className="text-sm font-medium text-slate-600">Created</span>
                      <span className="text-sm text-slate-900">
                        {project.createdAt ? format(new Date(project.createdAt), 'MMM d, yyyy') : 'N/A'}
                      </span>
                    </div>

                    {/* Last Updated */}
                    <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                      <span className="text-sm font-medium text-slate-600">Last Updated</span>
                      <div className="text-right">
                        <span className="text-sm text-slate-900 block">
                          {project.updatedAt ? format(new Date(project.updatedAt), 'MMM d, yyyy') : 'N/A'}
                        </span>
                        <span className="text-xs text-slate-500">
                          {project.updatedAt ? formatDistanceToNow(new Date(project.updatedAt), { addSuffix: true }) : ''}
                        </span>
                      </div>
                    </div>

                    {/* Project ID */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-600">Project ID</span>
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-mono text-slate-600 bg-slate-50 px-2 py-1 rounded">
                          {project.id}
                        </code>
                        <button
                          onClick={() => copyToClipboard(String(project.id))}
                          className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                          title="Copy ID"
                        >
                          {copiedId === 'project-id' ? (
                            <Check size={16} className="text-emerald-600" />
                          ) : (
                            <Copy size={16} />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Project Summary Card */}
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <h2 className="text-lg font-semibold text-slate-900">Summary</h2>
                    <Sparkles size={18} className="text-teal-500" />
                  </div>
                  <p className="text-sm text-slate-600 mb-4">AI-generated summary of project activity</p>

                  {/* Date Picker & Buttons */}
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-2 mb-4">
                    <label className="text-sm font-medium text-slate-600">Summarize up to</label>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <button
                      onClick={handleLoadSummaryByDate}
                      disabled={summaryLoading}
                      className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                      Load
                    </button>
                    <button
                      onClick={handleResetToQuickSummary}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <Sparkles size={14} />
                      Quick Summary
                    </button>
                  </div>

                  {/* Summary Content */}
                  {summaryError ? (
                    <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-200">{summaryError}</div>
                  ) : (
                    <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-700 min-h-[120px]">
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeRaw]}
                        components={{
                          table: ({ ...props }) => <div className="overflow-x-auto"><table className="w-full text-left border-collapse mt-2 mb-2 text-xs" {...props} /></div>,
                          th: ({ ...props }) => <th className="bg-slate-100 font-semibold text-slate-700 px-3 py-1 border border-slate-300" {...props} />,
                          td: ({ ...props }) => <td className="px-3 py-1.5 border border-slate-200 text-slate-600 leading-relaxed min-w-[100px]" {...props} />,
                          p: ({ ...props }) => <p className="mt-2 mb-2 leading-relaxed" {...props} />,
                          ul: ({ ...props }) => <ul className="list-disc pl-5 mt-2 mb-2 space-y-1" {...props} />,
                          ol: ({ ...props }) => <ol className="list-decimal pl-5 mt-2 mb-2 space-y-1" {...props} />,
                          h1: ({ ...props }) => <h1 className="text-lg font-bold mt-4 mb-2 text-slate-900" {...props} />,
                          h2: ({ ...props }) => <h2 className="text-base font-bold mt-3 mb-2 text-slate-800" {...props} />,
                          h3: ({ ...props }) => <h3 className="text-sm font-bold mt-2 mb-2 text-slate-800" {...props} />,
                        }}
                      >
                        {summaryContent || '*No summary available. Select a date and click Load.*'}
                      </ReactMarkdown>
                    </div>
                  )}

                  {summarySource === 'daily' && !summaryError && (
                    <button
                      onClick={handleLoadSummaryByDate}
                      className="mt-3 text-sm text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
                    >
                      Regenerate
                    </button>
                  )}
                </div>
              </div>

              {/* Right Column (40%) */}
              <div className="lg:col-span-1 space-y-6">
                {/* Quick Stats Card */}
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="text-lg font-semibold text-slate-900 mb-4">Quick Stats</h2>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                      <div>
                        <p className="text-xs text-slate-600 uppercase tracking-wide">Total Todos</p>
                        <p className="text-2xl font-bold text-slate-900 mt-1">{todos.length}</p>
                      </div>
                      <CheckCircle2 size={32} className="text-slate-400" />
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50">
                      <div>
                        <p className="text-xs text-emerald-600 uppercase tracking-wide">Completed</p>
                        <p className="text-2xl font-bold text-emerald-700 mt-1">{completedTodos.length}</p>
                      </div>
                      <CheckCircle2 size={32} className="text-emerald-400" />
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50">
                      <div>
                        <p className="text-xs text-blue-600 uppercase tracking-wide">Messages</p>
                        <p className="text-2xl font-bold text-blue-700 mt-1">{messages.length}</p>
                      </div>
                      <MessageCircle size={32} className="text-blue-400" />
                    </div>
                  </div>
                </div>

                {/* Status Card */}
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">Current Status</h2>
                  <div
                    className={`py-3 px-4 rounded-lg text-center font-semibold ${
                      project.status === 'active'
                        ? 'bg-emerald-100 text-emerald-700'
                        : project.status === 'urgent' || project.status === 'pending'
                        ? 'bg-amber-100 text-amber-700'
                        : project.status === 'closed'
                        ? 'bg-slate-100 text-slate-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {project.status ?? 'Unknown'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {active === 'todos' && (
          <div className="space-y-6">
            {/* Loading or Error State */}
            {todoLoading && (
              <div className="rounded-xl border border-slate-200 bg-white p-6 text-center">
                <div className="inline-flex items-center gap-2 text-slate-600">
                  <div className="h-4 w-4 rounded-full border-2 border-slate-300 border-t-slate-600 animate-spin" />
                  <span>Loading todo list...</span>
                </div>
              </div>
            )}

            {todoError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
                <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-900">{todoError}</p>
                  <p className="text-xs text-red-700 mt-1">The todo list may not be available. You can still add and manage tasks below.</p>
                </div>
              </div>
            )}

            {todos.length > 0 && !todoLoading && (
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 flex items-start gap-2">
                <AlertCircle size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700">
                  Loaded {todos.length} todo{todos.length !== 1 ? 's' : ''} from AI analysis
                </p>
              </div>
            )}

            {/* Todos List */}
            {todos.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 py-12 text-center">
                <CheckCircle2 size={40} className="text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">Chưa có nhiệm vụ nào được ghi nhận.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* In Progress */}
                {inProgressTodos.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                      In Progress
                      <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
                        {inProgressTodos.length}
                      </span>
                    </h3>
                    <div className="space-y-2">
                      {inProgressTodos.map((todo) => {
                        const isOverdue = todo.dueDate && new Date(todo.dueDate) < new Date();

                        return (
                          <div
                            key={todo.id}
                            className="group flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 hover:shadow-md transition-all"
                          >
                            <button
                              onClick={() => toggleTodoComplete(todo.id)}
                              className="mt-1 flex-shrink-0 h-5 w-5 rounded border-2 border-slate-300 bg-white hover:border-indigo-500 transition-colors flex items-center justify-center"
                              title="Complete task"
                            >
                              {todo.completed && <Check size={14} className="text-indigo-600" />}
                            </button>

                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-semibold ${todo.completed ? 'line-through text-slate-500' : 'text-slate-800'}`}>
                                  {todo.text}
                                </p>
                                {todo.description && (
                                  <p className={`text-xs mt-1 ${todo.completed ? 'line-through text-slate-400' : 'text-slate-500'}`}>
                                    {todo.description}
                                  </p>
                                )}

                              {/* Due date */}
                              {todo.dueDate && (
                                <div className={`text-xs mt-1 inline-flex items-center gap-1 px-2 py-1 rounded ${
                                  isOverdue
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-slate-100 text-slate-600'
                                }`}>
                                  <Calendar size={12} />
                                  {format(new Date(todo.dueDate), 'MMM d')}
                                </div>
                              )}
                            </div>

                            {/* Priority Badge */}
                            <span className={`flex-shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${getPriorityColor(todo.priority)}`}>
                              <span className={`h-1.5 w-1.5 rounded-full mr-1 ${getPriorityDot(todo.priority)}`} />
                              {todo.priority.charAt(0).toUpperCase() + todo.priority.slice(1)}
                            </span>

                            {/* Delete Button */}
                            <button
                              onClick={() => removeTodo(todo.id)}
                              className="flex-shrink-0 opacity-0 group-hover:opacity-100 rounded-lg p-1 text-slate-600 hover:bg-red-50 hover:text-red-600 transition-all"
                              title="Delete"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Completed */}
                {completedTodos.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                      Completed
                      <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">
                        {completedTodos.length}
                      </span>
                    </h3>
                    <div className="space-y-2">
                      {completedTodos.map((todo) => (
                        <div
                          key={todo.id}
                          className="group flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 opacity-60 hover:shadow-md transition-all"
                        >
                          <button
                            onClick={() => toggleTodoComplete(todo.id)}
                            className="mt-1 flex-shrink-0 h-5 w-5 rounded border-2 border-emerald-500 bg-emerald-600 flex items-center justify-center transition-colors"
                            title="Incomplete task"
                          >
                            <Check size={14} className="text-white" />
                          </button>

                          <div className="flex-1 min-w-0">
                            <p className="line-through text-slate-600 text-sm">{todo.text}</p>
                            {todo.dueDate && (
                              <div className="text-xs mt-1 inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-200 text-slate-600">
                                <Calendar size={12} />
                                {format(new Date(todo.dueDate), 'MMM d')}
                              </div>
                            )}
                          </div>

                          <span className={`flex-shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${getPriorityColor(todo.priority)}`}>
                            <span className={`h-1.5 w-1.5 rounded-full mr-1 ${getPriorityDot(todo.priority)}`} />
                            {todo.priority.charAt(0).toUpperCase() + todo.priority.slice(1)}
                          </span>

                          <button
                            onClick={() => removeTodo(todo.id)}
                            className="flex-shrink-0 opacity-0 group-hover:opacity-100 rounded-lg p-1 text-slate-600 hover:bg-red-50 hover:text-red-600 transition-all"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Progress Bar */}
                {todos.length > 0 && (
                  <div className="rounded-lg bg-white border border-slate-200 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-slate-700">
                        {completedTodos.length} of {todos.length} tasks completed
                      </span>
                      <span className="text-sm font-semibold text-slate-900">
                        {Math.round((completedTodos.length / todos.length) * 100)}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div
                        className="bg-teal-500 h-2 rounded-full transition-all"
                        style={{ width: `${(completedTodos.length / todos.length) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {active === 'summaries' && (
          <ProjectSummariesTab summaries={summaries || []} />
        )}

        {active === 'messages' && (
          <ProjectMessagesTab messages={messagesList || []} />
        )}
      </div>
    </div>
  );
}

function ProjectSummariesTab({ summaries }: { summaries: ProjectSummaryResponse[] }) {
  if (!summaries || summaries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-400">
        <Sparkles className="mb-2 h-10 w-10 text-slate-300" />
        <p>No summaries available.</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      {summaries.map((summary: ProjectSummaryResponse, idx: number) => (
        <div key={idx} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-indigo-500" />
              {summary.summary_date || 'Unknown Date'}
            </h3>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              {summary.status || 'Archived'}
            </span>
          </div>
          <div className="text-slate-700 bg-slate-50/50 p-4 rounded-lg border border-slate-100">
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
              components={{
                table: ({ ...props }) => <div className="overflow-x-auto"><table className="w-full text-left border-collapse mt-4 mb-4 text-sm" {...props} /></div>,
                th: ({ ...props }) => <th className="bg-slate-100 font-semibold text-slate-700 px-4 py-2 border border-slate-300" {...props} />,
                td: ({ ...props }) => <td className="px-4 py-3 border border-slate-200 text-slate-600 leading-relaxed min-w-[120px]" {...props} />,
                p: ({ ...props }) => <p className="mt-3 mb-3 leading-relaxed" {...props} />,
                ul: ({ ...props }) => <ul className="list-disc pl-6 mt-3 mb-3 space-y-1" {...props} />,
                ol: ({ ...props }) => <ol className="list-decimal pl-6 mt-3 mb-3 space-y-1" {...props} />,
                h1: ({ ...props }) => <h1 className="text-xl font-bold mt-6 mb-3 text-slate-900" {...props} />,
                h2: ({ ...props }) => <h2 className="text-lg font-bold mt-5 mb-3 text-slate-800" {...props} />,
                h3: ({ ...props }) => <h3 className="text-base font-bold mt-4 mb-3 text-slate-800" {...props} />,
                strong: ({ ...props }) => <strong className="font-semibold text-slate-900" {...props} />,
                a: ({ ...props }) => <a className="text-indigo-600 hover:text-indigo-800 hover:underline font-medium" {...props} />,
                blockquote: ({ ...props }) => <blockquote className="border-l-4 border-indigo-200 pl-4 italic text-slate-600 my-4" {...props} />
              }}
            >
              {summary.content || '*Empty summary*'}
            </ReactMarkdown>
          </div>
        </div>
      ))}
    </div>
  );
}
function ProjectMessagesTab({ messages }: { messages: PlatformMessage[] }) {
  const [activeFilter, setActiveFilter] = useState<'all' | 'zalo' | 'whatsapp' | 'email'>('all');
  const [expandedMessages, setExpandedMessages] = useState<Record<number, boolean>>({});

  const toggleExpand = (idx: number) => {
    setExpandedMessages(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const getChannelDisplayName = (channel: string | { provider?: string; name?: string } | null | undefined): string => {
    if (!channel) return '';
    if (typeof channel === 'string') return channel;
    if (typeof channel === 'object') {
      return (channel.provider || channel.name || 'Unknown').toString();
    }
    return String(channel);
  };

  const getMessageCategory = (msg: PlatformMessage): 'zalo' | 'whatsapp' | 'email' | 'other' => {
    const channelName = getChannelDisplayName(msg.channel).toLowerCase();
    if (channelName.includes('zalo')) return 'zalo';
    if (channelName.includes('whatsapp') || channelName.includes('wa')) return 'whatsapp';
    if (channelName.includes('email') || channelName.includes('gmail')) return 'email';
    return 'other';
  };

  const filteredMessages = activeFilter === 'all' 
    ? messages 
    : messages.filter((m: PlatformMessage) => getMessageCategory(m) === activeFilter);

  return (
    <div className="w-full space-y-4">
      {/* Filters */}
      {messages && messages.length > 0 && (
        <div className="flex items-center gap-2 pb-4 pt-1 mb-2 border-b border-slate-200">
          <span className="text-sm font-medium text-slate-500 mr-2 uppercase tracking-wide">Filters:</span>
          {(['all', 'zalo', 'whatsapp', 'email'] as const).map(f => {
            const count = f === 'all' ? messages.length : messages.filter((m: PlatformMessage) => getMessageCategory(m) === f).length;
            
            return (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                disabled={count === 0 && f !== 'all'}
                className={`px-3 py-1.5 flex items-center gap-1.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 ${
                  activeFilter === f 
                    ? 'bg-indigo-600 text-white shadow-sm' 
                    : count === 0 && f !== 'all'
                      ? 'bg-slate-50 text-slate-400 opacity-60 cursor-not-allowed'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-indigo-600'
                }`}
              >
                {f}
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] leading-none ${
                  activeFilter === f ? 'bg-white/20' : 'bg-slate-100 text-slate-500'
                }`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {filteredMessages.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-slate-400">
          <MessageCircle className="mb-2 h-10 w-10 text-slate-200" />
          <p>No messages found for this channel.</p>
        </div>
      ) : (
        filteredMessages.map((msg: PlatformMessage, idx: number) => {
          const receivedAt = msg.receivedAt ? new Date(msg.receivedAt) : new Date();
          const sender = msg.senderDisplay || 'Unknown User';
          return (
            <div key={idx} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex items-start gap-4 transition-colors hover:bg-slate-50">
              {msg.senderAvatarUrl ? (
                <img 
                  src={msg.senderAvatarUrl} 
                  alt={sender} 
                  className="flex h-10 w-10 flex-shrink-0 rounded-full object-cover shadow-sm bg-slate-100"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = ''; // Fallback if image fails to load
                  }}
                />
              ) : (
                <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold uppercase 
                  ${idx % 2 === 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-teal-100 text-teal-700'}`}>
                  {sender.substring(0, 2)}
                </div>
              )}
              <div className="flex-grow min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-slate-900 truncate pr-4">{sender}</span>
                  <span className="flex-shrink-0 text-xs font-medium text-slate-400 whitespace-nowrap flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {format(receivedAt, 'MMM d, h:mm a')}
                  </span>
                </div>
                <div className="text-sm text-slate-700 rounded-lg bg-indigo-50/10 p-3 mt-2 border border-slate-100 shadow-sm overflow-hidden">
                  <MessageRenderer 
                    content={msg.content || ''} 
                    bodyHtml={msg.bodyHtml}
                    mediaUrls={msg.mediaUrls}
                    isExpanded={expandedMessages[idx]}
                    onToggleExpand={() => toggleExpand(idx)}
                  />
                </div>
                {msg.channel && (
                  <div className="mt-3 text-xs font-semibold text-slate-500 inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1 uppercase tracking-wider">
                    {getChannelDisplayName(msg.channel)}
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
