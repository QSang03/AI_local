import {
  AddBlacklistPayload,
  AppUserAccount,
  AssignThreadPayload,
  BlacklistEntry,
  ChannelConfig,
  CreateUserPayload,
  MessageThread,
  InboxConversationSummary,
  OmniInboxData,
  Project,
  ProjectChatThread,
  ProjectTodoItem,
  ProjectTodoListResponse,
  SaveMessageProjectMappingPayload,
  SaveChannelPayload,
  ZaloStartLoginResponse,
  WhatsAppStartLoginResponse,
  UpdateUserPayload,
  FileUploadRequest,
  FileUploadResponse,
  FileConfirmResponse,
  FileViewResponse,
  PlatformMessage,
} from "@/types/domain";
import { getAccessToken } from "@/lib/api-client";
import {
  mockBlacklistEntries,
  mockChannelConfigs,
  mockPlatformMessages,
  mockProjects,
  mockThreads,
} from "@/lib/mock-data";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");
const AUTH_BASE_URL = (
  process.env.NEXT_PUBLIC_BACKEND_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  ""
).replace(/\/$/, "");
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== "false";

interface MutationResult {
  ok: boolean;
  message: string;
}

interface ChannelMutationResult extends MutationResult {
  channel?: ChannelConfig;
}

function parseApiErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    const match = error.message.match(/\{[\s\S]*\}$/);
    if (match) {
      try {
        const body = JSON.parse(match[0]) as { error?: string; message?: string };
        return body.error ?? body.message ?? fallback;
      } catch {
        return fallback;
      }
    }
  }

  return fallback;
}

function buildUrl(path: string) {
  if (!API_BASE_URL) {
    return path;
  }
  return `${API_BASE_URL}${path}`;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };

  try {
    const token = getAccessToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  } catch {
    // getAccessToken may not be available server-side; ignore
  }

  // When running on the server (SSR / server components) forward incoming
  // cookies so backend can validate the session cookie. We load next/headers
  // dynamically to avoid bundling it into client-side code.
  if (typeof window === 'undefined') {
    try {
      // dynamic import to keep client bundle clean
      const nextHeaders = await import('next/headers');
      const cookiesFn = (nextHeaders as { cookies?: () => Promise<{ toString?: () => string } | undefined> }).cookies;
      if (typeof cookiesFn === 'function') {
        const cookieStore = await cookiesFn();
        // `cookieStore.toString()` is available in Next.js request cookies
        const cookieString = cookieStore?.toString?.() ?? '';
        if (cookieString) {
          headers['cookie'] = cookieString;
        }
      }
    } catch {
      // ignore — only matters when running inside Next.js server runtime
    }
  }

  // If running on the server and there's no Authorization header, try to
  // exchange the incoming session cookie for a short-lived access token by
  // calling the backend `/auth/refresh` endpoint. This makes server-side
  // requests behave similarly to the browser where the refresh cookie is
  // sent automatically.
  if (typeof window === 'undefined' && !headers['Authorization'] && AUTH_BASE_URL) {
    try {
      const refreshRes = await fetch(`${AUTH_BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(headers['cookie'] ? { cookie: headers['cookie'] } : {}),
        },
      });

      if (refreshRes.ok) {
        const data = await refreshRes.json().catch(() => ({}));
        const nextToken = data?.access_token ?? data?.accessToken ?? data?.token;
        if (nextToken) {
          headers['Authorization'] = `Bearer ${nextToken}`;
        }
      }
      // if refresh failed, we'll continue and let the main request return 401
    } catch {
      // ignore — let main request surface the error
    }
  }

  const response = await fetch(buildUrl(path), {
    ...init,
    // include credentials so browser sends HttpOnly cookies (refresh token)
    credentials: "include",
    headers,
    cache: "no-store",
  });

  // If we received 401 server-side, try a single refresh+retry before failing.
  if (!response.ok && response.status === 401 && typeof window === 'undefined' && AUTH_BASE_URL) {
    // avoid retry loops by marking the request
    const alreadyRefreshed = (init?.headers as Record<string, string> | undefined)?.['x-refreshed'] === '1';
    if (!alreadyRefreshed) {
      try {
        const refreshRes = await fetch(`${AUTH_BASE_URL}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...(headers['cookie'] ? { cookie: headers['cookie'] } : {}),
          },
        });

        if (refreshRes.ok) {
          const data = await refreshRes.json().catch(() => ({}));
          const nextToken = data?.access_token ?? data?.accessToken ?? data?.token;
          if (nextToken) {
            // set auth header and retry original request
            headers['Authorization'] = `Bearer ${nextToken}`;
            const retryRes = await fetch(buildUrl(path), {
              ...init,
              credentials: 'include',
              headers: { ...(init?.headers as Record<string, string> | undefined || {}), ...headers, 'x-refreshed': '1' },
              cache: 'no-store',
            });

            if (retryRes.ok) {
              return (await retryRes.json()) as T;
            }
            // fall through to error handling for retryRes
            // replace response with retryRes for diagnostic message
            // (we'll use retryRes below)
          }
        }
      } catch {
        // ignore and fall through to original error handling
      }
    }
  }

  if (!response.ok) {
    // If unauthenticated while rendering on the server, redirect to login
    if (response.status === 401 && typeof window === 'undefined') {
      try {
        const nav = (await import('next/navigation')) as { redirect?: (href: string) => never };
        // Redirect to login page. Keep simple; callers may add `from` param if desired.
        nav.redirect?.('/login');
        // redirect() may throw to stop further execution; if it doesn't, fail with a rejected promise.
        return Promise.reject(new Error('redirecting to login')) as unknown as T;
      } catch {
        // If redirect couldn't be performed (non-Next runtime), fall through to error
      }
    }
    // Try to read error body for more context
    let bodyText = '';
    try {
      bodyText = await response.text();
    } catch {
      /* ignore */
    }
    const err = new Error(`Request failed: ${response.status} ${response.statusText} ${bodyText}`);
    // Attach status for callers that want to handle 401 specially
    (err as unknown as { status?: number }).status = response.status;
    throw err;
  }

  return (await response.json()) as T;
}

