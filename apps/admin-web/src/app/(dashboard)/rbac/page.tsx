'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ArrowClockwise,
  CheckCircle,
  MagnifyingGlass,
  Plus,
  ShieldCheck,
  SpinnerGap,
  UserCircle,
} from '@phosphor-icons/react';
import { useAuthStore } from '@/lib/auth-store';
import { Permission } from '@/lib/permissions';
import { roleOrder, roleOptions } from '@/lib/rbac';
import type { RbacPermissionSummary, RbacRoleSummary, RbacUsersPage } from '@/lib/rbac.types';
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
    <div className="rounded-[24px] border border-border bg-background px-4 py-4 shadow-sm">
      <p className="text-[11px] uppercase tracking-[0.2em] text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-primary">{value}</p>
      <p className="mt-1 text-xs leading-5 text-muted">{hint}</p>
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
      className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ${toneClasses[tone]}`}
    >
      {children}
    </span>
  );
}

export default function RbacPage() {
  const admin = useAuthStore((state) => state.admin);
  const currentPermissions = useAuthStore((state) => state.permissions);
  const canManageRbac = currentPermissions.includes(Permission.RBAC_MANAGE);

  const [usersPage, setUsersPage] = useState<RbacUsersPage | null>(null);
  const [roles, setRoles] = useState<RbacRoleSummary[]>([]);
  const [permissions, setPermissions] = useState<RbacPermissionSummary[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(defaultLimit);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);
  const [isSavingUserRoles, setIsSavingUserRoles] = useState(false);
  const [isSavingRolePermissions, setIsSavingRolePermissions] = useState<Record<string, boolean>>({});
  const [isSavingUserActive, setIsSavingUserActive] = useState<Record<string, boolean>>({});
  const [isCreatingPermission, setIsCreatingPermission] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [newPermissionName, setNewPermissionName] = useState('');
  const [draftUserRoles, setDraftUserRoles] = useState<string[]>([]);

  const users = usersPage?.items ?? [];
  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) ?? users[0] ?? null,
    [selectedUserId, users],
  );

  const roleLookup = useMemo(
    () => new Map(roles.map((role) => [role.name, role] as const)),
    [roles],
  );

  const totalPages = usersPage ? Math.max(1, Math.ceil(usersPage.total / usersPage.limit)) : 1;
  const availableRoles = useMemo(() => {
    const knownNames = new Set([...roleOrder, ...roles.map((role) => role.name)]);
    return Array.from(knownNames);
  }, [roles]);

  const permissionCatalog = useMemo(() => {
    const catalog = permissions.length > 0 ? permissions : roleOptions.flatMap((option) => option.permissions.map((permission) => ({ id: permission, name: permission })));
    return [...catalog].sort((left, right) => left.name.localeCompare(right.name));
  }, [permissions]);

  const selectedUserPermissions = selectedUser?.permissions ?? [];
  const selectedUserPermissionSet = useMemo(() => new Set(selectedUserPermissions), [selectedUserPermissions]);

  const totalPermissionVersion = users.reduce((sum, user) => sum + user.permissionVersion, 0);

  const refreshAll = () => setReloadNonce((value) => value + 1);

  useEffect(() => {
    let isMounted = true;

    const loadCatalog = async () => {
      try {
        setIsLoadingCatalog(true);
        const [roleData, permissionData] = await Promise.all([rbacService.getRoles(), rbacService.getPermissions()]);
        if (!isMounted) return;

        const sortedRoles = [...roleData].sort((left, right) => {
          const leftIndex = roleOrder.indexOf(left.name as (typeof roleOrder)[number]);
          const rightIndex = roleOrder.indexOf(right.name as (typeof roleOrder)[number]);
          if (leftIndex === -1 && rightIndex === -1) return left.name.localeCompare(right.name);
          if (leftIndex === -1) return 1;
          if (rightIndex === -1) return -1;
          return leftIndex - rightIndex;
        });

        setRoles(sortedRoles);
        setPermissions(permissionData);
        setErrorMessage(null);
      } catch (error) {
        console.error('Failed to load RBAC catalog', error);
        if (isMounted) {
          setErrorMessage('Không thể tải danh sách role và permission.');
        }
      } finally {
        if (isMounted) setIsLoadingCatalog(false);
      }
    };

    void loadCatalog();

    return () => {
      isMounted = false;
    };
  }, [reloadNonce]);

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

        setUsersPage(data);
        setSelectedUserId((current) => {
          if (!current) return data.items[0]?.id ?? null;
          return data.items.some((user) => user.id === current) ? current : data.items[0]?.id ?? null;
        });
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

  useEffect(() => {
    setDraftUserRoles(selectedUser?.roles ?? []);
  }, [selectedUser]);

  const handleSaveUserRoles = async () => {
    if (!selectedUser) return;

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

  const handleToggleRolePermission = async (roleName: string, permissionName: string) => {
    const role = roleLookup.get(roleName);
    if (!role) return;

    const nextPermissions = role.permissions.includes(permissionName)
      ? role.permissions.filter((value) => value !== permissionName)
      : [...role.permissions, permissionName];

    try {
      setIsSavingRolePermissions((current) => ({ ...current, [roleName]: true }));
      setNoticeMessage(null);
      const updatedRole = await rbacService.updateRolePermissions(role.id, {
        permissions: nextPermissions,
      });

      setRoles((current) => current.map((item) => (item.id === updatedRole.id ? updatedRole : item)));
      setNoticeMessage(`Đã cập nhật permission cho ${roleLabel(roleName)}.`);
      refreshAll();
    } catch (error) {
      console.error('Failed to update role permissions', error);
      setErrorMessage('Không thể cập nhật permission của role.');
    } finally {
      setIsSavingRolePermissions((current) => ({ ...current, [roleName]: false }));
    }
  };

  const handleCreatePermission = async () => {
    const nextName = newPermissionName.trim();
    if (!nextName) return;

    try {
      setIsCreatingPermission(true);
      setNoticeMessage(null);
      await rbacService.createPermission({ name: nextName });
      setNewPermissionName('');
      setNoticeMessage(`Đã tạo permission ${nextName}.`);
      refreshAll();
    } catch (error) {
      console.error('Failed to create permission', error);
      setErrorMessage('Không thể tạo permission mới. Kiểm tra lại format module:action.');
    } finally {
      setIsCreatingPermission(false);
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
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted">Access control</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-primary">RBAC</h1>
            <p className="mt-3 text-sm leading-6 text-muted">
              Quản lý user, role và permission trong một màn hình. Khi role hoặc permission đổi, backend sẽ tăng{' '}
              <code className="rounded bg-background px-1 py-0.5">permission_version</code> để cache quyền cũ bị vô
              hiệu hóa.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Current admin" value={admin?.name ?? '--'} hint={admin?.email ?? 'No active profile'} />
            <StatCard label="Visible users" value={usersPage?.total ?? 0} hint="Filtered result count" />
            <StatCard label="Roles" value={roles.length} hint="Editable role catalog" />
            <StatCard label="Permission versions" value={users.length > 0 ? totalPermissionVersion : 0} hint="Current page sum" />
          </div>
        </div>
      </div>

      <section className="rounded-[28px] border border-border bg-surface p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-primary">Permission matrix</h2>
            <p className="mt-1 text-sm text-muted">Tích vào ô để gán permission cho từng role. Mỗi ô là một thay đổi trực tiếp.</p>
          </div>

          <button
            type="button"
            onClick={refreshAll}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/5 active:scale-[0.98]"
          >
            <ArrowClockwise size={16} />
            Refresh
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <label className="relative block">
            <span className="mb-2 block text-sm font-medium text-primary">Create permission</span>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
                <input
                  type="text"
                  value={newPermissionName}
                  onChange={(event) => setNewPermissionName(event.target.value)}
                  placeholder="module:action"
                  className="w-full rounded-lg border border-border bg-background py-2.5 pl-10 pr-4 text-sm text-primary outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
              <button
                type="button"
                onClick={handleCreatePermission}
                disabled={isCreatingPermission || newPermissionName.trim().length === 0}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-surface transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCreatingPermission ? <SpinnerGap size={16} className="animate-spin" /> : <Plus size={16} />}
                Create
              </button>
            </div>
            <p className="mt-2 text-xs leading-5 text-muted">
              Format: <code className="rounded bg-background px-1 py-0.5">module:action</code>, ví dụ{' '}
              <code className="rounded bg-background px-1 py-0.5">concert:archive</code>.
            </p>
          </label>

          <div className="space-y-3">
            <StatCard label="Permissions" value={permissions.length} hint="From backend catalog" />
            <StatCard label="Roles" value={roles.length} hint="Matrix columns" />
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-[24px] border border-border bg-background">
          <div className="w-full overflow-x-auto">
            <table className="min-w-[980px] w-full text-left text-sm">
              <thead className="border-b border-border bg-primary/5">
                <tr>
                  <th className="sticky left-0 z-10 bg-primary/5 px-4 py-3 font-medium text-muted">Permission</th>
                  {roles.map((role) => (
                    <th key={role.id} className="px-4 py-3 text-center font-medium text-muted">
                      <div className="flex flex-col items-center gap-1">
                        <span>{roleLabel(role.name)}</span>
                        <span className="text-[11px] font-normal normal-case tracking-normal text-muted">
                          {role.permissions.length} granted
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoadingCatalog ? (
                  Array.from({ length: 6 }).map((_, index) => (
                    <tr key={String(index)}>
                      <td className="sticky left-0 z-10 bg-background px-4 py-4">
                        <div className="h-4 w-48 animate-pulse rounded-full bg-border/60" />
                      </td>
                      {Array.from({ length: Math.max(roles.length, 1) }).map((__, roleIndex) => (
                        <td key={`${index}-${roleIndex}`} className="px-4 py-4">
                          <div className="mx-auto h-10 w-10 animate-pulse rounded-2xl bg-border/60" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : permissionCatalog.length === 0 ? (
                  <tr>
                    <td colSpan={Math.max(roles.length + 1, 1)} className="px-4 py-16 text-center text-muted">
                      No permissions yet.
                    </td>
                  </tr>
                ) : (
                  permissionCatalog.map((permission) => (
                    <tr key={permission.name} className="transition-colors hover:bg-primary/5">
                      <td className="sticky left-0 z-10 bg-background px-4 py-4">
                        <div className="min-w-0">
                          <p className="font-medium text-primary">{permission.name}</p>
                        </div>
                      </td>
                      {roles.map((role) => {
                        const checked = role.permissions.includes(permission.name);
                        const isBusy = Boolean(isSavingRolePermissions[role.name]);
                        return (
                          <td key={`${permission.name}-${role.id}`} className="px-4 py-4">
                            <button
                              type="button"
                              onClick={() => handleToggleRolePermission(role.name, permission.name)}
                              disabled={isBusy}
                              className={`mx-auto flex h-11 w-11 items-center justify-center rounded-2xl border transition-all active:scale-[0.98] ${
                                checked
                                  ? 'border-primary bg-primary text-surface shadow-sm'
                                  : 'border-border bg-surface text-muted hover:border-primary/40 hover:text-primary'
                              } disabled:cursor-not-allowed disabled:opacity-60`}
                              aria-label={`${checked ? 'Remove' : 'Add'} ${permission.name} for ${role.name}`}
                              title={`${checked ? 'Remove' : 'Add'} for ${roleLabel(role.name)}`}
                            >
                              {checked ? (
                                <CheckCircle size={18} weight="fill" />
                              ) : (
                                <span className="h-3.5 w-3.5 rounded border border-current" />
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-border bg-surface p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-primary">User management</h2>
            <p className="mt-1 text-sm text-muted">Danh sách user theo hàng ngang, có nút bật/tắt tài khoản ngay trên mỗi dòng.</p>
          </div>

          <div className="flex items-center gap-2">
            <Pill tone="accent">{usersPage?.total ?? 0} users</Pill>
            <Pill tone="neutral">{users.length > 0 ? totalPermissionVersion : 0} version sum</Pill>
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_200px_180px]">
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
              className="w-full rounded-lg border border-border bg-background py-2.5 pl-10 pr-4 text-sm text-primary outline-none focus:border-primary focus:ring-1 focus:ring-primary"
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
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-primary outline-none focus:border-primary focus:ring-1 focus:ring-primary"
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
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-primary outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-[24px] border border-border bg-background">
          <div className="w-full overflow-x-auto">
            <table className="min-w-[1120px] w-full text-left text-sm">
              <thead className="border-b border-border bg-primary/5">
                <tr>
                  <th className="px-4 py-3 font-medium text-muted">User</th>
                  <th className="px-4 py-3 font-medium text-muted">Roles</th>
                  <th className="px-4 py-3 font-medium text-muted">Status</th>
                  <th className="px-4 py-3 font-medium text-muted">Permissions</th>
                  <th className="px-4 py-3 font-medium text-muted">Version</th>
                  <th className="px-4 py-3 font-medium text-muted">Updated</th>
                  <th className="px-4 py-3 font-medium text-muted text-right">Actions</th>
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
                    const isSelected = user.id === selectedUserId;
                    const isBusy = Boolean(isSavingUserActive[user.id]);
                    return (
                      <tr
                        key={user.id}
                        className={`transition-colors hover:bg-primary/5 ${isSelected ? 'bg-primary/5' : ''}`}
                      >
                        <td className="px-4 py-4">
                          <div className="min-w-0">
                            <p className="font-semibold text-primary">{user.name}</p>
                            <p className="mt-1 break-all text-xs text-muted">{user.email}</p>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-2">
                            {user.roles.length > 0 ? (
                              user.roles.map((roleName) => <Pill key={roleName}>{roleLabel(roleName)}</Pill>)
                            ) : (
                              <span className="text-muted">No role</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <Pill tone={user.isActive ? 'success' : 'warning'}>
                            {user.isActive ? 'Active' : 'Inactive'}
                          </Pill>
                        </td>
                        <td className="px-4 py-4">
                          <span className="font-medium text-primary">{user.permissions.length}</span>
                          <span className="ml-1 text-muted">codes</span>
                        </td>
                        <td className="px-4 py-4">
                          <span className="font-medium text-primary">{user.permissionVersion}</span>
                        </td>
                        <td className="px-4 py-4 text-muted">{formatDateTime(user.updatedAt)}</td>
                        <td className="px-4 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedUserId(user.id)}
                              className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-primary hover:bg-primary/5"
                            >
                              Edit roles
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleUserActive(user.id, !user.isActive)}
                              disabled={isBusy}
                              className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
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

      <section className="rounded-[28px] border border-border bg-surface p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted">User editor</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-primary">
              {selectedUser?.name ?? 'Choose a user'}
            </h2>
            <p className="mt-1 text-sm text-muted">{selectedUser?.email ?? 'Chọn một user từ bảng bên trên'}</p>
          </div>
          <Pill tone="accent">{selectedUser?.permissionVersion ?? 0} v</Pill>
        </div>

        {selectedUser ? (
          <>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Permission version"
                value={selectedUser.permissionVersion}
                hint="Incremented after role changes"
              />
              <StatCard
                label="Effective permissions"
                value={selectedUser.permissions.length}
                hint="Combined from assigned roles"
              />
              <StatCard
                label="Status"
                value={selectedUser.isActive ? 'Active' : 'Inactive'}
                hint="Can be toggled from the table"
              />
              <StatCard
                label="Current admin"
                value={admin?.name ?? '--'}
                hint={admin?.email ?? 'No active profile'}
              />
            </div>

            <div className="mt-5 rounded-[24px] border border-border bg-background p-4">
              <p className="text-sm font-medium text-primary">Assign roles</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {availableRoles.map((roleName) => {
                  const checked = draftUserRoles.includes(roleName);
                  return (
                    <button
                      key={roleName}
                      type="button"
                      onClick={() => handleToggleUserRole(roleName)}
                      className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
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
                Chọn role từ các nút phía trên rồi lưu lại. Role nào bật sẽ được áp dụng ngay khi lưu.
              </p>
              <button
                type="button"
                onClick={handleSaveUserRoles}
                disabled={isSavingUserRoles}
                className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-surface transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingUserRoles ? <SpinnerGap size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                Save roles
              </button>
            </div>

            <div className="mt-5 rounded-[24px] border border-border bg-background p-4">
              <p className="text-sm font-medium text-primary">Current permissions</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedUserPermissionSet.size > 0 ? (
                  selectedUserPermissions.map((permission) => <Pill key={permission}>{permission}</Pill>)
                ) : (
                  <span className="text-sm text-muted">No permission assigned.</span>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="mt-5 rounded-[24px] border border-dashed border-border bg-background p-6 text-sm text-muted">
            Chọn một user từ bảng bên trên để chỉnh role.
          </div>
        )}
      </section>

      <section className="rounded-[28px] border border-border bg-surface p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-primary">Permission catalog</h2>
            <p className="mt-1 text-sm text-muted">Danh sách permission hiện có trong hệ thống.</p>
          </div>
          <Pill tone="accent">{permissions.length} codes</Pill>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {permissionCatalog.map((permission) => (
            <span
              key={permission.name}
              className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-primary"
            >
              {permission.name}
            </span>
          ))}
        </div>
      </section>

      <section className="rounded-[28px] border border-border bg-surface p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl border border-border bg-background p-3">
            <ShieldCheck size={24} className="text-primary" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted">permission_version</p>
            <h3 className="mt-1 text-lg font-semibold text-primary">Why it changes</h3>
          </div>
        </div>
        <div className="mt-4 space-y-3 text-sm leading-6 text-muted">
          <p>
            Backend bumps <code className="rounded bg-background px-1 py-0.5">permission_version</code> when the
            effective access of a user changes.
          </p>
          <ul className="space-y-2">
            <li>1. Admin changes a user's roles.</li>
            <li>2. Admin edits permissions on a role.</li>
            <li>3. Cache keys are invalidated using the new version.</li>
          </ul>
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
    </div>
  );
}
