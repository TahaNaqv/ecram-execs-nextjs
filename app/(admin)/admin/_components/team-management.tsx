import { type AccountArea, type StaffRole } from "@/lib/admin/access";
import { ensureInitialStaff, listStaff } from "@/lib/admin/staff";
import { requireAdmin } from "@/lib/auth/session";
import { adminDictionary } from "@/lib/i18n/get-dictionary";
import { TeamDesk } from "./team-desk";

/** Team cards and the create-account dialog, shared by Staff and My account. */
export async function TeamManagement() {
  const [{ admin: t }, admin] = await Promise.all([adminDictionary(), requireAdmin()]);
  await ensureInitialStaff();
  const people = await listStaff();
  const labels: Record<AccountArea, string> = {
    enquiries: t.staffDesk.permEnquiries,
    bookings: t.staffDesk.permBookings,
    corporate: t.staffDesk.permCorporate,
    fleet: t.staffDesk.permFleet,
    drivers: t.staffDesk.permDrivers,
    staff_accounts: t.staffDesk.permStaffAccounts,
  };
  const roleLabel: Record<StaffRole, string> = { owner: t.staffDesk.owner, manager: t.staffDesk.manager, staff: t.staffDesk.staff };
  const copy = {
    ...t.staffDesk,
    email: t.account.email,
    short: t.account.short,
    invalid: t.staffDesk.invalid,
    showPassword: t.account.showPassword,
    hidePassword: t.account.hidePassword,
  };
  return (
    <TeamDesk
      viewerId={admin.id}
      people={people.map((person) => ({
        id: person.id,
        name: person.name,
        email: person.email,
        role: person.role,
        permissions: person.permissions,
      }))}
      labels={labels}
      roleLabel={roleLabel}
      copy={copy}
    />
  );
}