export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export async function getProjects(params?: { page?: number; pageSize?: number; q?: string; ownerId?: string }): Promise<PagedResult<Project>> {
  const page = params?.page ?? 1;
  const pageSize = params?.pageSize ?? 20;
  if (API_BASE_URL) {
    // Call backend /projects and map results; propagate errors to caller.
    const raw = await requestJson<unknown[]>(`/projects`);
    const mapped: Project[] = (raw || []).map((r) => {
      const typed = r as Record<string, unknown>;
      const owner = typed.owner as Record<string, unknown> | undefined;
      const ownerId = owner && owner.id ? String(owner.id) : (typed.owner_id ? String(typed.owner_id) : '');
      const ownerName = owner && (typeof owner.username === 'string' || typeof owner.name === 'string')
        ? String(owner.username ?? owner.name)
        : String(typed.ownerName ?? '');

      return {
        id: String(typed.id ?? ''),
        code: String(typed.code ?? typed.id ?? ''),
        name: String(typed.name ?? ''),
        description: String(typed.description ?? ''),
        ownerId,
        ownerName,
        status: (String(typed.status) as Project['status']) ?? 'new',
        lastUpdateAt: String(typed.updated_at ?? typed.created_at ?? new Date().toISOString()),
        unreadCount: Number(typed.unreadCount ?? 0),
        summary: String(typed.quick_summary ?? typed.summary ?? ''),
        todoList: Array.isArray(typed.todoList) ? (typed.todoList as string[]) : [],
        latestTodo: (typed.latest_todo as ProjectTodoListResponse | undefined),
      };
    });

    // filtering
    let filtered = mapped;
    if (params?.q) {
      const q = params.q.toLowerCase();
      filtered = filtered.filter((p) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q) || p.ownerName.toLowerCase().includes(q));
    }
    if (params?.ownerId) {
      filtered = filtered.filter((p) => p.ownerId === String(params.ownerId));
    }

    const total = filtered.length;
    const items = filtered.slice((page - 1) * pageSize, page * pageSize);
    return { items, total, page, pageSize };
  }

  // No API base configured — fail loudly so frontend is aware backend is required.
  throw new Error('No API_BASE_URL configured for projects');
}

