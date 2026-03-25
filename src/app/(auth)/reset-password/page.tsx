"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { resetPassword } from "@/lib/auth";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [token, setToken] = useState('');
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      setToken(sp.get('token') || '');
    } catch {
      setToken('');
    }
  }, []);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!token) {
      setErrorMessage("Token reset khong hop le.");
      return;
    }

    if (newPassword.length < 8) {
      setErrorMessage("Mat khau moi phai co it nhat 8 ky tu.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("Xac nhan mat khau khong khop.");
      return;
    }

    setLoading(true);
    try {
      await resetPassword(token, newPassword);
      setSuccessMessage("Dat lai mat khau thanh cong. Dang chuyen ve login...");
      setTimeout(() => {
        router.replace("/login");
      }, 1200);
    } catch {
      setErrorMessage("Khong the dat lai mat khau. Link co the da het han.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-xl items-center px-4 py-10">
      <form onSubmit={handleSubmit} className="w-full space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">Dat lai mat khau</h1>

        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700">Mat khau moi</span>
          <div className="flex items-center rounded-xl border border-slate-300 bg-white pr-2 focus-within:border-slate-700">
            <input
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              type={showPassword ? "text" : "password"}
              className="w-full rounded-xl px-3 py-2 outline-none"
              disabled={loading}
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

        <label className="block space-y-1 text-sm">
          <span className="font-medium text-slate-700">Xac nhan mat khau moi</span>
          <input
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            type={showPassword ? "text" : "password"}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none focus:border-slate-700"
            disabled={loading}
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {loading ? "Dang dat lai..." : "Dat lai mat khau"}
        </button>

        {errorMessage ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {errorMessage}
          </p>
        ) : null}

        {successMessage ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {successMessage}
          </p>
        ) : null}

        <Link href="/login" className="block text-center text-sm font-medium text-slate-700 hover:underline">
          Quay lai login
        </Link>
      </form>
    </div>
  );
}
