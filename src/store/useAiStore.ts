import { create } from 'zustand';
import { getAccessToken } from '@/lib/api-client';
import { wakeupChatSession } from '@/lib/api';

type AiStatus = "loading" | "ready" | "starting" | "stopped" | "not_exists" | "error";

interface AiState {
  aiStatus: AiStatus;
  wakingUp: boolean;
  connectWs: () => () => void; // returns cleanup fn
  wakeupSession: () => Promise<void>;
}

function buildWsUrl(): string {
  const apiBase = (process.env.NEXT_PUBLIC_API_BASE_URL ?? '').replace(/\/$/, '');
  // Convert http(s) -> ws(s)
  const wsBase = apiBase.replace(/^http/, 'ws');
  return `${wsBase}/chat/status/ws`;
}

let globalWs: WebSocket | null = null;
let globalReconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectCount = 0;

export const useAiStore = create<AiState>((set) => ({
  aiStatus: "loading",
  wakingUp: false,

  connectWs: () => {
    // Only connect if we don't already have an active or connecting socket
    if (globalWs && (globalWs.readyState === WebSocket.CONNECTING || globalWs.readyState === WebSocket.OPEN)) {
      return () => {}; // dummy cleanup since it's global
    }

    const connect = () => {
      if (globalWs) {
        globalWs.close();
      }

      try {
        const url = buildWsUrl();
        const token = getAccessToken();
        const fullUrl = token ? `${url}?token=${encodeURIComponent(token)}` : url;
        globalWs = new WebSocket(fullUrl);
      } catch {
        set({ aiStatus: 'error' });
        return;
      }

      globalWs.onopen = () => {
        reconnectCount = 0; // reset on success
      };

      globalWs.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string) as { status?: AiStatus };
          if (data.status) {
            set({ aiStatus: data.status });
          }
        } catch {
          // ignore parse errors
        }
      };

      globalWs.onerror = () => {
        set({ aiStatus: 'error' });
      };

      globalWs.onclose = () => {
        // Exponential backoff for reconnects to prevent spamming the backend
        const delay = Math.min(5000 * Math.pow(1.5, reconnectCount), 30000);
        reconnectCount++;
        
        if (globalReconnectTimer) clearTimeout(globalReconnectTimer);
        globalReconnectTimer = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      // For a global singleton, we might not want to close it on unmount if it's used globally.
      // But if we do, we need to clear the timer.
      // To keep it truly global and alive across page navigation within the app, we can just leave it open.
    };
  },

  wakeupSession: async () => {
    set({ wakingUp: true });
    try {
      await wakeupChatSession();
      set({ aiStatus: 'starting' });
      // Status will be updated automatically via WebSocket
    } catch {
      set({ aiStatus: 'error' });
    } finally {
      set({ wakingUp: false });
    }
  },
}));
