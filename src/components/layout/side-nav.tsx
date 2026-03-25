"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { logout } from "@/lib/auth";
import { useRef, useState, useEffect } from "react";

const navItems = [
  { href: "/projects", label: "Dashboard" },
  { href: "/projects/manage", label: "Manage Projects" },
  { href: "/inbox", label: "Unified Inbox" },
  { href: "/channels", label: "Config Channel" },
  { href: "/users", label: "Manager User" },
  { href: "/marking", label: "Marking" },
  { href: "/chat", label: "Chat Agent" },
  { href: "/profile", label: "Profile" },
];

export function SideNav() {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const [open, setOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!profileRef.current) return;
      if (e.target instanceof Node && !profileRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  return (
    <aside className="flex flex-col w-full border-b border-slate-200 bg-white/70 px-4 py-3 backdrop-blur md:w-72 md:min-h-screen md:border-b-0 md:border-r md:px-5 md:py-6">
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          OpenClaw FE
        </p>
        <p className="text-lg font-bold text-slate-900">Sales Workflow</p>
      </div>
      <nav className="grid grid-cols-2 gap-2 md:grid-cols-1">
        {(() => {
          const visibleNavItems = navItems.filter(
            (it) => it.href !== "/users" || user?.role === "admin",
          );

          // Determine the best (most specific) matching nav item so that
          // parent paths (e.g. '/projects') don't stay highlighted when a
          // more specific child path (e.g. '/projects/manage') is active.
          let matches = visibleNavItems.filter((it) => pathname === it.href || pathname.startsWith(it.href + "/"));

          // Treat single-segment project detail (e.g. /projects/4) as part of Manage Projects
          if (pathname.startsWith('/projects/') && pathname.split('/').length === 3) {
            // ensure '/projects/manage' is considered a match
            const manageItem = visibleNavItems.find((it) => it.href === '/projects/manage');
            if (manageItem) matches = [...matches, manageItem];
          }

          const bestMatch = matches.sort((a, b) => b.href.length - a.href.length)[0]?.href;

          return visibleNavItems.map((item) => {
            const active = item.href === bestMatch || pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-xl px-3 py-2 text-center text-sm font-medium transition md:text-left ${
                  active
                    ? "bg-slate-900 text-white shadow-lg shadow-slate-400/30"
                    : "text-slate-700 hover:bg-slate-200/70"
                }`}
              >
                {item.label}
              </Link>
            );
          });
        })()}
      </nav>
      <div className="mt-6 rounded-xl border border-slate-200 bg-slate-100/70 p-3">
        <p className="text-xs font-medium text-slate-600">Scope hien tai</p>
        <p className="mt-1 text-sm text-slate-800">
          Da mo chat frontend local mode. Se noi BE o phase sau.
        </p>
      </div>

      <div className="mt-auto">
        <div className="relative">
          <div
            ref={profileRef}
            role="button"
            tabIndex={0}
            onClick={() => setOpen((v) => !v)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") setOpen((v) => !v);
            }}
            className={`group flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 transition-colors duration-150 ${
              open ? "bg-white/6" : "hover:bg-white/8"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-teal-600 to-blue-500 text-sm font-bold text-white">
                {user?.username ? user.username[0].toUpperCase() : "U"}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900">{user?.username || user?.email || "Unknown"}</div>
                <div className="text-xs text-slate-600 opacity-70">{user?.role || "N/A"}</div>
              </div>
            </div>
            <svg
              className={`h-4 w-4 text-slate-600 transition-transform duration-150 ${open ? "rotate-180" : "rotate-0"}`}
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          {/* Dropdown: drop-up */}
          <div
            className={`absolute right-0 bottom-full mb-3 z-50 w-56 transform-gpu origin-bottom-right rounded-xl bg-white shadow-[0_-4px_24px_rgba(0,0,0,0.12)] ring-0 transition-all duration-150 ease-out ${
              open ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 -translate-y-1 pointer-events-none"
            }`}
            style={{ willChange: "transform, opacity" }}
            aria-hidden={!open}
          >
            <div className="px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-600 to-blue-500 text-white text-base font-bold">
                  {user?.username ? user.username[0].toUpperCase() : "U"}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900">{user?.username || user?.email}</div>
                  <div className="text-xs text-slate-500 truncate opacity-70">{user?.email}</div>
                </div>
              </div>
            </div>
            <div className="border-t border-[#f0f0f0]" />
            <div className="py-2">
              <a
                href="/profile"
                className="flex items-center gap-3 px-3 py-2 text-sm text-slate-700 hover:bg-[#f5f5f5] rounded-md transition-colors duration-100"
                onClick={() => setOpen(false)}
              >
                <span className="text-lg opacity-70">👤</span>
                <span>Hồ sơ của tôi</span>
              </a>
            </div>
            <div className="border-t border-[#f0f0f0]" />
            <div className="py-2">
              <button
                type="button"
                className="flex w-full items-center gap-3 px-3 py-2 text-sm text-[#ef4444] hover:bg-[#fef2f2] rounded-md transition-colors duration-100"
                onClick={() => {
                  setOpen(false);
                  void logout();
                }}
              >
                <span className="text-lg opacity-70">🚪</span>
                <span>Đăng xuất</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
