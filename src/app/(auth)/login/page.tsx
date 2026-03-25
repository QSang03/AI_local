"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { login } from "@/lib/auth";
import { apiClient } from "@/lib/api-client";
import { useAuthStore, type AuthUser } from "@/store/auth-store";

export default function LoginPage() {
  const router = useRouter();
  const [from, setFrom] = useState('/projects');
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      setFrom(sp.get('from') || '/projects');
    } catch {
      setFrom('/projects');
    }
  }, []);
  const setUser = useAuthStore((state) => state.setUser);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // `from` state set from useEffect above

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    if (!email.trim() || !password.trim()) {
      setErrorMessage("Vui long nhap day du email va mat khau.");
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      const { data } = await apiClient.get<AuthUser>("/me");
      setUser(data);
      router.replace(from);
    } catch (error: unknown) {
      const status =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: { status?: number } }).response?.status === "number"
          ? (error as { response: { status: number } }).response.status
          : null;

      if (status === 400 || status === 401) {
        setErrorMessage("Sai email hoac mat khau.");
      } else {
        setErrorMessage("Khong the ket noi server. Vui long thu lai.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-10">
      <div className="grid w-full gap-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-300/40 md:grid-cols-2 md:p-10">
        <section>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            OpenClaw
          </p>
          <h1 className="mt-3 text-3xl font-black leading-tight text-slate-900 md:text-4xl">
            Sales Workflow Login
          </h1>
          <p className="mt-3 text-sm text-slate-600 md:text-base">
            Dang nhap de vao dashboard va tiep tuc quan ly inbox, project, va chat.
          </p>
        </section>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5"
        >
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-slate-700">Email</span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              placeholder="you@company.com"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none focus:border-slate-700"
              disabled={loading}
              required
            />
          </label>

          <label className="block space-y-1 text-sm">
            <span className="font-medium text-slate-700">Mat khau</span>
            <div className="flex items-center rounded-xl border border-slate-300 bg-white pr-2 focus-within:border-slate-700">
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type={showPassword ? "text" : "password"}
                placeholder="********"
                className="w-full rounded-xl px-3 py-2 outline-none"
                disabled={loading}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="px-2 text-xs font-semibold text-slate-600"
              >
                {showPassword ? "An" : "Hien"}
              </button>
            </div>
          </label>

          <div className="flex items-center justify-between">
            <Link href="/forgot-password" className="text-sm font-medium text-slate-700 hover:underline">
              Quen mat khau?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Dang dang nhap..." : "Dang nhap"}
          </button>

          {errorMessage ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {errorMessage}
            </p>
          ) : null}
        </form>
      </div>
    </div>
  );
}
