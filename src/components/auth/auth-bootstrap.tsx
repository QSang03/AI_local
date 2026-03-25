"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Loader from "@/components/ui/Loader";
import { restoreSession } from "@/lib/auth";
import { apiClient, setAccessToken, getAccessToken } from "@/lib/api-client";
import { useAuthStore, type AuthUser } from "@/store/auth-store";

export function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isReady = useAuthStore((state) => state.isReady);
  const setReady = useAuthStore((state) => state.setReady);
  const setUser = useAuthStore((state) => state.setUser);

  useEffect(() => {
    let ignore = false;

    async function init() {
      try {
        // If we already have an access token in memory (e.g. just logged in),
        // skip calling /auth/refresh. Only call restoreSession when the in-
        // memory token is missing (F5 / new tab scenario).
        if (!getAccessToken()) {
          const restored = await restoreSession();
          if (!restored) {
            setUser(null);
            if (!ignore) {
              router.replace(`/login?from=${encodeURIComponent(pathname || "/projects")}`);
            }
            return;
          }
        }

        const { data } = await apiClient.get<AuthUser>("/me");
        if (!ignore) {
          setUser(data);
        }
      } catch {
        setAccessToken(null);
        setUser(null);
        if (!ignore) {
          router.replace(`/login?from=${encodeURIComponent(pathname || "/projects")}`);
        }
      } finally {
        if (!ignore) {
          setReady(true);
        }
      }
    }

    void init();

    const onVisibilityChange = async () => {
      if (document.visibilityState !== "visible") return;
      // Only attempt restore when we don't have an in-memory token.
      if (getAccessToken()) return;
      try {
        const restored = await restoreSession();
        if (!restored) {
          setUser(null);
          router.replace("/login");
          return;
        }
        const { data } = await apiClient.get<AuthUser>("/me");
        setUser(data);
      } catch {
        setAccessToken(null);
        setUser(null);
        router.replace("/login");
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    const channel = new BroadcastChannel("auth");
    channel.onmessage = (event) => {
      if (event.data?.type === "LOGOUT") {
        setAccessToken(null);
        setUser(null);
        router.replace("/login");
      }
    };

    return () => {
      ignore = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      channel.close();
    };
  }, [pathname, router, setReady, setUser]);

  if (!isReady) {
    return (
      <div className="relative min-h-screen">
        <Loader />
      </div>
    );
  }

  return <>{children}</>;
}
