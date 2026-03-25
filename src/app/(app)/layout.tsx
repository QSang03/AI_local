import { SideNav } from "@/components/layout/side-nav";
import { AuthBootstrap } from "@/components/auth/auth-bootstrap";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AuthBootstrap>
      <div className="min-h-screen md:flex">
        <SideNav />
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </AuthBootstrap>
  );
}
