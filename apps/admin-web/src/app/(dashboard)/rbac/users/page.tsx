'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  CheckCircle,
  MagnifyingGlass,
  Plus,
  ShieldCheck,
  SpinnerGap,
  X,
} from '@phosphor-icons/react';
import { useAuthStore } from '@/lib/auth-store';
import { Permission } from '@/lib/permissions';
import { roleOrder, roleOptions } from '@/lib/rbac';
import type { RbacUsersPage } from '@/lib/rbac.types';
import { authService } from '@/lib/services/auth.service';
import { rbacService } from '@/lib/services/rbac.service';
import { userService } from '@/lib/services/user.service';

const defaultLimit = 10;

function formatDateTime(value?: string) {
  if (!value) return '--';
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function roleLabel(roleName: string) {
  return roleOptions.find((option) => option.code === roleName)?.label ?? roleName;
}

function StatCard({
  label,
  value,
  hint,
}: Readonly<{
  label: string;
  value: string | number;
  hint: string;
}>) {
  return (
    <div className="grid h-full min-h-[124px] min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] rounded-[24px] border border-border bg-background px-4 py-4 shadow-sm">
      <p className="break-words text-[11px] uppercase tracking-[0.18em] text-muted">{label}</p>
      <div className="flex items-center">
        <p className="break-words text-xl font-semibold tracking-tight text-primary sm:text-2xl">{value}</p>
      </div>
      <p className="break-words text-xs leading-5 text-muted">{hint}</p>
    </div>
  );
}

function Pill({
  children,
  tone = 'neutral',
}: Readonly<{
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'accent';
}>) {
  const toneClasses = {
    neutral: 'border-border bg-surface text-muted',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
    accent: 'border-primary/20 bg-primary/10 text-primary',
  };

  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ${toneClasses[tone]}`}
    >
      {children}
    </span>
  );
}

export default function RbacUsersPageView() {
  const admin = useAuthStore((state) => state.admin);
  const currentPermissions = useAuthStore((state) => state.permissions);
  const canManageRbac = currentPermissions.includes(Permission.RBAC_MANAGE);

  const [usersPage, setUsersPage] = useState<RbacUsersPage | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(defaultLimit);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [isSavingUserRoles, setIsSavingUserRoles] = useState(false);
  const [isSavingUserActive, setIsSavingUserActive] = useState<Record<string, boolean>>({});
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);
  const [isUserDetailModalOpen, setIsUserDetailModalOpen] = useState(false);
  const [userModalMode, setUserModalMode] = useState<'view' | 'edit'>('view');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRoles, setNewUserRoles] = useState<string[]>(['AUDIENCE']);
  const [draftUserRoles, setDraftUserRoles] = useState<string[]>([]);

  const users = useMemo(() => usersPage?.items ?? [], [usersPage]);
  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) ?? users[0] ?? null,
    [selectedUserId, users],
  );

  const totalPages = usersPage ? Math.max(1, Math.ceil(usersPage.total / usersPage.limit)) : 1;
  const availableRoles = useMemo(() => {
    const knownNames = new Set([...roleOrder, ...roleOptions.map((role) => role.code), ...users.flatMap((user) => user.roles)]);
    return Array.from(knownNames);
  }, [users]);

  const totalPermissionVersion = users.reduce((sum, user) => sum + user.permissionVersion, 0);

  const refreshAll = () => setReloadNonce((value) => value + 1);

  const resetCreateUserForm = () => {
    setNewUserName('');
    setNewUserEmail('');
    setNewUserPassword('');
    setNewUserRoles(['AUDIENCE']);
  };

  const confirmSensitiveAction = (message: string) => {
    if (typeof window === 'undefined') {
      return false;
    }

    return window.confirm(message);
  };

  const openCreateUserModal = () => {
    resetCreateUserForm();
    setErrorMessage(null);
    setIsCreateUserModalOpen(true);
  };

  const openUserDetailModal = (userId: string, mode: 'view' | 'edit') => {
    const targetUser = users.find((user) => user.id === userId) ?? null;
    setSelectedUserId(userId);
    setDraftUserRoles(targetUser?.roles ?? []);
    setUserModalMode(mode);
    setIsUserDetailModalOpen(true);
  };

  useEffect(() => {
    let isMounted = true;
    const timeout = window.setTimeout(async () => {
      try {
        setIsLoadingUsers(true);
        const data = await rbacService.getUsers({
          query: query.trim() || undefined,
          role: roleFilter === 'all' ? undefined : roleFilter,
          page,
          limit,
        });

        if (!isMounted) return;

        let nextSelectedId: string | null = null;
        setUsersPage(data);
        setSelectedUserId((current) => {
          nextSelectedId = !current
            ? data.items[0]?.id ?? null
            : data.items.some((user) => user.id === current)
              ? current
              : data.items[0]?.id ?? null;
          return nextSelectedId;
        });
        const nextSelectedUser =
          data.items.find((user) => user.id === nextSelectedId) ??
          data.items[0] ??
          null;
        setDraftUserRoles(nextSelectedUser?.roles ?? []);
        setErrorMessage(null);
      } catch (error) {
        console.error('Failed to load RBAC users', error);
        if (isMounted) {
          setErrorMessage('Không thể tải danh sách user.');
        }
      } finally {
        if (isMounted) setIsLoadingUsers(false);
      }
    }, 200);

    return () => {
      isMounted = false;
      window.clearTimeout(timeout);
    };
  }, [page, query, roleFilter, limit, reloadNonce]);

  const handleSaveUserRoles = async () => {
    if (!selectedUser) return;

    if (!confirmSensitiveAction(`Cập nhật role cho ${selectedUser.email}?`)) {
      return;
    }

    try {
      setIsSavingUserRoles(true);
      setNoticeMessage(null);
      await userService.updateRoles(selectedUser.id, { roles: draftUserRoles });
      setNoticeMessage(`Đã cập nhật role cho ${selectedUser.email}.`);
      refreshAll();
    } catch (error) {
      console.error('Failed to update user roles', error);
      setErrorMessage('Không thể cập nhật role của user.');
    } finally {
      setIsSavingUserRoles(false);
    }
  };

  const handleToggleUserRole = (roleName: string) => {
    setDraftUserRoles((current) =>
      current.includes(roleName) ? current.filter((value) => value !== roleName) : [...current, roleName],
    );
  };

  const handleToggleUserActive = async (userId: string, isActive: boolean) => {
    if (!confirmSensitiveAction(`Bạn có chắc muốn ${isActive ? 'kích hoạt' : 'vô hiệu hóa'} tài khoản này?`)) {
      return;
    }

    try {
      setIsSavingUserActive((current) => ({ ...current, [userId]: true }));
      setNoticeMessage(null);
      await userService.updateActiveStatus(userId, { isActive });
      setNoticeMessage(`Đã ${isActive ? 'kích hoạt' : 'vô hiệu hóa'} tài khoản.`);
      refreshAll();
    } catch (error) {
      console.error('Failed to update user active status', error);
      setErrorMessage('Không thể cập nhật trạng thái tài khoản.');
    } finally {
      setIsSavingUserActive((current) => ({ ...current, [userId]: false }));
    }
  };

  const handleCreateUser = async () => {
    const nextName = newUserName.trim();
    const nextEmail = newUserEmail.trim();
    const nextPassword = newUserPassword.trim();

    if (!nextName || !nextEmail || !nextPassword) {
      setErrorMessage('Vui lòng nhập đầy đủ tên, email và mật khẩu.');
      return;
    }

    if (!confirmSensitiveAction(`Tạo user ${nextEmail} với ${newUserRoles.length} role đã chọn?`)) {
      return;
    }

    try {
      setIsCreatingUser(true);
      setNoticeMessage(null);
      setErrorMessage(null);

      await authService.register({
        name: nextName,
        email: nextEmail,
        password: nextPassword,
        app: 'admin',
      });

      const createdUsersPage = await rbacService.getUsers({
        query: nextEmail,
        page: 1,
        limit: 20,
      });

      const createdUser =
        createdUsersPage.items.find((item) => item.email.toLowerCase() === nextEmail.toLowerCase()) ??
        createdUsersPage.items[0] ??
        null;

      if (createdUser && newUserRoles.length > 0) {
        await userService.updateRoles(createdUser.id, { roles: newUserRoles });
      }

      resetCreateUserForm();
      setIsCreateUserModalOpen(false);
      setNoticeMessage(
        createdUser
          ? `Đã tạo user ${nextEmail}${newUserRoles.length > 0 ? ' và gán role thành công.' : '.'}`
          : `Đã tạo user ${nextEmail}.`,
      );
      refreshAll();
    } catch (error) {
      console.error('Failed to create user', error);
      setErrorMessage('Không thể tạo user mới. Kiểm tra lại email hoặc mật khẩu.');
    } finally {
      setIsCreatingUser(false);
    }
  };

  if (!canManageRbac) {
    return (
      <div className="rounded-[28px] border border-dashed border-border bg-surface p-10 text-center">
        <ShieldCheck size={40} className="mx-auto text-muted" />
        <h1 className="mt-4 text-2xl font-semibold text-primary">Access Control</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          Your current account does not have <code className="rounded bg-background px-1 py-0.5">rbac:manage</code>{' '}
          permission.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[32px] border border-border bg-surface p-6 shadow-sm">
        <div className="grid gap-6 lg:items-start xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div className="min-w-0 max-w-2xl">
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted">Access control</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-primary">Users</h1>
            <p className="mt-3 text-sm leading-6 text-muted">
              Tạo user, gán role, bật tắt tài khoản và xem permission hiện tại của từng người dùng.
            </p>
          </div>

          <div className="grid min-w-0 gap-3 grid-cols-1 sm:grid-cols-2 xl:max-w-[760px]">
            <StatCard label="Current admin" value={admin?.name ?? '--'} hint={admin?.email ?? 'No active profile'} />
            <StatCard label="Visible users" value={usersPage?.total ?? 0} hint="Filtered result count" />
            <StatCard label="Page size" value={limit} hint="Current list size" />
            <StatCard label="Permission versions" value={users.length > 0 ? totalPermissionVersion : 0} hint="Current page sum" />
          </div>
        </div>
      </div>

      <section className="rounded-[28px] border border-border bg-surface p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-primary">User management</h2>
            <p className="mt-1 text-sm text-muted">Danh sách user, filter theo role và chỉnh quyền truy cập thông qua role.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex h-10 items-center rounded-full border border-primary/20 bg-primary/10 px-4 text-[11px] font-medium uppercase tracking-[0.18em] text-primary">
              {usersPage?.total ?? 0} users
            </span>
            <span className="inline-flex h-10 items-center rounded-full border border-border bg-background px-4 text-[11px] font-medium uppercase tracking-[0.18em] text-muted">
              {users.length > 0 ? totalPermissionVersion : 0} version sum
            </span>
            <button
              type="button"
              onClick={openCreateUserModal}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-surface transition-opacity hover:opacity-90"
            >
              <Plus size={16} />
              Add user
            </button>
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-[24px] border border-border bg-background">
          <div className="border-b border-border px-4 py-4">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_200px_180px]">
              <label className="relative block">
                <span className="mb-2 block text-sm font-medium text-primary">Search</span>
                <MagnifyingGlass className="absolute left-3 top-[42px] -translate-y-1/2 text-muted" size={18} />
                <input
                  type="text"
                  value={query}
                  onChange={(event) => {
                    setPage(1);
                    setQuery(event.target.value);
                  }}
                  placeholder="Search by name or email..."
                  className="h-12 w-full rounded-lg border border-border bg-surface py-0 pl-10 pr-4 text-sm font-medium text-primary outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </label>

              <div>
                <span className="mb-2 block text-sm font-medium text-primary">Role filter</span>
                <select
                  value={roleFilter}
                  onChange={(event) => {
                    setPage(1);
                    setRoleFilter(event.target.value);
                  }}
                  className="h-12 w-full rounded-lg border border-border bg-surface px-3 py-0 text-sm font-medium text-primary outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                >
                  <option value="all">All roles</option>
                  {availableRoles.map((roleName) => (
                    <option key={roleName} value={roleName}>
                      {roleLabel(roleName)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <span className="mb-2 block text-sm font-medium text-primary">Page size</span>
                <select
                  value={limit}
                  onChange={(event) => {
                    setPage(1);
                    setLimit(Number(event.target.value));
                  }}
                  className="h-12 w-full rounded-lg border border-border bg-surface px-3 py-0 text-sm font-medium text-primary outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>
          </div>
          <div className="w-full overflow-x-auto">
            <table className="min-w-[1260px] w-full table-fixed text-left text-sm">
              <thead className="border-b border-border bg-primary/5">
                <tr>
                  <th className="w-[260px] px-4 py-3 text-center font-medium text-muted">User</th>
                  <th className="w-[220px] px-4 py-3 text-center font-medium text-muted">Roles</th>
                  <th className="w-[120px] px-4 py-3 text-center font-medium text-muted">Status</th>
                  <th className="w-[130px] px-4 py-3 text-center font-medium text-muted">Permissions</th>
                  <th className="w-[100px] px-4 py-3 text-center font-medium text-muted">Version</th>
                  <th className="w-[170px] px-4 py-3 text-center font-medium text-muted">Updated</th>
                  <th className="w-[360px] px-4 py-3 text-center font-medium text-muted">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoadingUsers ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-16 text-center text-muted">
                      <div className="flex flex-col items-center gap-3">
                        <SpinnerGap size={18} className="animate-spin" />
                        Loading users...
                      </div>
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-16 text-center text-muted">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  users.map((user) => {
                    const isBusy = Boolean(isSavingUserActive[user.id]);
                    return (
                      <tr
                        key={user.id}
                        className="transition-colors hover:bg-primary/5"
                      >
                        <td className="px-4 py-4 align-middle">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-primary">{user.name}</p>
                            <p className="mt-1 truncate text-xs text-muted">{user.email}</p>
                          </div>
                        </td>
                        <td className="px-4 py-4 align-middle">
                          <div className="flex flex-wrap gap-2">
                            {user.roles.length > 0 ? (
                              user.roles.map((roleName) => <Pill key={roleName}>{roleLabel(roleName)}</Pill>)
                            ) : (
                              <span className="text-muted">No role</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 align-middle">
                          <Pill tone={user.isActive ? 'success' : 'warning'}>
                            {user.isActive ? 'Active' : 'Inactive'}
                          </Pill>
                        </td>
                        <td className="px-4 py-4 align-middle">
                          <span className="font-medium text-primary">{user.permissions.length}</span>
                          <span className="ml-1 text-muted">codes</span>
                        </td>
                        <td className="px-4 py-4 align-middle">
                          <span className="font-medium text-primary">{user.permissionVersion}</span>
                        </td>
                        <td className="px-4 py-4 align-middle whitespace-nowrap text-muted">
                          {formatDateTime(user.updatedAt)}
                        </td>
                        <td className="px-4 py-4 align-middle whitespace-nowrap">
                          <div className="flex flex-nowrap justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openUserDetailModal(user.id, 'view')}
                              className="inline-flex h-10 min-w-[96px] items-center justify-center rounded-lg border border-cyan-200 bg-cyan-50 px-3 text-xs font-medium whitespace-nowrap text-cyan-800 transition-colors hover:border-cyan-300 hover:bg-cyan-100"
                            >
                              View detail
                            </button>
                            <button
                              type="button"
                              onClick={() => openUserDetailModal(user.id, 'edit')}
                              className="inline-flex h-10 min-w-[96px] items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-xs font-medium whitespace-nowrap text-indigo-800 transition-colors hover:border-indigo-300 hover:bg-indigo-100"
                            >
                              Edit roles
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleUserActive(user.id, !user.isActive)}
                              disabled={isBusy}
                              className={`inline-flex h-10 min-w-[108px] items-center justify-center rounded-lg border px-3 text-xs font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                                user.isActive
                                  ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                                  : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                              }`}
                            >
                              {isBusy ? (
                                <SpinnerGap size={14} className="animate-spin" />
                              ) : user.isActive ? (
                                'Deactivate'
                              ) : (
                                'Activate'
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm text-muted">
            <span>
              Page {usersPage?.page ?? page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-primary disabled:cursor-not-allowed disabled:opacity-40"
              >
                Prev
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((current) => current + 1)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-primary disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </section>

      {errorMessage ? (
        <div className="rounded-[24px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{errorMessage}</div>
      ) : null}

      {noticeMessage ? (
        <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {noticeMessage}
        </div>
      ) : null}

      {isCreateUserModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/55 px-4">
          <div className="w-full max-w-4xl rounded-[28px] border border-border bg-surface p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted">Add user</p>
                <h2 className="mt-2 text-2xl font-semibold text-primary">Create new user</h2>
                <p className="mt-2 text-sm leading-6 text-muted">
                  Nhập thông tin tài khoản và chọn role trước khi tạo user.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateUserModalOpen(false)}
                className="rounded-full border border-border p-2 text-muted transition-colors hover:bg-primary/5 hover:text-primary"
              >
                <X size={16} />
              </button>
            </div>

            <form autoComplete="off" className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)] xl:items-start">
              <input
                type="text"
                name="fake-username"
                autoComplete="username"
                className="hidden"
                tabIndex={-1}
                aria-hidden="true"
              />
              <input
                type="password"
                name="fake-password"
                autoComplete="current-password"
                className="hidden"
                tabIndex={-1}
                aria-hidden="true"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-primary">Name</span>
                  <input
                    type="text"
                    name="rbac-create-user-name"
                    autoComplete="off"
                    value={newUserName}
                    onChange={(event) => setNewUserName(event.target.value)}
                    placeholder="Ví dụ: Nguyen Van A"
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] outline-none placeholder:text-muted/60 focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-primary">Email</span>
                  <input
                    type="email"
                    name="rbac-create-user-email"
                    autoComplete="off"
                    value={newUserEmail}
                    onChange={(event) => setNewUserEmail(event.target.value)}
                    placeholder="Ví dụ: user@example.com"
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] outline-none placeholder:text-muted/60 focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="mb-2 block text-sm font-medium text-primary">Password</span>
                  <input
                    type="password"
                    name="rbac-create-user-password"
                    autoComplete="new-password"
                    value={newUserPassword}
                    onChange={(event) => setNewUserPassword(event.target.value)}
                    placeholder="Ví dụ: password tối thiểu 8 ký tự"
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] outline-none placeholder:text-muted/60 focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </label>
              </div>

              <div className="rounded-[20px] border border-border bg-background p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-primary">Roles</p>
                  <span className="text-xs uppercase tracking-[0.18em] text-muted">Pick one or more</span>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {availableRoles.map((roleName) => {
                    const checked = newUserRoles.includes(roleName);
                    return (
                      <button
                        key={roleName}
                        type="button"
                        onClick={() => {
                          setNewUserRoles((current) =>
                            current.includes(roleName)
                              ? current.filter((value) => value !== roleName)
                              : [...current, roleName],
                          );
                        }}
                        className={`inline-flex min-h-11 items-center justify-center rounded-full border px-3 py-1.5 text-sm font-medium leading-5 text-center transition-colors ${
                          checked
                            ? 'border-primary bg-primary text-surface'
                            : 'border-border bg-surface text-primary hover:bg-primary/5'
                        }`}
                      >
                        {roleLabel(roleName)}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-3 text-sm leading-6 text-muted">
                  Chọn ít nhất một role. `AUDIENCE` đang là lựa chọn mặc định.
                </p>
              </div>
            </form>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsCreateUserModalOpen(false);
                  resetCreateUserForm();
                }}
                className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateUser}
                disabled={isCreatingUser}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-surface transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCreatingUser ? <SpinnerGap size={16} className="animate-spin" /> : <Plus size={16} />}
                Create user
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isUserDetailModalOpen && selectedUser ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/55 px-4">
          <div className="w-full max-w-6xl rounded-[28px] border border-border bg-surface p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted">
                  {userModalMode === 'edit' ? 'Edit user' : 'User detail'}
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-primary">{selectedUser.name}</h2>
                <p className="mt-2 text-sm leading-6 text-muted">{selectedUser.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsUserDetailModalOpen(false)}
                className="rounded-full border border-border p-2 text-muted transition-colors hover:bg-primary/5 hover:text-primary"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Permission version" value={selectedUser.permissionVersion} hint="Incremented after role changes" />
              <StatCard label="Effective permissions" value={selectedUser.permissions.length} hint="Combined from assigned roles" />
              <StatCard label="Status" value={selectedUser.isActive ? 'Active' : 'Inactive'} hint="Can be toggled from the table" />
              <StatCard label="Current admin" value={admin?.name ?? '--'} hint={admin?.email ?? 'No active profile'} />
            </div>

            {userModalMode === 'edit' ? (
              <div className="mt-5 rounded-[24px] border border-border bg-background p-4">
                <p className="text-sm font-medium text-primary">Assign roles</p>
                <div className="mt-3 grid gap-2 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
                  {availableRoles.map((roleName) => {
                    const checked = draftUserRoles.includes(roleName);
                    return (
                      <button
                        key={roleName}
                        type="button"
                        onClick={() => handleToggleUserRole(roleName)}
                        className={`inline-flex min-h-10 w-full items-center justify-center rounded-full border px-4 py-2 text-sm font-medium leading-5 text-center transition-colors ${
                          checked
                            ? 'border-primary bg-primary text-surface'
                            : 'border-border bg-surface text-primary hover:bg-primary/5'
                        }`}
                      >
                        {roleLabel(roleName)}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-[24px] border border-border bg-background p-4">
                <p className="text-sm font-medium text-primary">Current roles</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedUser.roles.length > 0 ? (
                    selectedUser.roles.map((roleName) => <Pill key={roleName}>{roleLabel(roleName)}</Pill>)
                  ) : (
                    <span className="text-sm text-muted">No role assigned.</span>
                  )}
                </div>
              </div>
            )}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setIsUserDetailModalOpen(false)}
                className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/5"
              >
                Close
              </button>
              {userModalMode === 'edit' ? (
                <button
                  type="button"
                  onClick={handleSaveUserRoles}
                  disabled={isSavingUserRoles}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-surface transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSavingUserRoles ? <SpinnerGap size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                  Save roles
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
