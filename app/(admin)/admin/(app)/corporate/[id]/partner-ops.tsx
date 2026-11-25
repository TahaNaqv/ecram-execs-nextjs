import { asc, desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { btn, Card, CardHeader, field } from "../../../_components/ui";
import { addBooker, archivePartner, deleteBooker, restorePartner, savePartnerOps, updateBooker } from "./ops-actions";

export async function PartnerOps({ contactId }: { contactId: string }) {
  const [contact] = await db.select().from(schema.corporateContacts).where(eq(schema.corporateContacts.id, contactId)).limit(1);
  if (!contact) return null;
  const [bookers, history, managers, introducers] = await Promise.all([
    db.select().from(schema.corporateBookers).where(eq(schema.corporateBookers.contactId, contactId)).orderBy(asc(schema.corporateBookers.name)),
    db.select().from(schema.corporateAudit).where(eq(schema.corporateAudit.contactId, contactId)).orderBy(desc(schema.corporateAudit.createdAt)).limit(30),
    db.select({ id: schema.adminUsers.id, name: schema.adminUsers.name }).from(schema.adminUsers).orderBy(asc(schema.adminUsers.name)),
    db.select({ id: schema.introducers.id, name: schema.introducers.name }).from(schema.introducers).orderBy(asc(schema.introducers.name)),
  ]);
  return (
    <div className="mt-6 grid gap-4">
      <Card>
        <CardHeader title="Partner record" description={contact.archivedAt ? "Archived" : "Preferred contact, payment window, billing and who looks after this account."} />
        <form action={savePartnerOps} className="grid gap-3 px-5 py-4 md:grid-cols-2">
          <input type="hidden" name="id" value={contact.id} />
          <label className="text-[13px] text-zinc-700">Preferred communication
            <select name="preferredContact" defaultValue={contact.preferredContact ?? ""} className={`${field} mt-1 h-10`}>
              <option value="">Not set</option>
              <option value="email">Email</option>
              <option value="phone">Phone</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
          </label>
          <label className="text-[13px] text-zinc-700">Payment window
            <select name="paymentTermsDays" defaultValue={contact.paymentTermsDays ?? ""} className={`${field} mt-1 h-10`}>
              <option value="">Not set</option>
              <option value="7">7 days</option>
              <option value="14">14 days</option>
              <option value="30">30 days</option>
            </select>
          </label>
          <label className="text-[13px] text-zinc-700">Account manager
            <select name="accountManagerId" defaultValue={contact.accountManagerId ?? ""} className={`${field} mt-1 h-10`}>
              <option value="">Unassigned</option>
              {managers.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
            </select>
          </label>
          <label className="text-[13px] text-zinc-700">Introducer
            <select name="introducerId" defaultValue={contact.introducerId ?? ""} className={`${field} mt-1 h-10`}>
              <option value="">None</option>
              {introducers.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
            </select>
          </label>
          <label className="text-[13px] text-zinc-700">Billing street<input name="billingStreet" defaultValue={contact.billingStreet ?? ""} className={`${field} mt-1 h-10`} /></label>
          <label className="text-[13px] text-zinc-700">Postcode<input name="billingPostcode" defaultValue={contact.billingPostcode ?? ""} className={`${field} mt-1 h-10`} /></label>
          <label className="text-[13px] text-zinc-700">City<input name="billingCity" defaultValue={contact.billingCity ?? ""} className={`${field} mt-1 h-10`} /></label>
          <label className="text-[13px] text-zinc-700">VAT number<input name="vatNumber" defaultValue={contact.vatNumber ?? ""} className={`${field} mt-1 h-10`} /></label>
          <label className="text-[13px] text-zinc-700 md:col-span-2">Client preferences<textarea name="preferences" rows={3} defaultValue={contact.preferences ?? ""} className={`${field} mt-1`} /></label>
          <button className={`${btn.base} ${btn.primary} ${btn.md} self-start`}>Save partner</button>
        </form>
      </Card>
      <Card>
        <CardHeader title="Bookers" description="People who book for this partner, besides the account login." />
        <ul className="m-0 list-none px-5 py-3">
          {bookers.map((booker) => (
            <li key={booker.id} className="border-b border-zinc-100 py-3">
              <form action={updateBooker} className="grid gap-2 md:grid-cols-4">
                <input type="hidden" name="id" value={booker.id} />
                <input name="name" required defaultValue={booker.name} aria-label="Name" className={`${field} h-10`} />
                <input name="email" type="email" defaultValue={booker.email ?? ""} aria-label="Email" className={`${field} h-10`} />
                <input name="phone" defaultValue={booker.phone ?? ""} aria-label="Phone" className={`${field} h-10`} />
                <input name="position" defaultValue={booker.position ?? ""} aria-label="Position" className={`${field} h-10`} />
                <button className={`${btn.base} ${btn.secondary} ${btn.sm} self-start`}>Save booker</button>
              </form>
              <form action={deleteBooker} className="mt-2">
                <input type="hidden" name="id" value={booker.id} />
                <button className={`${btn.base} ${btn.ghost} ${btn.sm} text-red-700`}>Remove booker</button>
              </form>
            </li>
          ))}
        </ul>
        <form action={addBooker} className="grid gap-2 border-t border-zinc-100 px-5 py-4 md:grid-cols-4">
          <input type="hidden" name="contactId" value={contact.id} />
          <input name="name" required placeholder="Name" className={`${field} h-10`} />
          <input name="email" type="email" placeholder="Email" className={`${field} h-10`} />
          <input name="phone" placeholder="Phone" className={`${field} h-10`} />
          <input name="position" placeholder="Position" className={`${field} h-10`} />
          <button className={`${btn.base} ${btn.secondary} ${btn.md} md:col-span-4 self-start`}>Add booker</button>
        </form>
      </Card>
      <Card>
        <CardHeader title="Change history" />
        <ul className="m-0 list-none px-5 py-3 text-sm text-zinc-700">
          {history.length === 0 ? <li className="py-2 text-zinc-500">No changes recorded yet.</li> : history.map((row) => (
            <li key={row.id} className="border-b border-zinc-100 py-2">{row.field}: {row.before ?? "—"} → {row.after ?? "—"}</li>
          ))}
        </ul>
      </Card>
      <Card>
        <CardHeader title="Archive" description="Archiving keeps the record and takes the partner off the active list. Type archive to confirm." />
        {contact.archivedAt ? (
          <form action={restorePartner} className="px-5 py-4">
            <input type="hidden" name="id" value={contact.id} />
            <button className={`${btn.base} ${btn.secondary} ${btn.md}`}>Restore partner</button>
          </form>
        ) : null}
        <form action={archivePartner} className="flex flex-wrap items-center gap-2 px-5 py-4">
          <input type="hidden" name="id" value={contact.id} />
          <input name="confirm" required pattern="archive" placeholder="archive" className={`${field} h-10 w-40`} />
          <button className={`${btn.base} ${btn.danger} ${btn.md}`}>Archive partner</button>
        </form>
      </Card>
    </div>
  );
}
