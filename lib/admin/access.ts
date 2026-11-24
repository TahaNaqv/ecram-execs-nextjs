export const STAFF_ROLES = ["owner", "manager", "staff"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const STAFF_PERMISSIONS = ["enquiries", "bookings", "approve", "calendar", "financials", "templates", "staff", "corporate", "fleet", "drivers", "staff_accounts"] as const;
export type StaffPermission = (typeof STAFF_PERMISSIONS)[number];

/** Areas offered when creating a team account. `staff_accounts` is the right to add more accounts. */
export const ACCOUNT_AREAS = ["enquiries", "bookings", "corporate", "fleet", "drivers", "staff_accounts"] as const;
export type AccountArea = (typeof ACCOUNT_AREAS)[number];

const MANAGER: StaffPermission[] = ["enquiries", "bookings", "approve", "calendar", "financials", "templates"];
const STAFF: StaffPermission[] = ["enquiries", "bookings", "calendar"];

export function isStaffRole(value: string | null | undefined): value is StaffRole {
  return value === "owner" || value === "manager" || value === "staff";
}

export function permissionsFor(role: StaffRole, stored: readonly string[] | null | undefined): StaffPermission[] {
  if (role === "owner") return [...STAFF_PERMISSIONS];
  const allowed = new Set<string>(STAFF_PERMISSIONS);
  const picked = (stored ?? []).filter((item): item is StaffPermission => allowed.has(item));
  if (picked.length > 0) return picked;
  return role === "manager" ? [...MANAGER] : [...STAFF];
}

export function can(role: StaffRole, stored: readonly string[] | null | undefined, permission: StaffPermission) {
  const granted = permissionsFor(role, stored);
  if (granted.includes(permission)) return true;
  return permission === "staff" && granted.includes("staff_accounts");
}

/** Owners, and anyone given Staff accounts, may add a team sign-in. */
export function mayCreateAccounts(role: StaffRole, stored: readonly string[] | null | undefined) {
  return role === "owner" || permissionsFor(role, stored).includes("staff_accounts");
}

export function readTeamAccount(input: { name: string; email: string; password: string; role: string; permissions: readonly string[] }):
  | { ok: false; error: "short" | "failed" }
  | { ok: true; name: string; email: string; password: string; role: StaffRole; permissions: StaffPermission[] } {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!isStaffRole(input.role) || name.length === 0 || !email.includes("@")) return { ok: false, error: "failed" };
  if (input.password.length < 12) return { ok: false, error: "short" };
  const permissions = input.role === "owner" ? permissionsFor("owner", []) : ACCOUNT_AREAS.filter((area) => input.permissions.includes(area));
  return { ok: true, name, email, password: input.password, role: input.role, permissions };
}
