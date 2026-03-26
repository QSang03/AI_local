import { create } from "zustand";
import { getChatStatus, wakeupChatSession } from "@/lib/api";

type Status = "loading" | "ready" | "starting" | "stopped" | "not_exists" | "error";

type State = {
  status: Status;
  wakingUp: boolean;
  wakeup: () => Promise<void>;
  checkStatus: () => Promise<void>;
  setStatus: (s: Status) => void;
};

export const useAiConnectionStore = create<State>((set) => ({
  status: "loading",
  wakingUp: false,
  setStatus: (s: Status) => set({ status: s }),
  checkStatus: async () => {
    try {
      const res = await getChatStatus();
      set({ status: res.status });
    } catch {
      set({ status: "error" });
    }
  },
  wakeup: async () => {
    set({ wakingUp: true, status: "starting" });
    try {
      // Call wakeup endpoint and await its completion. The endpoint will resolve when startup completes.
      await wakeupChatSession();
      // If the endpoint resolves successfully, mark ready (backend may have already started)
      set({ status: "ready", wakingUp: false });
    } catch {
      set({ status: "error", wakingUp: false });
    }
  },
}));

export default useAiConnectionStore;
