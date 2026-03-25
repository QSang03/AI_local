import axios from "axios";
import { apiClient, setAccessToken } from "@/lib/api-client";

const AUTH_API_BASE_URL = (
  process.env.NEXT_PUBLIC_BACKEND_URL ??
  ""
).replace(/\/$/, "");

export async function login(email: string, password: string) {
  const { data } = await apiClient.post("/auth/login", { email, password });
  setAccessToken(data.access_token ?? null);
  return data;
}

export async function logout() {
  await apiClient.post("/auth/logout");
  setAccessToken(null);

  if (typeof window !== "undefined") {
    const channel = new BroadcastChannel("auth");
    channel.postMessage({ type: "LOGOUT" });
    channel.close();
    window.location.href = "/login";
  }
}

export async function forgotPassword(email: string) {
  const { data } = await apiClient.post("/auth/forgot-password", { email });
  return data;
}

export async function resetPassword(token: string, newPassword: string) {
  const { data } = await apiClient.post("/auth/reset-password", {
    token,
    new_password: newPassword,
  });
  return data;
}

export async function restoreSession(): Promise<boolean> {
  // NOTE: `restoreSession` calls the `/auth/refresh` endpoint using
  // credentials (HttpOnly cookie). This should only be called in two
  // scenarios:
  // 1) App startup (mount / F5) when the in-memory `accessToken` was lost
  //    but the browser still has the `refresh_token` cookie. Call once
  //    to restore the access token and continue the session.
  // 2) When an API request receives 401 and the interceptor triggers a
  //    refresh to obtain a new access token and retry the failed request.
  //
  // IMPORTANT: Do NOT call `restoreSession` immediately after a successful
  // `login()` — the login response already returns an `access_token` and the
  // browser sets the `refresh_token` cookie. Calling refresh there is
  // redundant and wastes a network request.
  try {
    const { data } = await axios.post(
      `${AUTH_API_BASE_URL}/auth/refresh`,
      {},
      { withCredentials: true },
    );
    setAccessToken(data.access_token ?? null);
    return Boolean(data.access_token);
  } catch {
    setAccessToken(null);
    return false;
  }
}
