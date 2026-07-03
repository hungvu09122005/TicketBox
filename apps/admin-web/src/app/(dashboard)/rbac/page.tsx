'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ArrowClockwise,
  CheckCircle,
  MagnifyingGlass,
  Plus,
  ShieldCheck,
  SpinnerGap,
} from '@phosphor-icons/react';
import { useAuthStore } from '@/lib/auth-store';
import { Permission } from '@/lib/permissions';
import { roleOrder, roleOptions } from '@/lib/rbac';
import type { RbacPermissionSummary, RbacRoleSummary } from '@/lib/rbac.types';
import { rbacService } from '@/lib/services/rbac.service';

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

export default function RbacPage() {
  const admin = useAuthStore((state) => state.admin);
  const currentPermissions = useAuthStore((state) => state.permissions);
  const canManageRbac = currentPermissions.includes(Permission.RBAC_MANAGE);

  const [roles, setRoles] = useState<RbacRoleSummary[]>([]);
  const [permissions, setPermissions] = useState<RbacPermissionSummary[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);
  const [isSavingRolePermissions, setIsSavingRolePermissions] = useState<Record<string, boolean>>({});
  const [isCreatingPermission, setIsCreatingPermission] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [newPermissionName, setNewPermissionName] = useState('');

  const roleLookup = useMemo(
    () => new Map(roles.map((role) => [role.name, role] as const)),
    [roles],
  );

  const permissionCatalog = useMemo(() => {
    const catalog =
      permissions.length > 0
        ? permissions
        : roleOptions.flatMap((option) =>
            option.permissions.map((permission) => ({ id: permission, name: permission })),
          );

    const uniquePermissions = new Map<string, (typeof catalog)[number]>();
    for (const permission of catalog) {
      if (!uniquePermissions.has(permission.name)) {
        uniquePermissions.set(permission.name, permission);
      }
    }

    return Array.from(uniquePermissions.values()).sort((left, right) =>
      left.name.localeCompare(right.name),
    );
  }, [permissions]);

  const refreshAll = () => setReloadNonce((value) => value + 1);

  const confirmSensitiveAction = (message: string) => {
    if (typeof window === 'undefined') {
      return false;
    }

    return window.confirm(message);
  };

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

  const handleToggleRolePermission = async (roleName: string, permissionName: string) => {
    const role = roleLookup.get(roleName);
    if (!role) return;

    if (
      !confirmSensitiveAction(
        `${role.permissions.includes(permissionName) ? 'Gỡ' : 'Gán'} permission ${permissionName} cho role ${roleLabel(roleName)}?`,
      )
    ) {
      return;
    }

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

    if (!confirmSensitiveAction(`Tạo permission mới "${nextName}"?`)) {
      return;
    }

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
        <div className="grid gap-6 lg:items-start xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div className="min-w-0 max-w-2xl">
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted">Access control</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-primary">Roles & permissions</h1>
            <p className="mt-3 text-sm leading-6 text-muted">
              Quản lý role và permission của hệ thống. Phần user đã được tách sang trang riêng.
            </p>
          </div>

          <div className="grid min-w-0 gap-3 grid-cols-1 sm:grid-cols-2 xl:max-w-[760px]">
            <StatCard label="Current admin" value={admin?.name ?? '--'} hint={admin?.email ?? 'No active profile'} />
            <StatCard label="Roles" value={roles.length} hint="Editable role catalog" />
            <StatCard label="Permissions" value={permissions.length} hint="Available permission codes" />
            <StatCard label="Your access" value="RBAC" hint="Manage role and permission mapping" />
          </div>
        </div>
      </div>

      <section className="rounded-[28px] border border-border bg-surface p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-primary">Permission matrix</h2>
            <p className="mt-1 text-sm text-muted">Tích vào ô để gán permission cho từng role.</p>
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
                        <p className="font-medium text-primary">{permission.name}</p>
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
            <li>1. Admin changes a user&apos;s roles.</li>
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
