"use client";

import React from "react";
import { Power, Loader2 } from "lucide-react";
import useAiConnectionStore from "../../store/ai-connection-store";

export default function OpenClawFloatingWidget() {
  const { status, wakingUp, wakeup, checkStatus } = useAiConnectionStore();
  const connected = status === "ready";

  React.useEffect(() => {
    // call status once on initial mount (e.g., on full page load / F5)
    void checkStatus();
  }, [checkStatus]);

  return (
    <div className="fixed top-6 right-6 z-[999]">
      <div
        className="flex items-center gap-4 max-w-xs min-w-[220px] bg-white/90 backdrop-blur-md shadow-lg rounded-xl p-3 pr-4 dark:bg-slate-900/80"
        role="region"
        aria-label="OpenClaw AI Container"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="text-slate-500"
            >
              <path d="M12 2v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5 12a7 7 0 0014 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">OpenClaw AI Container</div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 hidden sm:block truncate">
            {status === "loading" && "Đang kiểm tra..."}
            {status === "ready" && "Đang hoạt động"}
            {status === "starting" && "Đang khởi động"}
            {status === "stopped" && "Hệ thống đang tạm ngưng"}
            {status === "not_exists" && "Container chưa được tạo"}
            {status === "error" && "Lỗi kết nối"}
          </div>
        </div>

        <div className="flex items-center">
          <button
            onClick={() => void (connected ? null : wakeup())}
            className={`flex items-center gap-2 px-3 py-2 rounded-md text-white transition-colors ${
              connected ? "bg-purple-700 hover:bg-purple-800" : "bg-purple-600 hover:bg-purple-700"
            }`}
            aria-pressed={connected}
            disabled={wakingUp}
          >
            {wakingUp ? <Loader2 size={16} className="animate-spin" /> : <Power size={16} />}
            <span className="hidden sm:inline text-sm">{connected ? "Tắt kết nối" : "Bật kết nối AI"}</span>
          </button>
        </div>
      </div>

      {/* Mobile compact button (smaller screens) */}
      <div className="sm:hidden mt-2 flex justify-end">
        <button
          onClick={() => void (connected ? null : wakeup())}
          className={`flex items-center gap-2 p-3 rounded-full text-white shadow-lg ${
            connected ? "bg-purple-700" : "bg-purple-600"
          }`}
          aria-label={connected ? "Tắt kết nối AI" : "Bật kết nối AI"}
          disabled={wakingUp}
        >
          {wakingUp ? <Loader2 size={16} className="animate-spin" /> : <Power size={16} />}
        </button>
      </div>
    </div>
  );
}
