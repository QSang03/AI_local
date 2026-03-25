"use client";

import { FormEvent, useEffect, useState } from "react";
import { useProfile } from "@/hooks/use-profile";
import { useAuthStore } from "@/store/auth-store";

export default function ProfilePage() {
  const user = useAuthStore((state) => state.user);
  const { getProfile, updateProfile, changePassword } = useProfile();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  useEffect(() => {
    setUsername(user?.username ?? "");
    setEmail(user?.email ?? "");
  }, [user]);

  useEffect(() => {
    if (!user) {
      void getProfile();
    }
  }, [getProfile, user]);

  async function handleSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileMessage(null);

    if (!email.trim() || !username.trim()) {
      setProfileMessage("Vui long nhap day du ten hien thi va email.");
      return;
    }

    setProfileLoading(true);
    try {
      await updateProfile({ email: email.trim(), username: username.trim() });
      setProfileMessage("Da luu thong tin ca nhan.");
    } catch {
      setProfileMessage("Khong the cap nhat profile. Vui long thu lai.");
    } finally {
      setProfileLoading(false);
    }
  }

  async function handleChangePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordMessage(null);

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setPasswordMessage("Vui long nhap day du thong tin doi mat khau.");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordMessage("Mat khau moi phai co it nhat 8 ky tu.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordMessage("Xac nhan mat khau moi khong khop.");
      return;
    }

    setPasswordLoading(true);
    try {
      await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setPasswordMessage("Doi mat khau thanh cong.");
    } catch {
      setPasswordMessage("Khong doi duoc mat khau. Vui long kiem tra lai mat khau hien tai.");
    } finally {
      setPasswordLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Tai khoan cua toi</h1>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Thong tin ca nhan</h2>
        <form onSubmit={handleSaveProfile} className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Ten hien thi</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Email</span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Role</span>
            <input
              value={user?.role || ""}
              readOnly
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-600"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Ngay tao</span>
            <input
              value={user?.created_at || ""}
              readOnly
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-600"
            />
          </label>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={profileLoading}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {profileLoading ? "Dang luu..." : "Luu thay doi"}
            </button>
          </div>

          {profileMessage ? (
            <p className="md:col-span-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {profileMessage}
            </p>
          ) : null}
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Doi mat khau</h2>
        <form onSubmit={handleChangePassword} className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm md:col-span-2">
            <span className="font-medium text-slate-700">Mat khau hien tai</span>
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Mat khau moi</span>
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Xac nhan mat khau moi</span>
            <input
              type="password"
              value={confirmNewPassword}
              onChange={(event) => setConfirmNewPassword(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
            />
          </label>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={passwordLoading}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {passwordLoading ? "Dang cap nhat..." : "Doi mat khau"}
            </button>
          </div>

          {passwordMessage ? (
            <p className="md:col-span-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {passwordMessage}
            </p>
          ) : null}
        </form>
      </section>
    </div>
  );
}
