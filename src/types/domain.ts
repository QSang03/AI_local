export type MessageChannel = "email" | "zalo" | "whatsapp";

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Project {
  id: string;
  code: string;
  name: string;
  description?: string;
  ownerId?: string;
  ownerName: string;
  status: "new" | "active" | "urgent" | "closed";
  lastUpdateAt: string;
  unreadCount: number;
  summary: string;
  todoList: string[];
  latestTodo?: ProjectTodoListResponse;
}

export interface ProjectTodoItem {
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'done' | 'overdue' | string;
  priority: 'low' | 'medium' | 'high' | string;
}

export interface ProjectTodoListResponse {
  id: number;
  project_id: number;
  todo_date: string;
  status: string;
  items: ProjectTodoItem[];
  created_at?: string;
  updated_at?: string;
}

export interface ChannelConfig {
  id: number;
  user_id: number;
  provider: MessageChannel | string;
  status: string;
  auth_config: Record<string, unknown>;
  created_at: string;
}

export interface MessageThread {
  id: string;
  channel: MessageChannel;
  title: string;
  participants: string[];
  projectIds: string[];
  latestMessage: string;
  updatedAt: string;
}

export interface SaveChannelPayload {
  provider: MessageChannel | string;
  auth_config: Record<string, unknown>;
}

export interface ZaloStartLoginPayload {
  channel_id: number;
}

export interface ZaloStartLoginResponse {
  status?: string;
  session_id: string;
  ws_url: string;
}

export interface WhatsAppStartLoginPayload {
  channel_id: number;
}

export interface WhatsAppStartLoginResponse {
  status?: string;
  session_id: string;
  ws_url: string;
}

export interface AssignThreadPayload {
  threadId: string;
  projectIds: string[];
}

export type ChatRole = "sale" | "agent";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  fileIds?: string[];
}

export interface FileUploadRequest {
  content_type: string;
  filename: string;
  owner_id: number;
  size_bytes: number;
}

export interface FileUploadResponse {
  file_id: string;
  storage_path: string;
  upload_url: string;
}

export interface FileConfirmResponse {
  id: string;
  content_type: string;
  filename: string;
  owner_id: number;
  size_bytes: number;
  status: string;
  storage_path: string;
  created_at: string;
  updated_at: string;
}

export interface FileViewResponse {
  view_url: string;
}

export interface ProjectChatThread {
  projectId: string;
  projectName: string;
  messages: ChatMessage[];
}

export interface PlatformMessage {
  id: string;
  conversationId: string;
  channel: MessageChannel;
  senderId: string;
  senderDisplay: string;
  subject: string;
  snippet: string;
  content: string;
  bodyHtml?: string;
  receivedAt: string;
  projectIds: string[];
  mediaUrls?: string[];
  isIgnored?: boolean;
  isOutbound?: boolean;
  senderAvatarUrl?: string;
  // Optional fields to preserve raw backend payloads / identifiers
  externalId?: string;
  rawChannel?: Record<string, unknown> | null;
  rawConversation?: Record<string, unknown> | null;
  project?: {
    id: number | string;
    name: string;
  };
}

export interface InboxConversationSummary {
  id: string;
  channelId?: string;
  provider?: string;
  name: string;
  avatarUrl?: string;
  externalId?: string;
  type?: string;
  isIgnored?: boolean;
  createdAt?: string;
  updatedAt?: string;
  lastMessageAt?: string;
}

export interface BlacklistEntry {
  id: string;
  channel: MessageChannel;
  senderId: string;
  senderDisplay: string;
  reason: string;
  createdAt: string;
}

export interface OmniInboxData {
  messages: PlatformMessage[];
  blacklist: BlacklistEntry[];
  total?: number;
}

export interface SaveMessageProjectMappingPayload {
  messageIds: string[];
  projectIds: string[];
}

export interface AddBlacklistPayload {
  channel: MessageChannel;
  senderId: string;
  senderDisplay: string;
  reason: string;
}

export type AppUserRole = "admin" | "sale";

export interface AppUserAccount {
  id: number;
  username: string;
  email: string;
  role: AppUserRole | string;
  created_at: string;
}

export interface CreateUserPayload {
  username: string;
  email: string;
  password: string;
  role: AppUserRole | string;
}

export interface UpdateUserPayload {
  username?: string;
  email?: string;
  role?: AppUserRole | string;
  password?: string;
}
