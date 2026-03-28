"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { logout } from "@/lib/auth";
import { useRef, useState, useEffect } from "react";

import { 
  LayoutDashboard, 
  Layers, 
  Inbox, 
  Settings, 
  Users, 
  MessageSquare,
  LogOut,
  User as UserIcon,
  ChevronRight,
  ChevronLeft
} from "lucide-react";

const navItems = [
  { href: "/projects", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects/manage", label: "Manage Projects", icon: Layers },
  { href: "/inbox", label: "Unified Inbox", icon: Inbox },
  { href: "/channels", label: "Config Channel", icon: Settings },
  { href: "/users", label: "Manager User", icon: Users },
  { href: "/chat", label: "Chat Agent", icon: MessageSquare },
];

export function SideNav() {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const [open, setOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const profileRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved !== null) setIsCollapsed(saved === "true");
  }, []);

  const toggleSidebar = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    localStorage.setItem("sidebar-collapsed", String(next));
  };

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
    <aside className={`flex flex-col border-b border-slate-200 bg-[#1E293B] shrink-0 md:border-b-0 md:px-2 md:py-6 text-slate-300 transition-all duration-300 ease-in-out ${isCollapsed ? "w-full md:w-[68px]" : "w-full md:w-[260px]"}`}>
      <div className={`mb-8 flex ${isCollapsed ? "justify-center" : "justify-between px-4"} items-center`}>
        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-600/20 shrink-0">
          <span className="text-xl font-bold">O</span>
        </div>
        {!isCollapsed && (
          <div className="flex flex-col min-w-0 ml-3">
             <span className="text-sm font-bold text-white truncate uppercase tracking-wider">OpenClaw</span>
             <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">FE Workflow</span>
          </div>
        )}
        <button 
          onClick={toggleSidebar}
          className={`hidden md:flex ml-auto items-center justify-center w-6 h-6 rounded-full bg-slate-800 border border-slate-700 hover:bg-slate-700 transition shadow-sm ${!isCollapsed ? "rotate-0" : "absolute -right-3 top-10 z-50 bg-indigo-600 border-indigo-500"}`}
        >
          {isCollapsed ? <ChevronRight size={14} className="text-white" /> : <ChevronLeft size={14} />}
        </button>
      </div>
      <nav className={`grid grid-cols-2 gap-2 md:grid-cols-1 md:space-y-2 px-2 md:px-0`}>
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
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={isCollapsed ? item.label : ""}
                className={`group relative flex items-center rounded-xl p-3 transition-all duration-200 ${
                  active
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/40"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                } ${isCollapsed ? "justify-center" : "justify-start px-4 gap-3"}`}
              >
                <Icon size={22} strokeWidth={active ? 2.5 : 2} className="shrink-0" />
                {!isCollapsed && (
                  <span className="text-sm font-bold truncate transition-opacity duration-300">
                    {item.label}
                  </span>
                )}
                <span className="md:hidden ml-2">{item.label}</span>
                
                {/* Tooltip for desktop only when collapsed */}
                {isCollapsed && (
                  <div className="hidden md:block absolute left-full ml-4 px-2 py-1 bg-slate-900 text-white text-[11px] rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-[100] shadow-xl border border-slate-700">
                    {item.label}
                  </div>
                )}
              </Link>
            );
          });
        })()}
      </nav>
      <div className="hidden md:block mt-6 px-1">
        <div className="h-px bg-slate-800 w-full" />
      </div>

      <div className="mt-auto">
        <div className="relative">
          <div
            ref={profileRef}
            role="button"
            tabIndex={0}
            onClick={() => setOpen((v) => !v)}
            className={`group flex items-center rounded-xl p-1 transition-all duration-200 ${
              open ? "bg-slate-800" : "hover:bg-slate-800"
            } ${isCollapsed ? "justify-center" : "justify-start px-2 gap-3"}`}
          >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-sm font-bold text-white shadow-md ring-2 ring-slate-800 group-hover:ring-slate-700 transition-all">
              {user?.username ? user.username[0].toUpperCase() : "U"}
            </div>
            {!isCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-bold text-white truncate leading-tight">
                  {user?.username || "Unknown"}
                </span>
                <span className="text-[10px] text-slate-400 font-medium truncate">
                  View Profile
                </span>
              </div>
            )}
          </div>

          {/* Dropdown: drop-up */}
          <div
            className={`absolute left-full bottom-0 ml-3 z-[100] w-64 transform-gpu origin-bottom-left rounded-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-slate-100 ring-0 transition-all duration-200 ease-out ${
              open ? "opacity-100 scale-100 translate-x-0" : "opacity-0 scale-95 -translate-x-2 pointer-events-none"
            }`}
            style={{ willChange: "transform, opacity" }}
            aria-hidden={!open}
          >
            <div className="px-5 py-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-lg font-bold shadow-lg">
                  {user?.username ? user.username[0].toUpperCase() : "U"}
                </div>
                <div className="min-w-0">
                  <div className="text-base font-bold text-slate-900 truncate">
                    {user?.username || user?.email}
                  </div>
                  <div className="text-[12px] text-slate-500 truncate font-medium">
                    {user?.email}
                  </div>
                </div>
              </div>
            </div>
            <div className="h-px bg-slate-100" />
            <div className="p-2">
              <Link
                href="/profile"
                className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-indigo-600 rounded-xl transition-all"
                onClick={() => setOpen(false)}
              >
                <UserIcon size={18} className="opacity-70" />
                <span>Hồ sơ của tôi</span>
              </Link>
              <button
                type="button"
                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                onClick={() => {
                  setOpen(false);
                  void logout();
                }}
              >
                <LogOut size={18} className="opacity-70" />
                <span>Đăng xuất</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
