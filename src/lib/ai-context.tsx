"use client";

import React, { createContext, useContext, useEffect, useReducer } from "react";

export type AIStep =
  | "IDLE"
  | "CONNECTING"
  | "CONNECTED"
  | "PROCESSING"
  | "ERROR"
  | "DISCONNECTING";

export interface AIState {
  step: AIStep;
  sessionId: string | null;
  lastError: string | null;
  connectedAt: Date | null;
}

export type AIAction =
  | { type: "CONNECT_START" }
  | { type: "CONNECT_SUCCESS"; sessionId: string }
  | { type: "CONNECT_FAIL"; error: string }
  | { type: "DISCONNECT" }
  | { type: "DISCONNECT_DONE" }
  | { type: "TASK_START" }
  | { type: "TASK_DONE" }
  | { type: "RETRY" };

const initialState: AIState = {
  step: "IDLE",
  sessionId: null,
  lastError: null,
  connectedAt: null,
};

export function aiReducer(state: AIState, action: AIAction): AIState {
  switch (action.type) {
    case "CONNECT_START": {
      if (state.step !== "IDLE") return state;
      return { ...state, step: "CONNECTING", lastError: null };
    }

    case "CONNECT_SUCCESS": {
      // Allow success when coming from CONNECTING, or when restoring from storage (IDLE)
      if (state.step !== "CONNECTING" && state.step !== "IDLE") return state;
      return {
        ...state,
        step: "CONNECTED",
        sessionId: action.sessionId,
        lastError: null,
        connectedAt: new Date(),
      };
    }

    case "CONNECT_FAIL": {
      if (state.step !== "CONNECTING") return state;
      return { ...state, step: "ERROR", lastError: action.error };
    }

    case "DISCONNECT": {
      if (state.step !== "CONNECTED") return state;
      return { ...state, step: "DISCONNECTING" };
    }

    case "DISCONNECT_DONE": {
      if (state.step !== "DISCONNECTING") return state;
      return { ...initialState };
    }

    case "TASK_START": {
      if (state.step !== "CONNECTED") return state;
      return { ...state, step: "PROCESSING" };
    }

    case "TASK_DONE": {
      if (state.step !== "PROCESSING") return state;
      return { ...state, step: "CONNECTED" };
    }

    case "RETRY": {
      if (state.step !== "ERROR") return state;
      return { ...state, step: "CONNECTING", lastError: null };
    }

    default:
      return state;
  }
}

interface AIContextType extends AIState {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  triggerAITask: (payload: { type: string; data?: unknown }) => Promise<void>;
  retry: () => void;
}

export const AIContext = createContext<AIContextType | null>(null);

export function AIProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(aiReducer, initialState);

  useEffect(() => {
    const saved = sessionStorage.getItem("openclaw_ai_session");
    if (saved) {
      // restore session as CONNECTED
      dispatch({ type: "CONNECT_SUCCESS", sessionId: saved });
    }
  }, []);

  useEffect(() => {
    if (state.sessionId) sessionStorage.setItem("openclaw_ai_session", state.sessionId);
    else sessionStorage.removeItem("openclaw_ai_session");
  }, [state.sessionId]);

  const connect = async () => {
    dispatch({ type: "CONNECT_START" });
    try {
      const res = await fetch("/api/ai/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: (AbortSignal as { timeout?: (ms: number) => AbortSignal }).timeout 
          ? (AbortSignal as { timeout: (ms: number) => AbortSignal }).timeout(10000) 
          : undefined,
      });
      if (!res.ok) throw new Error(await res.text());
      const body = await res.json();
      const { sessionId } = body;
      if (!sessionId) throw new Error("No sessionId returned from /api/ai/connect");
      dispatch({ type: "CONNECT_SUCCESS", sessionId });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      dispatch({ type: "CONNECT_FAIL", error: message });
    }
  };

  const disconnect = async () => {
    dispatch({ type: "DISCONNECT" });
    try {
      await fetch("/api/ai/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: state.sessionId }),
      });
    } catch {
      // ignore errors on disconnect
    } finally {
      dispatch({ type: "DISCONNECT_DONE" });
    }
  };

  const triggerAITask = async (payload: { type: string; data?: unknown }) => {
    if (state.step !== "CONNECTED") return;
    dispatch({ type: "TASK_START" });
    try {
      await fetch("/api/ai/task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: state.sessionId, ...payload }),
      });
    } catch {
      // swallow task errors but could set lastError if desired
    } finally {
      dispatch({ type: "TASK_DONE" });
    }
  };

  const retry = () => dispatch({ type: "RETRY" });

  const value: AIContextType = {
    step: state.step,
    sessionId: state.sessionId,
    lastError: state.lastError,
    connectedAt: state.connectedAt,
    connect,
    disconnect,
    triggerAITask,
    retry,
  };

  return <AIContext.Provider value={value}>{children}</AIContext.Provider>;
}

export function useAI() {
  const ctx = useContext(AIContext);
  if (!ctx) throw new Error("useAI must be used inside AIProvider");
  return ctx;
}
