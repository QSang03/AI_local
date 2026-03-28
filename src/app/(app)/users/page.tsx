"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import Toast from "@/components/ui/Toast";
import { createUser, deleteUser, getUserById, getUsers, updateUser } from "@/lib/api";
import { AppUserAccount, AppUserRole } from "@/types/domain";

type UserDraft = {
  username: string;
  email: string;
  password: string;
  role: AppUserRole;
};

type FieldErrors = Partial<Record<keyof UserDraft, string>>;

const emptyDraft: UserDraft = {
  username: "",
  email: "",
  password: "",
  role: "sale",
};

function formatCreatedAt(timestamp: string) {
  const dt = new Date(timestamp);
  if (Number.isNaN(dt.getTime())) return timestamp;

  const d = String(dt.getDate()).padStart(2, "0");
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const y = dt.getFullYear();
  const h = String(dt.getHours()).padStart(2, "0");
  const mm = String(dt.getMinutes()).padStart(2, "0");
  return `${d}/${m}/${y} ${h}:${mm}`;
}

function getRelativeTime(timestamp: string) {
  const dt = new Date(timestamp);
  if (Number.isNaN(dt.getTime())) return "";
  const diffMs = Date.now() - dt.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "vua xong";
  if (mins < 60) return `${mins} phut truoc`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} gio truoc`;
  const days = Math.floor(hours / 24);
  return `${days} ngay truoc`;
}

function validateCreateDraft(draft: UserDraft): FieldErrors {
  const errors: FieldErrors = {};
  if (!draft.username.trim()) errors.username = "Username không được để trống.";
  if (!draft.email.trim()) errors.email = "Email không được để trống.";
  if (draft.email && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(draft.email)) {
    errors.email = "Email không hợp lệ.";
  }
  if (!draft.password.trim()) {
    errors.password = "Mật khẩu không được để trống.";
  } else {
    const hasNumber = /\d/.test(draft.password);
    if (draft.password.length < 8 || !hasNumber) {
      errors.password = "Mật khẩu tối thiểu 8 ký tự và phải có ít nhất 1 chữ số.";
    }
  }
  return errors;
}

function validateEditDraft(draft: UserDraft): FieldErrors {
  const errors: FieldErrors = {};
  if (!draft.username.trim()) errors.username = "Username không được để trống.";
  if (!draft.email.trim()) errors.email = "Email không được để trống.";
  if (draft.email && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(draft.email)) {
    errors.email = "Email không hợp lệ.";
  }
  if (draft.password.trim()) {
    const hasNumber = /\d/.test(draft.password);
    if (draft.password.length < 8 || !hasNumber) {
      errors.password = "Mật khẩu mới tối thiểu 8 ký tự và phải có ít nhất 1 chữ số.";
    }
  }
  return errors;
}

function roleBadge(role: string) {
  if (role === "admin") {
    return "bg-indigo-100 text-indigo-800 border-indigo-200";
  }
  return "bg-emerald-100 text-emerald-800 border-emerald-200";
}

export default function UsersPage() {
  const [users, setUsers] = useState<AppUserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingCreate, setSavingCreate] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [createDraft, setCreateDraft] = useState<UserDraft>(emptyDraft);
  const [createTouched, setCreateTouched] = useState<Partial<Record<keyof UserDraft, boolean>>>({});
  const [createErrors, setCreateErrors] = useState<FieldErrors>({});

  const [editDraft, setEditDraft] = useState<UserDraft>(emptyDraft);
  const [editTouched, setEditTouched] = useState<Partial<Record<keyof UserDraft, boolean>>>({});
  const [editErrors, setEditErrors] = useState<FieldErrors>({});
  const [editingUser, setEditingUser] = useState<AppUserAccount | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<AppUserAccount | null>(null);

  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | AppUserRole>("all");

  const editModalRef = useRef<HTMLDivElement | null>(null);
  const deleteModalRef = useRef<HTMLDivElement | null>(null);
  const lastEditButtonRef = useRef<HTMLButtonElement | null>(null);

  async function loadUsers() {
    setLoading(true);
    setError(null);
    try {
      const data = await getUsers();
      setUsers(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Khong tai duoc users.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  const counts = useMemo(() => {
    const admin = users.filter((u) => String(u.role) === "admin").length;
    const sale = users.filter((u) => String(u.role) === "sale").length;
    return { total: users.length, admin, sale };
  }, [users]);

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      const byRole = roleFilter === "all" || String(u.role) === roleFilter;
      const byQuery =
        q.length === 0 ||
        u.username.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q);
      return byRole && byQuery;
    });
  }, [users, query, roleFilter]);

  const hasActiveFilters = query.trim().length > 0 || roleFilter !== "all";

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsCreateModalOpen(false);
        setIsEditOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {

    const modalEl = editModalRef.current;
    if (!modalEl) return;

    const focusables = modalEl.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    focusables[0]?.focus();

    function onKeyDown(ev: KeyboardEvent) {
      if (ev.key === "Escape") {
        ev.preventDefault();
        setIsEditOpen(false);
        return;
      }

      if (ev.key === "Tab") {
        const currentModal = editModalRef.current;
        if (!currentModal) return;

        const nodes = Array.from(
          currentModal.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((el) => !el.hasAttribute("disabled"));

        if (nodes.length === 0) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (ev.shiftKey && document.activeElement === first) {
          ev.preventDefault();
          last.focus();
        } else if (!ev.shiftKey && document.activeElement === last) {
          ev.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      lastEditButtonRef.current?.focus();
    };
  }, [isEditOpen]);

  useEffect(() => {
    if (!confirmDeleteUser) return;
    const modalEl = deleteModalRef.current;
    if (!modalEl) return;
    const focusables = modalEl.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    focusables[0]?.focus();

    function onKeyDown(ev: KeyboardEvent) {
      if (ev.key === "Escape" && !deleting) {
        ev.preventDefault();
        setConfirmDeleteUser(null);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [confirmDeleteUser, deleting]);

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errs = validateCreateDraft(createDraft);
    setCreateErrors(errs);
    setCreateTouched({ username: true, email: true, password: true, role: true });
    if (Object.keys(errs).length > 0) return;

    setSavingCreate(true);
    const result = await createUser({
      username: createDraft.username.trim(),
      email: createDraft.email.trim(),
      password: createDraft.password.trim(),
      role: createDraft.role,
    });
    setSavingCreate(false);

    if (result.ok) {
      await loadUsers();
      setIsCreateModalOpen(false);
      setCreateDraft(emptyDraft);
      setCreateTouched({});
      setCreateErrors({});
      setToastMessage(`✅ Da tao nguoi dung ${createDraft.username.trim()} thanh cong.`);
    } else {
      setToastMessage(`❌ ${result.message}`);
    }
  }

  async function openEdit(user: AppUserAccount, trigger?: HTMLButtonElement | null) {
    if (trigger) lastEditButtonRef.current = trigger;
    try {
      const full = await getUserById(user.id);
      setEditingUser(full);
      setEditDraft({
        username: full.username,
        email: full.email,
        password: "",
        role: (full.role === "admin" ? "admin" : "sale") as AppUserRole,
      });
      setEditTouched({});
      setEditErrors({});
      setIsEditOpen(true);
    } catch (e) {
      setToastMessage(`❌ ${e instanceof Error ? e.message : "Khong lay duoc thong tin user."}`);
    }
  }

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    console.log('[DEBUG] submitEdit triggered');
    event.preventDefault();
    if (!editingUser) {
      console.warn('[DEBUG] No editingUser set');
      return;
    }

    const errs = validateEditDraft(editDraft);
    console.log('[DEBUG] Validation errors:', errs);
    setEditErrors(errs);
    setEditTouched({ username: true, email: true, password: true, role: true });
    if (Object.keys(errs).length > 0) {
      console.warn('[DEBUG] Validation failed, returning early');
      return;
    }

    console.log('[DEBUG] Validation passed, starting update for ID:', editingUser.id);
    setSavingEdit(true);
    try {
      const payload = {
        username: editDraft.username.trim(),
        email: editDraft.email.trim(),
        role: editDraft.role,
        ...(editDraft.password.trim() ? { password: editDraft.password.trim() } : {}),
      };
      console.log('[DEBUG] Update payload:', payload);

      const result = await updateUser(editingUser.id, payload);
      console.log('[DEBUG] UpdateUser result:', result);
      setSavingEdit(false);

      if (result.ok) {
        await loadUsers();
        setIsEditOpen(false);
        setEditingUser(null);
        setToastMessage("✅ Đã cập nhật thông tin người dùng.");
      } else {
        setToastMessage(`❌ ${result.message}`);
      }
    } catch (e) {
      console.error('[DEBUG] updateUser Exception:', e);
      setSavingEdit(false);
      setToastMessage(`❌ Lỗi hệ thống: ${e instanceof Error ? e.message : "Chưa xác định"}`);
    }
  }

  async function confirmDelete() {
    if (!confirmDeleteUser) return;
    setDeleting(true);
    const result = await deleteUser(confirmDeleteUser.id);
    setDeleting(false);

    if (result.ok) {
      await loadUsers();
      setToastMessage(`✅ Da xoa nguoi dung ${confirmDeleteUser.username}.`);
      setConfirmDeleteUser(null);
      if (editingUser?.id === confirmDeleteUser.id) {
        setIsEditOpen(false);
        setEditingUser(null);
      }
    } else {
      setToastMessage(`❌ ${result.message}`);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <nav className="text-sm text-slate-500" aria-label="Breadcrumb">
          <Link href="/projects" className="hover:text-slate-700">Dashboard</Link>
          <span className="mx-2">&gt;</span>
          <span className="text-slate-700">Quan ly nguoi dung</span>
        </nav>
      </div>

      <PageHeader
        title="Quản lý người dùng"
        subtitle="Tạo, chỉnh sửa và quản lý tài khoản người dùng trong hệ thống."
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">Danh sach user</h3>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            <span>＋</span>
            <span>Thêm người dùng</span>
          </button>
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_280px_auto] lg:items-end">
          <div className="space-y-1">
            <label htmlFor="search-user" className="text-sm font-medium text-slate-700">Tim kiem</label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
              <input
                id="search-user"
                aria-label="Tim theo username hoac email"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Nhập username hoặc email..."
                className="w-full rounded-xl border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-slate-700"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="role-filter" className="text-sm font-medium text-slate-700">Loc theo role</label>
            <select
              id="role-filter"
              aria-label="Loc role"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as "all" | AppUserRole)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-700"
            >
              <option value="all">Tất cả ({counts.total})</option>
              <option value="admin">Admin ({counts.admin})</option>
              <option value="sale">Sale ({counts.sale})</option>
            </select>
          </div>

          {hasActiveFilters ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setRoleFilter("all");
              }}
              className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Xóa bộ lọc
            </button>
          ) : null}
        </div>

        {loading ? <p className="mt-4 text-sm text-slate-500">Dang tai users...</p> : null}
        {error ? <p className="mt-4 text-sm text-rose-700">{error}</p> : null}

        {!loading && !error && filteredUsers.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <div className="text-4xl">🧭</div>
            <p className="mt-3 text-base font-semibold text-slate-700">Khong tim thay nguoi dung nao phu hop.</p>
            <p className="mt-1 text-sm text-slate-500">Thu doi tu khoa tim kiem hoac bo loc role.</p>
          </div>
        ) : null}

        {!loading && !error && filteredUsers.length > 0 ? (
          <>
            <div className="mt-4 hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="bg-slate-100">
                  <tr className="text-left text-xs font-bold uppercase tracking-wide text-slate-600">
                    <th className="px-3 py-3">ID</th>
                    <th className="px-3 py-3">Username</th>
                    <th className="px-3 py-3">Email</th>
                    <th className="px-3 py-3">Role</th>
                    <th className="px-3 py-3">Created</th>
                    <th className="px-3 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user, idx) => {
                    const editing = editingUser?.id === user.id;
                    return (
                      <tr
                        key={user.id}
                        className={`${idx % 2 === 0 ? "bg-white" : "bg-slate-50"} ${editing ? "bg-sky-50" : ""} border-b border-slate-100 hover:bg-slate-100/70`}
                      >
                        <td className="px-3 py-3">{user.id}</td>
                        <td className="px-3 py-3 font-medium text-slate-800">{user.username}</td>
                        <td className="px-3 py-3 text-slate-700">{user.email}</td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${roleBadge(String(user.role))}`}>
                            {String(user.role)}
                          </span>
                        </td>
                        <td className="px-3 py-3" title={user.created_at}>
                          <div>{formatCreatedAt(user.created_at)}</div>
                          <div className="text-xs text-slate-500">{getRelativeTime(user.created_at)}</div>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <div className="inline-flex gap-2">
                            <button
                              type="button"
                              aria-label={`Sua user ${user.username}`}
                              title="Sua"
                              onClick={(e) => void openEdit(user, e.currentTarget)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                            >
                              ✏️
                            </button>
                            <button
                              type="button"
                              aria-label={`Xoa user ${user.username}`}
                              title="Xoa"
                              onClick={() => setConfirmDeleteUser(user)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-rose-300 bg-white text-rose-700 hover:bg-rose-50"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 grid gap-3 md:hidden">
              {filteredUsers.map((user) => {
                const editing = editingUser?.id === user.id;
                return (
                  <div key={user.id} className={`rounded-xl border p-4 ${editing ? "border-sky-300 bg-sky-50" : "border-slate-200 bg-white"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{user.username}</p>
                        <p className="text-sm text-slate-600">{user.email}</p>
                      </div>
                      <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${roleBadge(String(user.role))}`}>
                        {String(user.role)}
                      </span>
                    </div>
                    <div className="mt-3 flex justify-end gap-2">
                      <button
                        type="button"
                        aria-label={`Sua user ${user.username}`}
                        onClick={(e) => void openEdit(user, e.currentTarget)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700"
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        aria-label={`Xoa user ${user.username}`}
                        onClick={() => setConfirmDeleteUser(user)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-rose-300 bg-white text-rose-700"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : null}
      </section>

      {isCreateModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setIsCreateModalOpen(false)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Them nguoi dung moi"
            className="relative z-10 w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Thêm người dùng mới</h2>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="rounded-md text-slate-400 hover:text-slate-600"
                aria-label="Dong modal"
              >
                ✕
              </button>
            </div>

            <form onSubmit={submitCreate} className="space-y-4">
              <div className="space-y-1">
                <label htmlFor="create-username" className="text-sm font-medium text-slate-700">Username</label>
                <input
                  id="create-username"
                  aria-label="Username"
                  value={createDraft.username}
                  onBlur={() => setCreateTouched((s) => ({ ...s, username: true }))}
                  onChange={(e) => {
                    const username = e.target.value;
                    const nextDraft = { ...createDraft, username };
                    setCreateDraft(nextDraft);
                    setCreateErrors(validateCreateDraft(nextDraft));
                    setCreateTouched((s) => ({ ...s, username: true }));
                  }}
                  placeholder="vd: quocduong"
                  className={`w-full rounded-xl border px-3 py-2 outline-none ${createTouched.username && createErrors.username ? "border-rose-400 bg-rose-50" : "border-slate-300 focus:border-slate-700"}`}
                />
                {createTouched.username && createErrors.username ? <p className="text-xs text-rose-600">{createErrors.username}</p> : null}
              </div>

              <div className="space-y-1">
                <label htmlFor="create-email" className="text-sm font-medium text-slate-700">Email</label>
                <input
                  id="create-email"
                  aria-label="Email"
                  type="email"
                  value={createDraft.email}
                  onBlur={() => setCreateTouched((s) => ({ ...s, email: true }))}
                  onChange={(e) => {
                    const email = e.target.value;
                    const nextDraft = { ...createDraft, email };
                    setCreateDraft(nextDraft);
                    setCreateErrors(validateCreateDraft(nextDraft));
                    setCreateTouched((s) => ({ ...s, email: true }));
                  }}
                  placeholder="vd: duong@example.com"
                  className={`w-full rounded-xl border px-3 py-2 outline-none ${createTouched.email && createErrors.email ? "border-rose-400 bg-rose-50" : "border-slate-300 focus:border-slate-700"}`}
                />
                {createTouched.email && createErrors.email ? <p className="text-xs text-rose-600">{createErrors.email}</p> : null}
              </div>

              <div className="space-y-1">
                <label htmlFor="create-password" className="text-sm font-medium text-slate-700">Mat khau</label>
                <input
                  id="create-password"
                  aria-label="Mat khau"
                  type="password"
                  value={createDraft.password}
                  onBlur={() => setCreateTouched((s) => ({ ...s, password: true }))}
                  onChange={(e) => {
                    const password = e.target.value;
                    const nextDraft = { ...createDraft, password };
                    setCreateDraft(nextDraft);
                    setCreateErrors(validateCreateDraft(nextDraft));
                    setCreateTouched((s) => ({ ...s, password: true }));
                  }}
                  placeholder="strong-pass-123"
                  className={`w-full rounded-xl border px-3 py-2 outline-none ${createTouched.password && createErrors.password ? "border-rose-400 bg-rose-50" : "border-slate-300 focus:border-slate-700"}`}
                />
                <p className="text-xs text-slate-500">Tối thiểu 8 ký tự, bao gồm ít nhất 1 chữ số.</p>
                {createTouched.password && createErrors.password ? <p className="text-xs text-rose-600">{createErrors.password}</p> : null}
              </div>

              <div className="space-y-1">
                <label htmlFor="create-role" className="text-sm font-medium text-slate-700">Role</label>
                <select
                  id="create-role"
                  aria-label="Role"
                  value={createDraft.role}
                  onChange={(e) => setCreateDraft((s) => ({ ...s, role: e.target.value as AppUserRole }))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-700"
                >
                  <option value="sale">sale</option>
                  <option value="admin">admin</option>
                </select>
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Huy
                </button>
                <button
                  type="submit"
                  disabled={savingCreate}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {savingCreate ? <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : null}
                  <span>{savingCreate ? "Dang tao..." : "Tao nguoi dung"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isEditOpen && editingUser ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setIsEditOpen(false)} />
          <div
            ref={editModalRef}
            role="dialog"
            aria-modal="true"
            aria-label={`Chinh sua nguoi dung ${editingUser.username}`}
            className="relative z-10 w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Chỉnh sửa người dùng: {editingUser.username}</h3>
              <button
                type="button"
                onClick={() => setIsEditOpen(false)}
                className="rounded-md text-slate-400 hover:text-slate-600"
                aria-label="Dong modal"
              >
                ✕
              </button>
            </div>

            <form onSubmit={submitEdit} className="space-y-3">
              <div className="space-y-1">
                <label htmlFor="edit-username" className="text-sm font-medium text-slate-700">Username</label>
                <input
                  id="edit-username"
                  aria-label="Username chinh sua"
                  value={editDraft.username}
                  onBlur={() => setEditTouched((s) => ({ ...s, username: true }))}
                  onChange={(e) => {
                    const username = e.target.value;
                    const nextDraft = { ...editDraft, username };
                    setEditDraft(nextDraft);
                    setEditErrors(validateEditDraft(nextDraft));
                    setEditTouched((s) => ({ ...s, username: true }));
                  }}
                  className={`w-full rounded-xl border px-3 py-2 outline-none ${editTouched.username && editErrors.username ? "border-rose-400 bg-rose-50" : "border-slate-300 focus:border-slate-700"}`}
                />
                {editTouched.username && editErrors.username ? <p className="text-xs text-rose-600">{editErrors.username}</p> : null}
              </div>

              <div className="space-y-1">
                <label htmlFor="edit-email" className="text-sm font-medium text-slate-700">Email</label>
                <input
                  id="edit-email"
                  aria-label="Email chinh sua"
                  type="email"
                  value={editDraft.email}
                  onBlur={() => setEditTouched((s) => ({ ...s, email: true }))}
                  onChange={(e) => {
                    const email = e.target.value;
                    const nextDraft = { ...editDraft, email };
                    setEditDraft(nextDraft);
                    setEditErrors(validateEditDraft(nextDraft));
                    setEditTouched((s) => ({ ...s, email: true }));
                  }}
                  className={`w-full rounded-xl border px-3 py-2 outline-none ${editTouched.email && editErrors.email ? "border-rose-400 bg-rose-50" : "border-slate-300 focus:border-slate-700"}`}
                />
                {editTouched.email && editErrors.email ? <p className="text-xs text-rose-600">{editErrors.email}</p> : null}
              </div>

              <div className="space-y-1">
                <label htmlFor="edit-password" title="Optional" className="text-sm font-medium text-slate-700">Mật khẩu mới (để trống nếu không đổi)</label>
                <input
                  id="edit-password"
                  aria-label="Mật khẩu mới"
                  type="password"
                  value={editDraft.password}
                  onBlur={() => setEditTouched((s) => ({ ...s, password: true }))}
                  onChange={(e) => {
                    const password = e.target.value;
                    const nextDraft = { ...editDraft, password };
                    setEditDraft(nextDraft);
                    setEditErrors(validateEditDraft(nextDraft));
                    setEditTouched((s) => ({ ...s, password: true }));
                  }}
                  placeholder="Để trống nếu muốn giữ nguyên..."
                  className={`w-full rounded-xl border px-3 py-2 outline-none ${editTouched.password && editErrors.password ? "border-rose-400 bg-rose-50" : "border-slate-300 focus:border-slate-700"}`}
                />
                {editTouched.password && editErrors.password ? <p className="text-xs text-rose-600">{editErrors.password}</p> : null}
              </div>
              <div className="space-y-1">
                <label htmlFor="edit-role" className="text-sm font-medium text-slate-700">Role</label>
                <select
                  id="edit-role"
                  aria-label="Role chinh sua"
                  value={editDraft.role}
                  onChange={(e) => setEditDraft((s) => ({ ...s, role: e.target.value as AppUserRole }))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-700"
                >
                  <option value="sale">sale</option>
                  <option value="admin">admin</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
                >
                  {savingEdit ? <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : null}
                  <span>{savingEdit ? "Dang luu..." : "Luu thay doi"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Hủy
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {confirmDeleteUser ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => (deleting ? null : setConfirmDeleteUser(null))} />
          <div
            ref={deleteModalRef}
            role="dialog"
            aria-modal="true"
            aria-label="Xac nhan xoa nguoi dung"
            className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-amber-100 p-2 text-lg">⚠️</div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Xac nhan xoa nguoi dung</h3>
                <p className="mt-1 text-sm text-slate-600">Hanh dong nay khong the hoan tac.</p>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm">
              <p className="font-semibold text-slate-900">{confirmDeleteUser.username}</p>
              <p className="text-slate-700">{confirmDeleteUser.email}</p>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => (deleting ? null : setConfirmDeleteUser(null))}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Huy
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                disabled={deleting}
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
              >
                {deleting ? "Dang xoa..." : "Xoa nguoi dung"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toastMessage ? <Toast message={toastMessage} onClose={() => setToastMessage(null)} /> : null}
    </div>
  );
}
