'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { format, formatDistanceToNow, isPast } from 'date-fns';
import {
  ArrowLeft,
  Pencil,
  BarChart2,
  CheckCircle2,
  Copy,
  Sparkles,
  Calendar,
  ChevronDown,
  ChevronUp,
  Trash2,
  Plus,
  MessageCircle,
  Clock
} from 'lucide-react';
import Link from 'next/link';
import { getProjectById, getProjectAIOutput, getProjectChats, getProjectSummariesList, getProjectMessagesList, getProjectSummary } from '@/lib/api';

// --- Types ---

type TabType = 'overview' | 'todos' | 'summaries' | 'messages';
type Priority = 'low' | 'medium' | 'high';
type Todo = {
  id: string;
  text: string;
  completed: boolean;
  priority: Priority;
  dueDate?: Date;
};

// --- Loading Component ---

function Loader() {
  return (
    <div className="flex justify-center items-center py-12 h-screen">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600"></div>
    </div>
  );
}

// --- Main Data Fetching Component ---

export default function ProjectDetailClient({ projectId }: { projectId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [proj, ai, chats, summariesData, messagesData] = await Promise.all([
          getProjectById(projectId),
          getProjectAIOutput(String(projectId)),
          getProjectChats(),
          getProjectSummariesList(projectId),
          getProjectMessagesList(projectId),
        ]);
        if (!mounted) return;
        const projectChats = (chats || []).filter((t: any) => String(t.projectId) === String(projectId));
        const rawProj = proj as any;
        // Read owner directly from API response's owner object
        const rawOwner = rawProj.owner as Record<string, unknown> | undefined;
        const ownerId = rawOwner?.id ? String(rawOwner.id) : String(rawProj.owner_id ?? '');
        const ownerUsername = String(rawOwner?.username ?? rawOwner?.name ?? proj.ownerName ?? '');
        const owner = {
          id: ownerId,
          username: ownerUsername,
          name: ownerUsername,
        };
        const createdAt = rawProj.created_at ?? rawProj.createdAt ?? proj.lastUpdateAt ?? new Date().toISOString();
        const updatedAt = rawProj.updated_at ?? rawProj.updatedAt ?? proj.lastUpdateAt ?? new Date().toISOString();
        setData({
          project: {
            id: String(proj.id),
            name: proj.name || 'Untitled Project',
            description: proj.description,
            status: proj.status || 'Active',
            owner,
            createdAt,
            updatedAt,
            raw: proj,
          },
          ai,
          chats: projectChats,
          summaries: summariesData || [],
          messages: messagesData || [],
        });
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Load failed');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    if (projectId) load();
    return () => { mounted = false; };
  }, [projectId]);

  if (loading) return <div className="min-h-screen bg-slate-50 font-sans text-slate-900"><Loader /></div>;
  if (error) return (
    <div className="min-h-screen bg-slate-50 font-sans p-6">
      <h2 className="text-lg font-semibold text-red-600">{error}</h2>
      <p className="text-sm text-slate-600 mt-2">You may need to login or be the project owner to view details.</p>
    </div>
  );
  if (!data) return <div className="min-h-screen bg-slate-50 font-sans p-6">No data</div>;

  return <ProjectDetailView data={data} projectId={projectId} />;
}

// --- View Component ---

