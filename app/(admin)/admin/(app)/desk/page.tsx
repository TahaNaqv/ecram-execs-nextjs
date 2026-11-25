import type { Metadata } from "next";
import { Suspense } from "react";
import { bookingRules, currentTerms } from "@/lib/admin/booking-rules";
import { QUICK_LINKS } from "@/lib/admin/quick-links";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { btn, Card, CardHeader, PageBody, PageHeader, field } from "../../_components/ui";
import { saveBookingRules, saveTerms } from "./actions";

export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const { admin } = await getDictionary(DEFAULT_LOCALE);
  return { title: `${admin.nav.desk ?? "Settings"} — Ecram Execs` };
}

export default function DeskPage() {
  return (
    <Suspense fallback={<PageBody><div className="min-h-[40vh]" aria-busy="true" /></PageBody>}>
      <Desk />
    </Suspense>
  );
}

async function Desk() {
  const [rules, terms] = await Promise.all([bookingRules(), currentTerms()]);
  return (
    <PageBody>
      <PageHeader title="Settings" />
      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Booking rules" />
          <form action={saveBookingRules} className="flex flex-col gap-3 px-5 py-4">
            <label className="text-[13px] text-zinc-700">Minimum notice (hours)<input name="minNoticeHours" type="number" min={0} defaultValue={rules.minNoticeHours} className={`${field} mt-1 h-10`} /></label>
            <label className="text-[13px] text-zinc-700">Included waiting time (minutes)<input name="waitingMinutes" type="number" min={0} defaultValue={rules.waitingMinutes} className={`${field} mt-1 h-10`} /></label>
            <label className="text-[13px] text-zinc-700">Cancellation window (hours)<input name="cancellationHours" type="number" min={0} defaultValue={rules.cancellationHours} className={`${field} mt-1 h-10`} /></label>
            <button className={`${btn.base} ${btn.primary} ${btn.md} self-start`}>Save rules</button>
          </form>
        </Card>
        <Card>
          <CardHeader title="Terms & Conditions" />
          <form action={saveTerms} className="flex flex-col gap-3 px-5 py-4">
            <label className="text-[13px] text-zinc-700">Version<input name="version" defaultValue={terms.version} className={`${field} mt-1 h-10`} /></label>
            <label className="text-[13px] text-zinc-700">Text<textarea name="body" rows={8} defaultValue={terms.body} className={`${field} mt-1`} /></label>
            <button className={`${btn.base} ${btn.primary} ${btn.md} self-start`}>Save terms</button>
          </form>
        </Card>
      </div>
      <Card className="mt-4">
        <CardHeader title="Quick access" />
        <ul className="m-0 flex list-none flex-col gap-2 px-5 py-4">
          {QUICK_LINKS.map(([label, href]) => (
            <li key={href}><a href={href} target="_blank" rel="noopener noreferrer" className="text-sm text-zinc-950 underline underline-offset-2">{label}</a></li>
          ))}
        </ul>
      </Card>
    </PageBody>
  );
}
