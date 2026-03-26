import { SideNav } from "@/components/layout/side-nav";
import { AuthBootstrap } from "@/components/auth/auth-bootstrap";
import OpenClawAiWidget from "@/components/OpenClawAiWidget";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AuthBootstrap>
      <OpenClawAiWidget />
      <div className="min-h-screen md:flex min-w-0">
        <SideNav />
        <main className="flex-1 min-w-0 p-4 md:p-8">{children}</main>
      </div>
    </AuthBootstrap>
  );
}