function ProjectDetailView({ data, projectId }: { data: any; projectId: string }) {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  
  // Initialize todos from data
  const [todos, setTodos] = useState<Todo[]>(() => {
    const aiTodos = data.ai?.todoList || data.project.raw?.todoList;
    if (Array.isArray(aiTodos) && aiTodos.length > 0) {
      return aiTodos.map((t: string, i: number) => ({
        id: `todo-${i}`,
        text: t,
        completed: false,
        priority: 'medium',
      }));
    }
    return [
      { id: '1', text: 'Setup repository', completed: true, priority: 'high', dueDate: new Date() },
      { id: '2', text: 'Create initial layout', completed: false, priority: 'high', dueDate: new Date() },
      { id: '3', text: 'Review PRs', completed: false, priority: 'medium' },
    ];
  });

  const [newTodoInput, setNewTodoInput] = useState('');
  const [newTodoPriority, setNewTodoPriority] = useState<Priority>('medium');
  const [showCompleted, setShowCompleted] = useState(true);

  const openTodosCount = todos.filter(t => !t.completed).length;

  const project = data.project;
  const ownerName = project.owner?.name || project.owner?.username || 'Unknown Owner';
  const ownerAvatar = ownerName.substring(0, 2).toUpperCase() || '??';
  const createdAtDate = project.createdAt ? new Date(project.createdAt) : new Date();
  const updatedAtDate = project.updatedAt ? new Date(project.updatedAt) : new Date();

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Page Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex items-center gap-3 text-sm">
          <Link href="/projects" className="flex items-center text-slate-500 hover:text-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-lg transition-colors">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to Projects
          </Link>
          <span className="text-slate-300">/</span>
          <h1 className="text-xl font-bold text-slate-900">{project.name}</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
            {project.status || 'Active'}
          </span>
          <button className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors">
            <Pencil className="h-4 w-4" />
            Edit
          </button>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="border-b border-slate-200 bg-white px-6">
        <div className="flex gap-8">
          <TabButton
            active={activeTab === 'overview'}
            onClick={() => setActiveTab('overview')}
            icon={<BarChart2 className="h-4 w-4" />}
            label="Overview"
          />
          <TabButton
            active={activeTab === 'todos'}
            onClick={() => setActiveTab('todos')}
            icon={<CheckCircle2 className="h-4 w-4" />}
            label="Todos"
            badge={openTodosCount > 0 ? openTodosCount : undefined}
          />
          <TabButton
            active={activeTab === 'summaries'}
            onClick={() => setActiveTab('summaries')}
            icon={<Sparkles className="h-4 w-4" />}
            label="Summaries"
            badge={data.summaries?.length > 0 ? data.summaries.length : undefined}
          />
          <TabButton
            active={activeTab === 'messages'}
            onClick={() => setActiveTab('messages')}
            icon={<MessageCircle className="h-4 w-4" />}
            label="Messages"
            badge={data.messages?.length > 0 ? data.messages.length : undefined}
          />
        </div>
      </div>

      {/* Main Content Area */}
      <main className="w-full p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'overview' && (
              <OverviewTab 
                project={project}
                projectId={projectId}
                ownerName={ownerName} 
                ownerAvatar={ownerAvatar} 
                createdAtDate={createdAtDate} 
                updatedAtDate={updatedAtDate} 
                todos={todos}
                aiSummary={data.ai?.summary}
              />
            )}
            {activeTab === 'todos' && (
              <TodosTab
                todos={todos}
                setTodos={setTodos}
                newTodoInput={newTodoInput}
                setNewTodoInput={setNewTodoInput}
                newTodoPriority={newTodoPriority}
                setNewTodoPriority={setNewTodoPriority}
                showCompleted={showCompleted}
                setShowCompleted={setShowCompleted}
              />
            )}
            {activeTab === 'summaries' && (
              <ProjectSummariesTab summaries={data.summaries} />
            )}
            {activeTab === 'messages' && (
              <ProjectMessagesTab messages={data.messages} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

// --- Subcomponents ---

function TabButton({ active, onClick, icon, label, badge }: any) {
  return (
    <button
      onClick={onClick}
      className={`group relative flex items-center gap-2 border-b-2 py-4 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
        active ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'
      }`}
    >
      {icon}
      {label}
      {badge !== undefined && (
        <span className={`ml-1 flex h-5 w-5 items-center justify-center rounded-full text-xs ${active ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'}`}>
          {badge}
        </span>
      )}
    </button>
  );
}

function OverviewTab({ project, projectId, ownerName, ownerAvatar, createdAtDate, updatedAtDate, todos, aiSummary }: any) {
  const completedCount = todos.filter((t: Todo) => t.completed).length;
  const [summaryContent, setSummaryContent] = useState<string>(aiSummary ?? '');
  const [summaryLoading, setSummaryLoading] = useState(false);

  const handleQuickSummary = async () => {
    setSummaryLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const result = await getProjectSummary(projectId, today);
      setSummaryContent(result?.content ?? 'Không có dữ liệu tóm tắt.');
    } catch {
      setSummaryContent('Không thể tải tóm tắt. Vui lòng thử lại.');
    } finally {
      setSummaryLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      {/* Left Column */}
      <div className="flex flex-col gap-6 lg:col-span-3">
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-800">Project Info</h2>
          <div className="space-y-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Owner</span>
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-xs font-medium text-indigo-700">
                  {ownerAvatar}
                </div>
                <span className="font-medium text-slate-900">{ownerName}</span>
              </div>
            </div>
            {project.description && (
              <div className="flex flex-col gap-1">
                <span className="text-slate-500">Description</span>
                <span className="text-slate-900">{project.description}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Created</span>
              <span className="font-medium text-slate-900">{format(createdAtDate, 'MMMM d, yyyy')}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Last Updated</span>
              <span className="font-medium text-slate-900">
                {format(updatedAtDate, 'MMMM d, yyyy')} ({formatDistanceToNow(updatedAtDate, { addSuffix: true })})
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Project ID</span>
              <div className="flex items-center gap-2">
                <code className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-800">{project.id}</code>
                <button className="text-slate-400 hover:text-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded p-1 transition-colors">
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-teal-500" />
              <h2 className="text-lg font-semibold text-slate-800">Summary</h2>
            </div>
            <button
              onClick={handleQuickSummary}
              disabled={summaryLoading}
              className="flex items-center gap-1.5 rounded-lg bg-teal-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-teal-600 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors"
            >
              {summaryLoading ? (
                <><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />Đang tải...</>
              ) : (
                <><Sparkles className="h-4 w-4" />Quick Summary</>
              )}
            </button>
          </div>
          <p className="mb-4 text-xs text-slate-400">AI-generated summary of project activity for today.</p>
          <div className="min-h-[120px] rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            {summaryContent ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({ node: _n, ...props }) => <p className="mb-2 leading-relaxed last:mb-0" {...props} />,
                  ul: ({ node: _n, ...props }) => <ul className="list-disc pl-5 mb-2 space-y-1" {...props} />,
                  ol: ({ node: _n, ...props }) => <ol className="list-decimal pl-5 mb-2 space-y-1" {...props} />,
                  strong: ({ node: _n, ...props }) => <strong className="font-semibold text-slate-900" {...props} />,
                }}
              >
                {summaryContent}
              </ReactMarkdown>
            ) : (
              <p className="text-slate-400">Nhấn "Quick Summary" để tải tóm tắt AI cho hôm nay.</p>
            )}
          </div>
        </div>
      </div>

      {/* Right Column */}
      <div className="flex flex-col gap-6 lg:col-span-2">
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-800">Quick Stats</h2>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between rounded-lg bg-slate-50 p-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-indigo-500" />
                <span className="text-sm font-medium text-slate-700">Total Todos</span>
              </div>
              <span className="text-2xl font-bold text-slate-900">{todos.length}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-slate-50 p-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                <span className="text-sm font-medium text-slate-700">Completed</span>
              </div>
              <span className="text-2xl font-bold text-slate-900">{completedCount}</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-slate-500">Current Status</h2>
          <div className="mb-4 text-3xl font-bold text-emerald-600">{project.status || 'Active'}</div>
          <button className="flex w-full items-center justify-between rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors">
            Change Status
            <ChevronDown className="h-4 w-4 text-slate-400" />
          </button>
        </div>
      </div>
    </div>
  );
}