export async function createProject(payload: { name: string; description?: string }): Promise<Project> {
  if (API_BASE_URL) {
    // Return whatever backend returns (could be message or created project)
    return await requestJson<Project>("/projects", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  throw new Error('No API_BASE_URL configured for createProject');
}

export async function updateProject(id: string | number, payload: { name?: string; description?: string; status?: string }): Promise<Project> {
  if (API_BASE_URL) {
    const res = await requestJson<Project>(`/projects/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    // If backend returned the updated project, map and return it
    if (res && typeof res === 'object' && 'id' in res) {
      const rObj = res as unknown as Record<string, unknown>;
      const ownerId = rObj['owner_id'] ? String(rObj['owner_id']) : (rObj['owner'] && typeof rObj['owner'] === 'object' && 'id' in (rObj['owner'] as Record<string, unknown>) ? String((rObj['owner'] as Record<string, unknown>)['id']) : '');
      const mapped: Project = {
        id: String(rObj['id']),
        code: (rObj['code'] ?? String(rObj['id'])) as string,
        name: String(rObj['name'] ?? ''),
        description: String(rObj['description'] ?? ''),
        ownerId: ownerId,
        ownerName: String((rObj['owner'] && typeof rObj['owner'] === 'object' ? ((rObj['owner'] as Record<string, unknown>)['username'] ?? (rObj['owner'] as Record<string, unknown>)['name']) : rObj['ownerName']) ?? ''),
        status: (String(rObj['status'] ?? 'new') as Project['status']),
        lastUpdateAt: String(rObj['updated_at'] ?? rObj['created_at'] ?? new Date().toISOString()),
        unreadCount: Number(rObj['unreadCount'] ?? 0),
        summary: String(rObj['summary'] ?? ''),
        todoList: Array.isArray(rObj['todoList']) ? (rObj['todoList'] as string[]) : [],
      };
      return mapped;
    }
    // Otherwise return raw response (message)
    return res;
  }

  throw new Error('No API_BASE_URL configured for updateProject');
}

export async function deleteProject(id: string | number) {
  if (API_BASE_URL) {
    return await requestJson<{ message?: string }>(`/projects/${id}`, {
      method: "DELETE",
    });
  }

  throw new Error('No API_BASE_URL configured for deleteProject');
}

// Owners endpoints (autocomplete / list)
export type Owner = { id: string; name: string; email?: string; avatarUrl?: string };
export async function getOwners(params?: { q?: string; page?: number; pageSize?: number }): Promise<PagedResult<Owner>> {
  const page = params?.page ?? 1;
  const pageSize = params?.pageSize ?? 10;
  // Try calling backend owners endpoint. Some deployments expose it at `/owners`,
  // others behind a proxy at `/api/owners`. Try both and if both fail return
  // an empty paged result so the autocomplete gracefully shows no suggestions.
  if (API_BASE_URL) {
    const qs = new URLSearchParams();
    if (params?.q) qs.set('q', params.q);
    qs.set('page', String(page));
    qs.set('pageSize', String(pageSize));
    const paths = [`/owners?${qs.toString()}`, `/api/owners?${qs.toString()}`];
    for (const pth of paths) {
      try {
        return await requestJson<PagedResult<Owner>>(pth);
      } catch {
        // try next
      }
    }
  }

  // If backend not configured or both endpoints failed, return empty result
  return { items: [], total: 0, page, pageSize };
}

export async function getChannelConfigs(): Promise<ChannelConfig[]> {
  if (!USE_MOCK && API_BASE_URL) {
    try {
      return await requestJson<ChannelConfig[]>("/channels");
    } catch {
      // Fallback to mock to keep FE unblocked when backend is not ready.
    }
  }

  await delay(180);
  return mockChannelConfigs;
}

// Get project details by id (raw response from backend). Caller should handle errors.
export async function getProjectById(id: string | number): Promise<Project> {
  if (API_BASE_URL) {
    return await requestJson<Project>(`/projects/${id}`);
  }
  throw new Error('No API_BASE_URL configured for getProjectById');
}

export interface ProjectSummaryResponse {
  id: number;
  project_id: number;
  type: string;
  status: string;
  content: string;
  summary_date?: string;
  created_at?: string;
}

export async function getProjectSummary(
  projectId: string | number,
  date?: string,
): Promise<ProjectSummaryResponse | null> {
  if (!API_BASE_URL) {
    throw new Error('No API_BASE_URL configured for getProjectSummary');
  }

  const params = new URLSearchParams();
  if (date && date.trim().length > 0) {
    params.set('date', date.trim());
  }
  const query = params.toString();
  const path = `/projects/${projectId}/summary${query ? `?${query}` : ''}`;

  try {
    return await requestJson<ProjectSummaryResponse>(path);
  } catch {
    return null;
  }
}

export async function getProjectSummariesList(
  projectId: string | number,
  limit: number = 50,
  offset: number = 0
): Promise<ProjectSummaryResponse[]> {
  if (!API_BASE_URL) return [];
  try {
    const qs = new URLSearchParams();
    qs.set("limit", String(limit));
    qs.set("offset", String(offset));
    return await requestJson<ProjectSummaryResponse[]>(`/projects/${projectId}/summaries?${qs.toString()}`);
  } catch {
    return [];
  }
}

export async function getProjectMessagesList(
  projectId: string | number,
  limit: number = 50,
  offset: number = 0
): Promise<PlatformMessage[]> {
  if (!API_BASE_URL) return [];
  try {
    const qs = new URLSearchParams();
    qs.set("limit", String(limit));
    qs.set("offset", String(offset));
    return await requestJson<PlatformMessage[]>(`/projects/${projectId}/messages?${qs.toString()}`);
  } catch {
    return [];
  }
}


export async function getProjectTodoList(
  projectId: string | number,
  date?: string,
): Promise<ProjectTodoListResponse | null> {
  if (!API_BASE_URL) {
    return null;
  }

  try {
    const url = `/projects/${projectId}/todo-list${date ? `?date=${date}` : ""}`;
    return await requestJson<ProjectTodoListResponse>(url);
  } catch {
    return null;
  }
}

export async function updateProjectTodoItemStatus(
  projectId: string | number,
  itemIndex: number,
  status: string,
): Promise<MutationResult> {
  if (!API_BASE_URL) {
    return { ok: false, message: "API not configured" };
  }

  try {
    const res = await requestJson<{ message?: string }>(`/projects/${projectId}/todo-list/items`, {
      method: "PATCH",
      body: JSON.stringify({ item_index: itemIndex, status }),
    });
    return {
      ok: true,
      message: res?.message ?? "Trang thai task da duoc cap nhat.",
    };
  } catch (error) {
    return {
      ok: false,
      message: parseApiErrorMessage(error, "Khong cap nhat duoc trang thai task."),
    };
  }
}

export async function getThreads(): Promise<MessageThread[]> {
  if (!USE_MOCK && API_BASE_URL) {
    try {
      return await requestJson<MessageThread[]>("/threads");
    } catch {
      // Fallback to mock to keep FE unblocked when backend is not ready.
    }
  }

  await delay(180);
  return mockThreads;
}

export async function saveChannelConfig(
  payload: SaveChannelPayload,
): Promise<ChannelMutationResult> {
  if (!USE_MOCK && API_BASE_URL) {
    try {
      const created = await requestJson<ChannelConfig>("/channels", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      return {
        ok: true,
        message: "Tao channel thanh cong.",
        channel: created,
      };
    } catch (error) {
      return {
        ok: false,
        message: parseApiErrorMessage(error, "Khong tao duoc channel. Vui long kiem tra thong tin."),
      };
    }
  }

  await delay(280);
  const now = new Date();
  return {
    ok: true,
    message: "Da tao channel trong mock mode.",
    channel: {
      id: Date.now(),
      user_id: 42,
      provider: payload.provider,
      status: "active",
      auth_config: payload.auth_config,
      created_at: now.toISOString().slice(0, 19).replace("T", " "),
    },
  };
}

export async function deleteChannelConfig(id: number): Promise<MutationResult> {
  if (!USE_MOCK && API_BASE_URL) {
    try {
      await requestJson<Record<string, string>>(`/channels/${id}`, {
        method: "DELETE",
      });

      return {
        ok: true,
        message: "Da xoa channel.",
      };
    } catch (error) {
      return {
        ok: false,
        message: parseApiErrorMessage(error, "Khong xoa duoc channel."),
      };
    }
  }

  await delay(120);
  return {
    ok: true,
    message: "Da xoa channel trong mock mode.",
  };
}

export async function startZaloQrLogin(
  channelId: number,
): Promise<{ ok: boolean; message: string; data?: ZaloStartLoginResponse }> {
  if (!USE_MOCK && API_BASE_URL) {
    try {
      const data = await requestJson<ZaloStartLoginResponse>("/channels/zalo/start-login", {
        method: "POST",
        body: JSON.stringify({ channel_id: channelId }),
      });

      return {
        ok: true,
        message: "Da tao phien QR login cho Zalo.",
        data,
      };
    } catch (error) {
      return {
        ok: false,
        message: parseApiErrorMessage(error, "Khong the bat dau Zalo QR login."),
      };
    }
  }

  await delay(180);
  return {
    ok: true,
    message: "Dang o mock mode: da tao session QR ao.",
    data: {
      status: "success",
      session_id: `mock-${channelId}-${Date.now()}`,
      ws_url: "ws://localhost:3000/ws/mock-zalo-login",
    },
  };
}

export async function startWhatsAppQrLogin(
  channelId: number,
): Promise<{ ok: boolean; message: string; data?: WhatsAppStartLoginResponse }> {
  if (!USE_MOCK && API_BASE_URL) {
    try {
      const data = await requestJson<WhatsAppStartLoginResponse>("/channels/whatsapp/start-login", {
        method: "POST",
        body: JSON.stringify({ channel_id: channelId }),
      });

      return {
        ok: true,
        message: "Da tao phien QR login cho WhatsApp.",
        data,
      };
    } catch (error) {
      return {
        ok: false,
        message: parseApiErrorMessage(error, "Khong the bat dau WhatsApp QR login."),
      };
    }
  }

  await delay(180);
  return {
    ok: true,
    message: "Dang o mock mode: da tao session QR ao.",
    data: {
      status: "success",
      session_id: `mock-${channelId}-${Date.now()}`,
      ws_url: "ws://localhost:3000/ws/mock-whatsapp-login",
    },
  };
}

export async function getUsers(): Promise<AppUserAccount[]> {
  if (!USE_MOCK && API_BASE_URL) {
    return await requestJson<AppUserAccount[]>("/users");
  }

  await delay(150);
  return [
    {
      id: 1,
      username: "quocduong",
      email: "duong@example.com",
      role: "admin",
      created_at: "2026-03-21 09:00:00",
    },
  ];
}

export async function getUserById(id: number): Promise<AppUserAccount> {
  if (!USE_MOCK && API_BASE_URL) {
    return await requestJson<AppUserAccount>(`/users/${id}`);
  }

  const users = await getUsers();
  const found = users.find((u) => u.id === id);
  if (!found) {
    throw new Error("User not found");
  }
  return found;
}

export async function createUser(payload: CreateUserPayload): Promise<MutationResult> {
  if (!USE_MOCK && API_BASE_URL) {
    try {
      const res = await requestJson<{ message?: string }>("/users", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      return {
        ok: true,
        message: res?.message ?? "Tao user thanh cong.",
      };
    } catch (error) {
      return {
        ok: false,
        message: parseApiErrorMessage(error, "Khong tao duoc user."),
      };
    }
  }

  await delay(180);
  return {
    ok: true,
    message: "Da tao user trong mock mode.",
  };
}

export async function updateUser(id: number, payload: UpdateUserPayload): Promise<MutationResult> {
  console.log('[DEBUG] updateUser target ID:', id, 'payload:', payload);
  if (!USE_MOCK && API_BASE_URL) {
    console.log('[DEBUG] Calling REAL API: PUT /users/' + id);
    try {
      const res = await requestJson<{ message?: string }>(`/users/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      console.log('[DEBUG] API Response:', res);
      return {
        ok: true,
        message: res?.message ?? "Cap nhat user thanh cong.",
      };
    } catch (error) {
      console.error('[DEBUG] API Error:', error);
      return {
        ok: false,
        message: parseApiErrorMessage(error, "Khong cap nhat duoc user."),
      };
    }
  }

  console.log('[DEBUG] Falling back to MOCK mode (USE_MOCK:', USE_MOCK, 'API_BASE_URL:', API_BASE_URL, ')');
  await delay(140);
  return {
    ok: true,
    message: "Da cap nhat user trong mock mode.",
  };
}

export async function deleteUser(id: number): Promise<MutationResult> {
  if (!USE_MOCK && API_BASE_URL) {
    try {
      const res = await requestJson<{ message?: string }>(`/users/${id}`, {
        method: "DELETE",
      });
      return {
        ok: true,
        message: res?.message ?? "Da xoa user.",
      };
    } catch (error) {
      return {
        ok: false,
        message: parseApiErrorMessage(error, "Khong xoa duoc user."),
      };
    }
  }

  await delay(120);
  return {
    ok: true,
    message: "Da xoa user trong mock mode.",
  };
}

export async function assignThreadToProjects(
  payload: AssignThreadPayload,
): Promise<MutationResult> {
  if (!USE_MOCK && API_BASE_URL) {
    try {
      return await requestJson<MutationResult>("/marking/assign", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    } catch {
      return {
        ok: false,
        message: "Backend tam thoi khong san sang. Vui long thu lai.",
      };
    }
  }

  await delay(220);
  return {
    ok: true,
    message: `Da gan ${payload.threadId} vao ${payload.projectIds.length} project`,
  };
}

export async function getProjectChats(): Promise<ProjectChatThread[]> {
  if (!USE_MOCK && API_BASE_URL) {
    try {
      const sessions = await getChatSessions();
      return sessions.map((session) => ({
        projectId: String(session.project_id),
        projectName: session.name,
        messages: [],
      }));
    } catch {
      return [];
    }
  }

  // Chat messages are provided in real-time by the chat-bridge (WebSocket).
  // Do not return mock chat threads here; start with an empty list.
  return [];
}

export async function sendProjectChatMessage(payload: {
  projectId: string;
  content: string;
}): Promise<MutationResult> {
  if (!USE_MOCK && API_BASE_URL) {
    try {
      return await requestJson<MutationResult>("/chat/send", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    } catch {
      return {
        ok: false,
        message: "Khong gui duoc tin nhan toi backend. Dang dung local mode.",
      };
    }
  }

  await delay(150);
  return { ok: true, message: "Da gui tin nhan trong local mode." };
}

export async function getProjectAIOutput(projectId: string): Promise<{ summary: string; todoList?: string[]; latestTodo?: ProjectTodoListResponse }> {
  if (!USE_MOCK && API_BASE_URL) {
    // Try the newer `/summary` endpoint first (matches API spec),
    // fall back to legacy `/ai` path for compatibility.
    try {
      try {
        const data = await requestJson<Record<string, unknown>>(`/projects/${projectId}/summary`);
        const summary = String(data.quick_summary ?? data.summary ?? data.content ?? "");
        const rawTodoList = data.todoList ?? data.todo_list;
        const todoList = Array.isArray(rawTodoList) ? (rawTodoList as string[]) : undefined;
        const latestTodo = (data.latestTodo ?? data.latest_todo) as ProjectTodoListResponse | undefined;
        return { summary, todoList, latestTodo };
      } catch {
        // If `/summary` not found, try legacy `/ai` endpoint
        const data2 = await requestJson<{ summary?: string; todoList?: string[]; latestTodo?: ProjectTodoListResponse }>(`/projects/${projectId}/ai`);
        return { 
          summary: data2.summary ?? "", 
          todoList: Array.isArray(data2.todoList) ? data2.todoList : undefined, 
          latestTodo: data2.latestTodo 
        };
      }
    } catch {
      return { summary: "" };
    }
  }

  // Mock: find summary/todoList from mockProjects if available
  await delay(200);
  const p = mockProjects.find((x) => x.id === projectId);
  if (p) {
    return { summary: p.summary, todoList: p.todoList ?? [] };
  }

  return { summary: "" };
}

export interface OmniInboxQuery {
  provider?: string;
  conversation_id?: string;
  include_ignored?: boolean;
  limit?: number;
  offset?: number;
}

export interface InboxConversationsQuery {
  channel_id?: number;
  provider?: string;
  include_ignored?: boolean;
  limit?: number;
  offset?: number;
}

export interface InboxMessagesQuery {
  provider?: string;
  conversation_id?: string | number;
  include_ignored?: boolean;
  limit?: number;
  offset?: number;
}

function normalizeInboxMessage(input: unknown): OmniInboxData["messages"][number] {
  const item = input as Record<string, unknown>;
  const projectIdsRaw = item.projectIds ?? item.project_ids ?? [];
  const projectIdSingle = item.project_id ?? (item.project && typeof item.project === "object" ? (item.project as Record<string, unknown>).id : undefined);
  const projectIdsFromList = Array.isArray(projectIdsRaw)
    ? projectIdsRaw.map((id: unknown) => String(id))
    : [];
  const projectIds = [
    ...new Set([
      ...projectIdsFromList,
      ...(projectIdSingle !== undefined && projectIdSingle !== null ? [String(projectIdSingle)] : []),
    ]),
  ];

  const rawChannelObj =
    item.channel && typeof item.channel === "object"
      ? (item.channel as Record<string, unknown>)
      : undefined;
  const rawConversationObj =
    item.conversation && typeof item.conversation === "object"
      ? (item.conversation as Record<string, unknown>)
      : undefined;

  const rawProviderVal = rawChannelObj?.provider ?? item.provider ?? item.channel ?? item.chan ?? "email";
  const rawProvider = String(rawProviderVal ?? "email");
  const channelMapped = rawProvider.includes("zalo")
    ? ("zalo" as OmniInboxData["messages"][number]["channel"])
    : rawProvider.includes("whatsapp")
      ? ("whatsapp" as OmniInboxData["messages"][number]["channel"])
      : ("email" as OmniInboxData["messages"][number]["channel"]);

  const convId = rawConversationObj?.id ?? item.conversationId ?? item.conversation_id ?? item.id ?? "";
  const senderRaw = item.sender ?? item.senderId ?? item.sender_id ?? item.srcId ?? "unknown";
  const senderDisplay = item.senderDisplay ?? item.sender_display ?? senderRaw ?? "Unknown";
  const externalId = String(item.external_id ?? item.externalId ?? (item.externalId === 0 ? "0" : undefined) ?? "");

  const payloadObj = item.payload && typeof item.payload === "object" ? (item.payload as Record<string, unknown>) : {};
  const emailBodyHtml = String(
    item.body_html ?? item.bodyHtml ?? payloadObj.body_html ?? payloadObj.bodyHtml ?? "",
  ).trim();
  const normalizedContent =
    emailBodyHtml && channelMapped === "email" ? "" : String(item.content ?? item.snippet ?? "");
  const mediaUrls: string[] | undefined = Array.isArray(payloadObj.media_urls)
    ? payloadObj.media_urls.map((u: unknown) => String(u))
    : undefined;

  const isIgnored = typeof rawConversationObj?.is_ignored === "boolean" ? rawConversationObj.is_ignored : undefined;
  const isOutbound = typeof item.is_outbound === "boolean" ? item.is_outbound : (typeof payloadObj.is_me === "boolean" ? payloadObj.is_me : undefined);

  return {
    id: String(item.id ?? ""),
    conversationId: String(convId),
    channel: channelMapped,
    senderId: String(senderRaw ?? "unknown"),
    senderDisplay: String(senderDisplay ?? "Unknown"),
    subject: String(item.subject ?? ""),
    snippet: String(item.snippet ?? item.subject ?? ""),
    content: normalizedContent,
    bodyHtml: emailBodyHtml || undefined,
    receivedAt: String(item.receivedAt ?? item.received_at ?? ""),
    projectIds,
    mediaUrls,
    isIgnored,
    isOutbound,
    senderAvatarUrl: payloadObj.sender_avatar_url ? String(payloadObj.sender_avatar_url) : undefined,
    externalId: externalId || undefined,
    rawChannel: rawChannelObj ?? null,
    rawConversation: rawConversationObj ?? null,
    project: item.project
      ? {
          id: String((item.project as { id: number | string; name: string }).id),
          name: String((item.project as { id: number | string; name: string }).name),
        }
      : undefined,
  };
}

function normalizeInboxConversation(input: unknown): InboxConversationSummary {
  const item = input as Record<string, unknown>;
  const channelObj =
    item.channel && typeof item.channel === "object"
      ? (item.channel as Record<string, unknown>)
      : undefined;
  const conversationObj =
    item.conversation && typeof item.conversation === "object"
      ? (item.conversation as Record<string, unknown>)
      : undefined;

  return {
    id: String(conversationObj?.id ?? item.id ?? ""),
    channelId: item.channel_id !== undefined ? String(item.channel_id) : undefined,
    provider: String(channelObj?.provider ?? item.provider ?? ""),
    name: String(conversationObj?.name ?? item.name ?? item.subject ?? item.external_id ?? ""),
    avatarUrl: conversationObj?.avatar_url ? String(conversationObj.avatar_url) : (item.avatar_url ? String(item.avatar_url) : undefined),
    externalId: conversationObj?.external_id ? String(conversationObj.external_id) : (item.external_id ? String(item.external_id) : undefined),
    type: conversationObj?.type ? String(conversationObj.type) : (item.type ? String(item.type) : undefined),
    isIgnored: typeof conversationObj?.is_ignored === "boolean" ? conversationObj.is_ignored : (typeof item.is_ignored === "boolean" ? item.is_ignored : undefined),
    createdAt: conversationObj?.created_at ? String(conversationObj.created_at) : (item.created_at ? String(item.created_at) : undefined),
    updatedAt: conversationObj?.updated_at ? String(conversationObj.updated_at) : (item.updated_at ? String(item.updated_at) : undefined),
    lastMessageAt: conversationObj?.last_message_at ? String(conversationObj.last_message_at) : (item.last_message_at ? String(item.last_message_at) : undefined),
  };
}

export async function getInboxConversations(query?: InboxConversationsQuery): Promise<{
  items: InboxConversationSummary[];
  total?: number;
}> {
  if (!USE_MOCK && API_BASE_URL) {
    const qs = new URLSearchParams();
    if (query?.channel_id !== undefined) qs.set("channel_id", String(query.channel_id));
    if (query?.provider) qs.set("provider", String(query.provider));
    if (query?.include_ignored !== undefined) qs.set("include_ignored", String(query.include_ignored));
    if (typeof query?.limit === "number") qs.set("limit", String(query.limit));
    if (typeof query?.offset === "number") qs.set("offset", String(query.offset));

    const raw = await requestJson<unknown>(`/conversations${qs.toString() ? `?${qs.toString()}` : ""}`);
    const rawObject = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const listRaw = Array.isArray(raw)
      ? raw
      : Array.isArray(rawObject.items)
        ? (rawObject.items as unknown[])
        : Array.isArray(rawObject.conversations)
          ? (rawObject.conversations as unknown[])
          : [];
    const total = Number(rawObject.total ?? rawObject.count ?? rawObject.total_count ?? listRaw.length);
    return {
      items: listRaw.map(normalizeInboxConversation),
      total: Number.isNaN(total) ? undefined : total,
    };
  }

  await delay(120);
  const grouped = new Map<string, typeof mockPlatformMessages>();
  for (const msg of mockPlatformMessages) {
    const arr = grouped.get(msg.conversationId) ?? [];
    arr.push(msg);
    grouped.set(msg.conversationId, arr);
  }
  const convs = Array.from(grouped.entries())
    .map(([conversationId, items]) => {
      const latest = [...items].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))[0];
      return {
        id: conversationId,
        name: latest.subject || latest.snippet || latest.senderDisplay || conversationId,
        provider:
          latest.channel === "zalo"
            ? "zalo_personal"
            : latest.channel === "whatsapp"
              ? "whatsapp_personal"
              : "email",
        lastMessageAt: latest.receivedAt,
        isIgnored: false,
      } as InboxConversationSummary;
    })
    .sort((a, b) => String(b.lastMessageAt ?? "").localeCompare(String(a.lastMessageAt ?? "")));

  const filtered = query?.provider ? convs.filter((c) => c.provider === query.provider) : convs;
  const limit = query?.limit ?? 20;
  const offset = query?.offset ?? 0;
  return {
    items: filtered.slice(offset, offset + limit),
    total: filtered.length,
  };
}

export async function getInboxMessages(query?: InboxMessagesQuery): Promise<{
  items: OmniInboxData["messages"];
  total?: number;
}> {
  if (!USE_MOCK && API_BASE_URL) {
    const qs = new URLSearchParams();
    if (query?.provider) qs.set("provider", String(query.provider));
    if (query?.conversation_id !== undefined) qs.set("conversation_id", String(query.conversation_id));
    if (query?.include_ignored !== undefined) qs.set("include_ignored", String(query.include_ignored));
    if (typeof query?.limit === "number") qs.set("limit", String(query.limit));
    if (typeof query?.offset === "number") qs.set("offset", String(query.offset));
    const raw = await requestJson<unknown>(`/messages${qs.toString() ? `?${qs.toString()}` : ""}`);
    const rawObject = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const listRaw = Array.isArray(raw)
      ? raw
      : Array.isArray(rawObject.messages)
        ? (rawObject.messages as unknown[])
        : Array.isArray(rawObject.items)
          ? (rawObject.items as unknown[])
          : [];
    const total = Number(rawObject.total ?? rawObject.count ?? rawObject.total_count ?? listRaw.length);
    return {
      items: listRaw.map(normalizeInboxMessage),
      total: Number.isNaN(total) ? undefined : total,
    };
  }

  await delay(120);
  let items = [...mockPlatformMessages];
  if (query?.provider) {
    items = items.filter((m) => {
      const provider =
        m.channel === "zalo" ? "zalo_personal" : m.channel === "whatsapp" ? "whatsapp_personal" : "email";
      return provider === query.provider;
    });
  }
  if (query?.conversation_id !== undefined) {
    items = items.filter((m) => String(m.conversationId) === String(query.conversation_id));
  }
  items.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  const offset = query?.offset ?? 0;
  const limit = query?.limit ?? 20;
  return {
    items: items.slice(offset, offset + limit),
    total: items.length,
  };
}

export async function getOmniInboxData(query?: OmniInboxQuery): Promise<OmniInboxData> {
  if (!USE_MOCK && API_BASE_URL) {
    try {
      const qs = new URLSearchParams();
      if (query?.provider) qs.set("provider", String(query.provider));
      if (query?.conversation_id) qs.set("conversation_id", String(query.conversation_id));
      if (query?.include_ignored !== undefined) qs.set("include_ignored", String(query.include_ignored));
      if (typeof query?.limit === "number") qs.set("limit", String(query.limit));
      if (typeof query?.offset === "number") qs.set("offset", String(query.offset));
      const qsStr = qs.toString();
      const raw = await requestJson<unknown>(`/messages${qsStr ? `?${qsStr}` : ""}`);

      const normalizeBlacklist = (input: unknown): OmniInboxData["blacklist"][number] => {
        const item = input as Record<string, unknown>;
        const rawChan = (item.channel && typeof item.channel === 'object') ? (item.channel as Record<string, unknown>) : undefined;
        const providerVal = rawChan?.provider ?? item.channel ?? item.provider ?? 'email';
        const chanMapped = String(providerVal).includes('zalo')
          ? 'zalo'
          : String(providerVal).includes('whatsapp')
          ? 'whatsapp'
          : 'email';

        return {
          id: String(item.id ?? ""),
          channel: chanMapped as OmniInboxData["blacklist"][number]["channel"],
          senderId: String(item.senderId ?? item.sender_id ?? "unknown"),
          senderDisplay: String(item.senderDisplay ?? item.sender_display ?? "Unknown"),
          reason: String(item.reason ?? ""),
          createdAt: String(item.createdAt ?? item.created_at ?? ""),
        };
      };

      const rawObject = raw as Record<string, unknown>;
      const messageListRaw = Array.isArray(raw)
        ? raw
        : Array.isArray(rawObject.messages)
          ? (rawObject.messages as unknown[])
          : Array.isArray(rawObject.items)
            ? (rawObject.items as unknown[])
            : [];

      const blacklistRaw = Array.isArray(rawObject.blacklist)
        ? (rawObject.blacklist as unknown[])
        : [];

      const total = Number(rawObject.total ?? rawObject.count ?? rawObject.total_count ?? (Array.isArray(raw) ? raw.length : undefined));

      return {
        messages: messageListRaw.map(normalizeInboxMessage),
        blacklist: blacklistRaw.map(normalizeBlacklist),
        total: Number.isNaN(total) ? undefined : total,
      };
    } catch {
      // Fallback to mock to keep FE unblocked when backend is not ready.
    }
  }

  await delay(180);
  return {
    messages: mockPlatformMessages,
    blacklist: mockBlacklistEntries,
  };
}

export async function saveMessageProjectMapping(
  payload: SaveMessageProjectMappingPayload,
): Promise<MutationResult> {
  if (!USE_MOCK && API_BASE_URL) {
    try {
      const projectIdsNumber = payload.projectIds.map(id => {
        const num = parseInt(id, 10);
        return isNaN(num) ? id : num;
      });

      const promises = payload.messageIds.map(msgId =>
        requestJson<MutationResult>(`/messages/${msgId}/mark`, {
          method: "POST",
          body: JSON.stringify({ project_ids: projectIdsNumber }),
        })
      );

      await Promise.all(promises);

      return {
        ok: true,
        message: "operation successful",
      };
    } catch {
      return {
        ok: false,
        message: "Không thể lưu mapping lúc này. Vui lòng thử lại.",
      };
    }
  }

  await delay(220);
  return {
    ok: true,
    message: `Da cap nhat ${payload.messageIds.length} tin nhan vao ${payload.projectIds.length} project`,
  };
}

export async function addBlacklistEntry(
  payload: AddBlacklistPayload,
): Promise<MutationResult & { entry?: BlacklistEntry }> {
  if (!USE_MOCK && API_BASE_URL) {
    try {
      return await requestJson<MutationResult & { entry?: BlacklistEntry }>("/inbox/blacklist", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    } catch {
      return {
        ok: false,
        message: "Khong the them blacklist luc nay.",
      };
    }
  }

  await delay(180);
  return {
    ok: true,
    message: `Da them ${payload.senderDisplay} vao blacklist`,
    entry: {
      id: `bl-${Date.now()}`,
      channel: payload.channel,
      senderId: payload.senderId,
      senderDisplay: payload.senderDisplay,
      reason: payload.reason,
      createdAt: new Date().toISOString().slice(0, 16).replace("T", " "),
    },
  };
}

export async function removeBlacklistEntry(entryId: string): Promise<MutationResult> {
  if (!USE_MOCK && API_BASE_URL) {
    try {
      return await requestJson<MutationResult>(`/inbox/blacklist/${entryId}`, {
        method: "DELETE",
      });
    } catch {
      return {
        ok: false,
        message: "Khong the xoa blacklist luc nay.",
      };
    }
  }

  await delay(120);
  return {
    ok: true,
    message: "Da xoa khoi blacklist",
  };
}

export async function ignoreConversation(id: string, is_ignored: boolean): Promise<MutationResult> {
  if (!USE_MOCK && API_BASE_URL) {
    try {
      await requestJson<MutationResult>(`/conversations/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_ignored }),
      });
      return { ok: true, message: `Thành công` };
    } catch {
      return { ok: false, message: "Không thể thay đổi trạng thái lúc này." };
    }
  }
  await delay(150);
  return { ok: true, message: `Thành công` };
}

export async function requestFileUploadUrl(
  payload: FileUploadRequest,
): Promise<FileUploadResponse> {
  if (!USE_MOCK && API_BASE_URL) {
    return await requestJson<FileUploadResponse>("/files/upload", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  // Mock response
  await delay(100);
  return {
    file_id: `file-${Date.now()}`,
    storage_path: `pending/file-${Date.now()}_${payload.filename}`,
    upload_url: `http://minio:9000/pta-files/pending/${payload.filename}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=...`,
  };
}

export async function confirmFileUpload(fileId: string): Promise<FileConfirmResponse> {
  if (!USE_MOCK && API_BASE_URL) {
    return await requestJson<FileConfirmResponse>(`/files/${fileId}/confirm`, {
      method: "POST",
    });
  }

  // Mock response
  await delay(100);
  return {
    id: fileId,
    content_type: "application/octet-stream",
    filename: "file.bin",
    owner_id: 1,
    size_bytes: 0,
    status: "active",
    storage_path: `active/${fileId}_file.bin`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export async function getFileViewUrl(fileId: string): Promise<string> {
  if (!USE_MOCK && API_BASE_URL) {
    try {
      const response = await requestJson<FileViewResponse>(`/files/${fileId}/view`, {
        method: "GET",
      });
      return response.view_url;
    } catch {
      throw new Error("Khong the lay URL xem file.");
    }
  }

  // Mock response
  return `http://minio:9000/pta-files/active/${fileId}?X-Amz-Algorithm=...`;
}

export interface ChatSession {
  created_at: string;
  id: string;
  name: string;
  openclaw_session_id: string;
  parent_session_id: string;
  project?: {
    id: number;
    name: string;
    description?: string;
    quick_summary?: string;
    status?: string;
    created_at?: string;
    updated_at?: string;
  };
  project_id: number;
  type: string;
  updated_at: string;
  user_id: number;
}

export interface ChatSessionMessage {
  id: string;
  session_id?: string;
  content: string;
  role: string;
  createdAt: string;
}

export async function getChatSessionMessages(
  sessionId: string,
  params?: { limit?: number; offset?: number },
): Promise<ChatSessionMessage[]> {
  if (!USE_MOCK && API_BASE_URL) {
    try {
      const query = new URLSearchParams();
      if (params?.limit !== undefined) query.set("limit", String(params.limit));
      if (params?.offset !== undefined) query.set("offset", String(params.offset));
      const qs = query.toString();
      const raw = await requestJson<unknown[]>(`/chat/sessions/${encodeURIComponent(sessionId)}/messages${qs ? `?${qs}` : ""}`);
      return (raw || []).map((item) => {
        const obj = item as Record<string, unknown>;
        return {
          id: String(obj.id ?? ""),
          session_id: obj.session_id ? String(obj.session_id) : undefined,
          content: String(obj.content ?? ""),
          role: String(obj.role ?? "assistant"),
          createdAt: String(obj.created_at ?? obj.createdAt ?? ""),
        };
      });
    } catch {
      return [];
    }
  }

  return [];
}

export async function getChatSessions(params?: {
  projectId?: number;
  limit?: number;
  offset?: number;
}): Promise<ChatSession[]> {
  if (!USE_MOCK && API_BASE_URL) {
    const query = new URLSearchParams();
    if (typeof params?.projectId === "number") query.set("project_id", String(params.projectId));
    if (typeof params?.limit === "number") query.set("limit", String(params.limit));
    if (typeof params?.offset === "number") query.set("offset", String(params.offset));
    const qs = query.toString();
    return await requestJson<ChatSession[]>(`/chat/sessions${qs ? `?${qs}` : ""}`, {
      method: "GET"
    });
  }
  return [];
}

export async function getChatStatus(): Promise<{ status: "ready" | "starting" | "stopped" | "not_exists" }> {
  if (!USE_MOCK && API_BASE_URL) {
    return await requestJson<{ status: "ready" | "starting" | "stopped" | "not_exists" }>("/chat/status", {
      method: "GET"
    });
  }
  return { status: "not_exists" };
}

export async function wakeupChatSession(): Promise<{ status: string }> {
  if (!USE_MOCK && API_BASE_URL) {
    return await requestJson<{ status: string }>("/chat/wakeup", {
      method: "POST"
    });
  }
  return { status: "ready" };
}
