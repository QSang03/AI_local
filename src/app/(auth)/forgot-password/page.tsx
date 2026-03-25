"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { forgotPassword } from "@/lib/auth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    if (!email.trim()) {
      setErrorMessage("Vui long nhap email.");
      return;
    }

    setLoading(true);
    try {
      await forgotPassword(email);
      setSent(true);
    } catch {
      setErrorMessage("Khong gui duoc email reset. Vui long thu lai.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-xl items-center px-4 py-10">
        <div className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-bold text-slate-900">Kiem tra email</h1>
          <p className="mt-2 text-sm text-slate-600">
            Da gui link dat lai mat khau toi {email}. Neu khong thay email, vui long kiem tra spam hoac thu lai.
          </p>
          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setSent(false);
                setErrorMessage(null);
              }}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
            >
              Gui lai
            </button>
            <Link href="/login" className="text-sm font-semibold text-slate-900 hover:underline">
              Quay ve login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-xl items-center px-4 py-10">
      <form onSubmit={handleSubmit} className="w-full space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">Quen mat khau</h1>
        <p className="text-sm text-slate-600">Nhap email de nhan link dat lai mat khau.</p>

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

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {loading ? "Dang gui..." : "Gui email"}
        </button>

        {errorMessage ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {errorMessage}
          </p>
        ) : null}

        <Link href="/login" className="block text-center text-sm font-medium text-slate-700 hover:underline">
          Quay lai login
        </Link>
      </form>
    </div>
  );
}