function TodosTab({ todos, setTodos, newTodoInput, setNewTodoInput, newTodoPriority, setNewTodoPriority, showCompleted, setShowCompleted }: any) {
  const activeTodos = todos.filter((t: Todo) => !t.completed);
  const completedTodos = todos.filter((t: Todo) => t.completed);
  const progress = todos.length === 0 ? 0 : Math.round((completedTodos.length / todos.length) * 100);

  const handleAdd = () => {
    if (!newTodoInput.trim()) return;
    setTodos([
      ...todos,
      { id: Date.now().toString(), text: newTodoInput, completed: false, priority: newTodoPriority }
    ]);
    setNewTodoInput('');
  };

  const toggleTodo = (id: string) => {
    setTodos(todos.map((t: Todo) => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const deleteTodo = (id: string) => {
    setTodos(todos.filter((t: Todo) => t.id !== id));
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm border border-slate-200">
        <input
          type="text"
          value={newTodoInput}
          onChange={(e) => setNewTodoInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="Add a new task..."
          className="flex-grow rounded-lg border-none bg-transparent px-2 text-sm focus:outline-none focus:ring-0"
        />
        <select
          value={newTodoPriority}
          onChange={(e) => setNewTodoPriority(e.target.value as Priority)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <button
          onClick={handleAdd}
          disabled={!newTodoInput.trim()}
          className="flex items-center gap-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
        >
          <Plus className="h-4 w-4" /> Add
        </button>
      </div>

      <div className="space-y-4">
        {activeTodos.length === 0 && completedTodos.length === 0 && (
          <div className="flex flex-col items-center justify-center p-12 text-slate-400">
            <CheckCircle2 className="mb-2 h-10 w-10 text-slate-300" />
            <p>No tasks yet. Add your first task above.</p>
          </div>
        )}

        <AnimatePresence>
          {activeTodos.map((todo: Todo) => (
            <TodoItem key={todo.id} todo={todo} onToggle={() => toggleTodo(todo.id)} onDelete={() => deleteTodo(todo.id)} />
          ))}
        </AnimatePresence>

        {completedTodos.length > 0 && (
          <div className="pt-4">
            <button
              onClick={() => setShowCompleted(!showCompleted)}
              className="mb-4 flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded p-1"
            >
              {showCompleted ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              Completed ({completedTodos.length})
            </button>
            <AnimatePresence>
              {showCompleted && completedTodos.map((todo: Todo) => (
                <TodoItem key={todo.id} todo={todo} onToggle={() => toggleTodo(todo.id)} onDelete={() => deleteTodo(todo.id)} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      <div className="rounded-xl bg-white p-4 shadow-sm border border-slate-200">
        <div className="mb-2 flex items-center justify-between text-sm font-medium text-slate-700">
          <span>{progress}% Completed</span>
          <span className="text-slate-500">{completedTodos.length} of {todos.length} tasks</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div className="h-full bg-teal-500 transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  );
}

function TodoItem({ todo, onToggle, onDelete }: { todo: Todo; onToggle: () => void; onDelete: () => void }) {
  const priorityColors = {
    low: 'bg-slate-100 text-slate-700',
    medium: 'bg-amber-100 text-amber-700',
    high: 'bg-red-100 text-red-700'
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover="hover"
      className={`group mb-2 flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition-all hover:border-slate-300 ${todo.completed ? 'opacity-60' : ''}`}
    >
      <div className="flex items-center gap-3 overflow-hidden">
        <button
          onClick={onToggle}
          className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 transition-colors ${
            todo.completed ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300 hover:border-indigo-500'
          }`}
        >
          {todo.completed && <CheckCircle2 className="h-3 w-3 text-white" />}
        </button>
        <span className={`truncate text-sm font-medium ${todo.completed ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
          {todo.text}
        </span>
        {todo.dueDate && (
          <span className={`ml-2 flex flex-shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${isPast(todo.dueDate) && !todo.completed ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-600'}`}>
            <Calendar className="h-3 w-3" />
            {format(todo.dueDate, 'MMM d')}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className={`rounded-md px-2 py-1 text-xs font-semibold uppercase tracking-wider ${priorityColors[todo.priority]}`}>
          {todo.priority}
        </span>
        <button
          onClick={onDelete}
          className="text-slate-400 opacity-0 group-hover:opacity-100 hover:text-red-500 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-red-500 rounded p-1 transition-all"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  );
}

function ProjectSummariesTab({ summaries }: { summaries: any[] }) {
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
      {summaries.map((summary: any, idx: number) => (
        <div key={idx} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-indigo-500" />
              {summary.summary_date || format(new Date(), 'yyyy-MM-dd')}
            </h3>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              {summary.status || 'Archived'}
            </span>
          </div>
          <div className="text-slate-700 bg-slate-50/50 p-4 rounded-lg border border-slate-100">
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              components={{
                table: ({ node, ...props }) => <div className="overflow-x-auto"><table className="w-full text-left border-collapse mt-4 mb-4 text-sm" {...props} /></div>,
                th: ({ node, ...props }) => <th className="bg-slate-100 font-semibold text-slate-700 px-4 py-2 border border-slate-300" {...props} />,
                td: ({ node, ...props }) => <td className="px-4 py-3 border border-slate-200 text-slate-600 leading-relaxed min-w-[120px]" {...props} />,
                p: ({ node, ...props }) => <p className="mt-3 mb-3 leading-relaxed" {...props} />,
                ul: ({ node, ...props }) => <ul className="list-disc pl-6 mt-3 mb-3 space-y-1" {...props} />,
                ol: ({ node, ...props }) => <ol className="list-decimal pl-6 mt-3 mb-3 space-y-1" {...props} />,
                h1: ({ node, ...props }) => <h1 className="text-xl font-bold mt-6 mb-3 text-slate-900" {...props} />,
                h2: ({ node, ...props }) => <h2 className="text-lg font-bold mt-5 mb-3 text-slate-800" {...props} />,
                h3: ({ node, ...props }) => <h3 className="text-base font-bold mt-4 mb-3 text-slate-800" {...props} />,
                strong: ({ node, ...props }) => <strong className="font-semibold text-slate-900" {...props} />,
                a: ({ node, ...props }) => <a className="text-indigo-600 hover:text-indigo-800 hover:underline font-medium" {...props} />,
                blockquote: ({ node, ...props }) => <blockquote className="border-l-4 border-indigo-200 pl-4 italic text-slate-600 my-4" {...props} />
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

function ProjectMessagesTab({ messages }: { messages: any[] }) {
  const [activeFilter, setActiveFilter] = useState<'all' | 'zalo' | 'whatsapp' | 'email'>('all');

  const getMessageCategory = (msg: any): 'zalo' | 'whatsapp' | 'email' | 'other' => {
    const provider = String(msg.channel?.provider || msg.channel || '').toLowerCase();
    if (provider.includes('zalo')) return 'zalo';
    if (provider.includes('whatsapp') || provider.includes('wa')) return 'whatsapp';
    if (provider.includes('email') || provider.includes('gmail')) return 'email';
    return 'other';
  };

  const filteredMessages = activeFilter === 'all' 
    ? messages 
    : messages.filter((m: any) => getMessageCategory(m) === activeFilter);

  return (
    <div className="w-full space-y-4">
      {/* Filters */}
      {messages && messages.length > 0 && (
        <div className="flex items-center gap-2 pb-4 pt-1 mb-2 border-b border-slate-200">
          <span className="text-sm font-medium text-slate-500 mr-2 uppercase tracking-wide">Filters:</span>
          {(['all', 'zalo', 'whatsapp', 'email'] as const).map(f => {
            const count = f === 'all' ? messages.length : messages.filter((m: any) => getMessageCategory(m) === f).length;
            
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

      {!messages || messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-slate-400">
          <MessageCircle className="mb-2 h-10 w-10 text-slate-300" />
          <p>No messages available.</p>
        </div>
      ) : filteredMessages.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-slate-400">
          <MessageCircle className="mb-2 h-10 w-10 text-slate-200" />
          <p>No messages found for this channel.</p>
        </div>
      ) : (
        filteredMessages.map((msg: any, idx: number) => {
          const receivedAt = msg.received_at ? new Date(msg.received_at) : new Date();
          const sender = msg.sender || msg.conversation?.name || 'Unknown User';
          return (
            <div key={idx} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex items-start gap-4 transition-colors hover:bg-slate-50">
              <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold uppercase 
                ${idx % 2 === 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-teal-100 text-teal-700'}`}>
                {sender.substring(0, 2)}
              </div>
              <div className="flex-grow min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-slate-900 truncate pr-4">{sender}</span>
                  <span className="flex-shrink-0 text-xs font-medium text-slate-400 whitespace-nowrap flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {format(receivedAt, 'MMM d, h:mm a')}
                  </span>
                </div>
                <div className="text-sm text-slate-700 whitespace-pre-wrap rounded-lg bg-indigo-50/30 p-3 mt-2 border border-slate-100 shadow-inner">
                  {msg.content || '*No content*'}
                </div>
                {msg.channel && msg.channel.provider && (
                  <div className="mt-3 text-xs font-semibold text-slate-500 inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1 uppercase tracking-wider">
                    {msg.channel.provider}
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
