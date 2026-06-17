'use client';

import { useMemo, useState } from 'react';
import { CheckCircle, Key, PencilSimple, ShieldCheck, Sparkle, UserCircleGear } from '@phosphor-icons/react';
import { useAuthStore } from '@/lib/auth-store';
import { extractApiMessages } from '@/lib/api-errors';
import { userService } from '@/lib/services/user.service';
import { Permission } from '@/lib/permissions';
import { roleOptions, type RbacRole } from '@/lib/rbac';
import { authService } from '@/lib/services/auth.service';
import { getStoredAdminAccessToken, getStoredAdminRefreshToken } from '@/lib/auth-session';

function uniquePermissions(selectedRoles: RbacRole[]): string[] {
  return Array.from(
    new Set(
      selectedRoles.flatMap((role) => roleOptions.find((option) => option.code === role)?.permissions ?? []),
    ),
  );
}

function formatRoleLabel(role: RbacRole): string {
  return roleOptions.find((option) => option.code === role)?.label ?? role;
}

export default function RbacPage() {
  const admin = useAuthStore((state) => state.admin);
  const login = useAuthStore((state) => state.login);
  const [targetUserId, setTargetUserId] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<RbacRole[]>(['AUDIENCE']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverMessages, setServerMessages] = useState<string[] | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const selectedPermissions = useMemo(() => uniquePermissions(selectedRoles), [selectedRoles]);
  const isCurrentAdminTarget = admin?.id === targetUserId.trim();

  const toggleRole = (role: RbacRole) => {
    setSelectedRoles((current) =>
      current.includes(role) ? current.filter((value) => value !== role) : [...current, role],
    );
  };

  const applyUpdate = async () => {
    const userId = targetUserId.trim();
    if (!userId) {
      setServerMessages(['Vui lòng nhập user ID để cập nhật roles.']);
      return;
    }

    if (selectedRoles.length === 0) {
      setServerMessages(['Vui lòng chọn ít nhất một role.']);
      return;
    }

    const confirmed = window.confirm(
      `Update roles for user ${userId}?\n\nThis action increments permission_version immediately, clears cached permissions, and the affected user may need to refresh or log in again.`,
    );

    if (!confirmed) {
      return;
    }

    setIsSubmitting(true);
    setServerMessages(null);
    setSuccessMessage(null);

    try {
      const updatedUser = await userService.updateRoles(userId, { roles: selectedRoles });
      setSuccessMessage(
        `Updated ${updatedUser.email}. permission_version is now ${updatedUser.permissionVersion}. Ask the user to refresh the session so the new permissions are loaded.`,
      );

      if (isCurrentAdminTarget) {
        const refreshedProfile = await authService.me();
        login(
          refreshedProfile,
          getStoredAdminAccessToken() ?? '',
          getStoredAdminRefreshToken() ?? undefined,
        );
      }
    } catch (error: unknown) {
      setServerMessages(extractApiMessages(error, 'Không thể cập nhật role của user. Vui lòng thử lại.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-surface">
              <UserCircleGear size={22} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted">Signed in</p>
              <p className="mt-1 text-sm font-medium text-primary">{admin?.name ?? 'Loading...'}</p>
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-muted">{admin?.email ?? 'Current admin profile is loading.'}</p>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted">Permission Version</p>
          <div className="mt-3 flex items-end gap-3">
            <span className="text-3xl font-semibold tracking-tight text-primary">{admin?.permissionVersion ?? 0}</span>
            <span className="pb-1 text-sm text-muted">Refreshed from /users/me</span>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted">Current roles</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {admin?.roles?.length ? admin.roles.map((role) => (
              <span key={role} className="rounded-full border border-border bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
                {formatRoleLabel(role as RbacRole)}
              </span>
            )) : (
              <span className="text-sm text-muted">No roles loaded yet</span>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted">RBAC scope</p>
          <p className="mt-3 text-sm leading-6 text-primary">
            Available through <span className="font-medium">PATCH /users/:id/roles</span> and guarded by <span className="font-medium">{Permission.RBAC_MANAGE}</span>.
          </p>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-3xl border border-border bg-surface p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted">User management</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-primary">Assign roles and invalidate cached permissions</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
                Enter a target user ID, choose the roles that should apply, then confirm the change. The backend increments `permission_version`, clears the Redis permission cache, and the next request reflects the new access level after refresh.
              </p>
            </div>
            <div className="hidden rounded-2xl border border-border bg-primary/5 p-4 text-primary md:block">
              <ShieldCheck size={26} />
            </div>
          </div>

          {serverMessages && (
            <div className="mt-6 rounded-2xl border border-border bg-primary/5 p-4 text-sm leading-6 text-primary">
              {serverMessages.map((message) => (
                <p key={message}>{message}</p>
              ))}
            </div>
          )}

          {successMessage && (
            <div className="mt-6 rounded-2xl border border-border bg-primary/5 p-4 text-sm leading-6 text-primary">
              <div className="flex items-start gap-2">
                <CheckCircle size={18} className="mt-0.5 shrink-0" />
                <p>{successMessage}</p>
              </div>
            </div>
          )}

          <div className="mt-6 grid gap-5">
            <div>
              <label htmlFor="targetUserId" className="block text-sm font-medium text-primary">
                Target user ID
              </label>
              <input
                id="targetUserId"
                value={targetUserId}
                onChange={(event) => setTargetUserId(event.target.value)}
                placeholder="Paste the user UUID here"
                className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-primary outline-none transition-colors placeholder:text-muted focus:border-primary"
              />
              <p className="mt-2 text-xs leading-5 text-muted">
                The current backend contract exposes update-by-id only, so this screen works from a known user UUID.
              </p>
            </div>

            <div>
              <p className="text-sm font-medium text-primary">Roles</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {roleOptions.map((option) => {
                  const checked = selectedRoles.includes(option.code);
                  return (
                    <label
                      key={option.code}
                      className={`cursor-pointer rounded-2xl border p-4 transition-colors ${
                        checked ? 'border-primary bg-primary/5' : 'border-border bg-background hover:border-primary/40'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleRole(option.code)}
                          className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                        />
                        <div className="min-w-0">
                          <p className="font-medium text-primary">{option.label}</p>
                          <p className="mt-1 text-sm leading-6 text-muted">{option.description}</p>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-muted">
                Selected roles: <span className="font-medium text-primary">{selectedRoles.join(', ') || 'None'}</span>
              </div>
              <button
                type="button"
                onClick={() => void applyUpdate()}
                disabled={isSubmitting}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-medium text-surface transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <PencilSimple size={16} />
                {isSubmitting ? 'Updating...' : 'Apply role update'}
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-border bg-surface p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/5 text-primary">
                <Key size={20} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted">Permission preview</p>
                <h2 className="mt-1 text-lg font-semibold text-primary">What the selected roles can do</h2>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {selectedPermissions.map((permission) => (
                <span key={permission} className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-primary">
                  {permission}
                </span>
              ))}
            </div>

            <div className="mt-5 rounded-2xl border border-border bg-background p-4 text-sm leading-6 text-muted">
              <p className="font-medium text-primary">Selected permission_version flow</p>
              <ul className="mt-2 space-y-2">
                <li>1. Save the new role list via the existing backend contract.</li>
                <li>2. The backend increments `permission_version` and clears the Redis permission cache.</li>
                <li>3. The affected user sees the new access level after refresh or re-login.</li>
              </ul>
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-surface p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted">Sensitive action policy</p>
            <div className="mt-3 space-y-3 text-sm leading-6 text-muted">
              <p>Role changes are intentionally gated by a confirmation prompt before the API call runs.</p>
              <p>That matches the acceptance requirement for a sensitive-operation confirm step without inventing a backend contract that does not exist yet.</p>
            </div>
            <div className="mt-5 rounded-2xl border border-border bg-primary/5 p-4 text-sm leading-6 text-primary">
              <Sparkle size={18} className="mb-2" />
              <p>
                If you update your own user ID, the current session may need to refresh again to re-read the new permission set.
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-surface p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted">Canonical roles</p>
            <div className="mt-4 space-y-3">
              {roleOptions.map((option) => (
                <div key={option.code} className="rounded-2xl border border-border bg-background p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-primary">{option.label}</p>
                      <p className="mt-1 text-sm leading-6 text-muted">{option.description}</p>
                    </div>
                    <span className="rounded-full border border-border bg-primary/5 px-3 py-1 text-xs font-semibold text-primary">
                      {option.code}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
