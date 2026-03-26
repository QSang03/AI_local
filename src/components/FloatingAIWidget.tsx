"use client";

import React, { useState } from "react";
import { Server, Power, PowerOff, RefreshCw, Cpu, Check } from "lucide-react";
import { useAI } from "@/lib/ai-context";

export default function FloatingAIWidget() {
  const { step, lastError, connect, disconnect, retry } = useAI();
  const [hoverDisconnect, setHoverDisconnect] = useState(false);
  const [openMobile, setOpenMobile] = useState(false);

  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  const getStatusDot = () => {
    switch (step) {
      case "CONNECTING":
        return "w-2 h-2 rounded-full bg-amber-400 animate-ping";
      case "CONNECTED":
        return "w-2 h-2 rounded-full bg-emerald-400 animate-pulse";
      case "PROCESSING":
        return "w-2 h-2 rounded-full bg-blue-400 animate-ping";
      case "ERROR":
        return "w-2 h-2 rounded-full bg-red-400";
      default:
        return "w-2 h-2 rounded-full bg-gray-400";
    }
  };

  const IconCircle = () => {
    const base = "w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center";
    switch (step) {
      case "CONNECTING":
        return (
          <div className={base}>
            <RefreshCw size={15} className="animate-spin text-amber-500" />
          </div>
        );
      case "CONNECTED":
        return (
          <div className={base}>
            <Server size={15} className="text-emerald-500" />
          </div>
        );
      case "PROCESSING":
        return (
          <div className={base}>
            <Cpu size={15} className="animate-pulse text-blue-500" />
          </div>
        );
      default:
        return (
          <div className={base}>
            <Server size={15} className="text-gray-500" />
          </div>
        );
    }
  };

  const subtitle = () => {
    switch (step) {
      case "CONNECTING":
        return { text: "Đang kết nối...", cls: "text-amber-500" };
      case "CONNECTED":
        return { text: "AI đang hoạt động", cls: "text-emerald-500" };
      case "PROCESSING":
        return { text: "Đang xử lý tác vụ...", cls: "text-blue-500" };
      case "ERROR":
        return { text: lastError || "Kết nối thất bại", cls: "text-red-500" };
      case "DISCONNECTING":
        return { text: "Đang ngắt kết nối...", cls: "text-gray-400" };
      default:
        return { text: "Hệ thống đang tạm ngưng", cls: "text-gray-400" };
    }
  };

  const ActionButton = () => {
    const sub = subtitle();
    if (step === "IDLE") {
      return (
        <button
          onClick={() => connect()}
          className="rounded-full h-9 px-4 text-[12px] font-medium bg-violet-600 hover:bg-violet-700 text-white flex items-center gap-1.5"
        >
          <Power size={13} />
          <span>Bật kết nối AI</span>
        </button>
      );
    }

    if (step === "CONNECTING") {
      return (
        <button className="rounded-full h-9 px-4 text-[12px] font-medium bg-gray-100 text-gray-400 opacity-60 flex items-center gap-1.5 cursor-not-allowed" disabled>
          <RefreshCw size={13} className="animate-spin" />
          <span>Đang kết nối...</span>
        </button>
      );
    }

    if (step === "CONNECTED" ) {
      return (
        <button
          onMouseEnter={() => setHoverDisconnect(true)}
          onMouseLeave={() => setHoverDisconnect(false)}
          onClick={() => disconnect()}
          className={`rounded-full h-9 px-4 text-[12px] font-medium flex items-center gap-1.5 transition-all duration-150 ${hoverDisconnect ? 'bg-red-50 text-red-500 border border-red-200' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'}`}
        >
          {hoverDisconnect ? <PowerOff size={13} /> : <Check size={13} />}
          <span>{hoverDisconnect ? 'Ngắt kết nối' : 'Đã kết nối'}</span>
        </button>
      );
    }

    if (step === "PROCESSING") {
      return (
        <button className="rounded-full h-9 px-4 text-[12px] font-medium bg-blue-50 text-blue-400 flex items-center gap-1.5 cursor-not-allowed" disabled>
          <RefreshCw size={13} className="animate-spin" />
          <span>Đang xử lý...</span>
        </button>
      );
    }

    if (step === "ERROR") {
      return (
        <button onClick={() => { retry(); connect(); }} className="rounded-full h-9 px-4 text-[12px] font-medium bg-red-50 text-red-500 border border-red-200 flex items-center gap-1.5">
          <RefreshCw size={13} />
          <span>Thử lại</span>
        </button>
      );
    }

    // DISCONNECTING
    return (
      <button className="rounded-full h-9 px-4 text-[12px] font-medium bg-gray-100 text-gray-400 opacity-60 flex items-center gap-1.5 cursor-not-allowed" disabled>
        <RefreshCw size={13} className="animate-spin" />
        <span>Đang ngắt...</span>
      </button>
    );
  };

  // Layout
  if (isMobile) {
    return (
      <div className="fixed top-5 right-5 z-[9999] md:hidden">
        <div className="relative">
          <button
            onClick={() => setOpenMobile((s) => !s)}
            className="w-12 h-12 rounded-full bg-white/90 backdrop-blur-sm border border-gray-100 shadow-lg flex items-center justify-center"
            aria-label="OpenClaw AI"
          >
            <div className="absolute -top-1 -right-1">
              <span className={getStatusDot()} />
            </div>
            <IconCircle />
          </button>

          {openMobile && (
            <div className="absolute right-0 top-14 w-72 rounded-2xl bg-white p-4 shadow-xl">
              <div className="flex items-center gap-3">
                <span className={getStatusDot()} />
                <IconCircle />
                <div className="flex-1">
                  <div className="text-[13px] font-semibold text-gray-800">OpenClaw AI Container</div>
                  <div className={`text-[11px] ${subtitle().cls}`}>{subtitle().text}</div>
                </div>
              </div>
              <div className="mt-3">
                <ActionButton />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed top-5 right-5 z-[9999] hidden md:block animate-in slide-in-from-right-5 duration-300">
      <div className="min-w-[340px] h-[52px] px-5 bg-white/90 backdrop-blur-sm rounded-full border border-gray-100 shadow-xl shadow-black/10 flex items-center gap-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-purple-100">
        <div className={getStatusDot()} />
        <IconCircle />
        <div className="flex flex-col flex-1">
          <div className="text-[13px] font-semibold text-gray-800 leading-tight">OpenClaw AI Container</div>
          <div className={`text-[11px] ${subtitle().cls}`}>{subtitle().text}</div>
        </div>
        <div className="w-px h-6 bg-gray-200 mx-1" />
        <div>
          <ActionButton />
        </div>
      </div>
    </div>
  );
}
