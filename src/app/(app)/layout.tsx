"use client";

import { usePathname } from "next/navigation";
import { SideNav } from "@/components/layout/side-nav";
import { AuthBootstrap } from "@/components/auth/auth-bootstrap";
import OpenClawAiWidget from "@/components/OpenClawAiWidget";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname() || "";
  
  // Only maintain edge-to-edge (no padding) for the Unified Inbox.
  // The Chat Agent page and others now get consistent padding to avoid touching the sidebar.
  const isFullScreenPage = pathname === "/inbox";
  
  return (
    <AuthBootstrap>
      <OpenClawAiWidget />
      <div className="min-h-screen md:flex min-w-0 bg-[#F8FAFC]">
        <SideNav />
        <main 
          className={`flex-1 min-w-0 transition-all duration-300 ${
            isFullScreenPage 
              ? "p-0 h-screen overflow-hidden" 
              : "p-4 md:p-8 overflow-y-auto"
          }`}
        >
          <div className={`${isFullScreenPage ? "h-full" : "w-full"}`}>
            {children}
          </div>
        </main>
      </div>
    </AuthBootstrap>
  );
}
