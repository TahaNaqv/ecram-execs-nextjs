import { type AccountArea, type StaffRole } from "@/lib/admin/access";
import { ensureInitialStaff, listStaff } from "@/lib/admin/staff";
import { adminDictionary } from "@/lib/i18n/get-dictionary";
import { CreateAccountForm } from "../(app)/account/create-account";
import { Card, CardHeader } from "./ui";
import { TeamTable } from "./team-table";

/** Team list and the one create-account form, shared by Staff and My account. */
export async function TeamManagement() {
  const { admin: t } = await adminDictionary();
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
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.8fr)]">
      <Card className="overflow-hidden">
        <CardHeader title={t.staffDesk.people} />
        <TeamTable
          people={people}
          labels={labels}
          roleLabel={roleLabel}
          ownersAll={t.staffDesk.ownersAll}
          empty={t.staffDesk.peopleEmpty}
          columns={{ name: t.staffDesk.colName, email: t.staffDesk.colEmail, role: t.staffDesk.role, permissions: t.staffDesk.permissions }}
        />
      </Card>
      <Card className="overflow-hidden">
        <CardHeader title={t.staffDesk.sectionTitle} description={t.staffDesk.sectionNote} />
        <CreateAccountForm copy={copy} labels={labels} />
      </Card>
    </div>
  );
}
