import type { Metadata } from "next";
import { Suspense } from "react";
import { bookingRules } from "@/lib/admin/booking-rules";
import { requireArea } from "@/lib/auth/session";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { Card, CardHeader, PageBody, PageHeader } from "../../_components/ui";
import { saveBookingRules } from "./actions";
import { BookingRulesForm } from "./booking-rules-form";
import { LegalEditor } from "./legal-editor";
import { SITE_ADDRESS, appVersion, emailProvider, legalVersions, moneybirdConnected, paymentsMode, platformCounts } from "./platform";

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

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function Status({ on, children }: { on: boolean | "warn"; children: React.ReactNode }) {
  const tone = on === true ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : on === "warn" ? "bg-amber-50 text-amber-800 ring-amber-200" : "bg-zinc-100 text-zinc-600 ring-zinc-200";
  const dot = on === true ? "bg-emerald-500" : on === "warn" ? "bg-amber-500" : "bg-zinc-400";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${tone}`}>
      <span className={`size-1.5 rounded-full ${dot}`} aria-hidden="true" />
      {children}
    </span>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-xs font-medium text-zinc-500">{label}</dt>
      <dd className="m-0 min-w-0 text-sm text-zinc-950">{children}</dd>
    </div>
  );
}

async function Desk() {
  await requireArea("/admin/desk");
  const [rules, terms, privacy, counts, version] = await Promise.all([bookingRules(), legalVersions("terms"), legalVersions("privacy"), platformCounts(), appVersion()]);
  const payments = paymentsMode();
  const email = emailProvider();
  const moneybird = moneybirdConnected();
  const environment = process.env.NODE_ENV ?? "unknown";
  const liveTerms = terms.find((entry) => entry.current);
  const livePrivacy = privacy.find((entry) => entry.current);

  return (
    <PageBody>
      <PageHeader title="Settings" description="How the platform is set up, the booking rules, the Terms & Conditions and the Privacy Policy." />

      <Card className="mt-6">
        <CardHeader title="Platform" description="What is running now. Keys and passwords are never shown here." />
        <dl className="m-0 grid gap-x-6 gap-y-5 px-5 py-5 sm:grid-cols-2 lg:grid-cols-4">
          <Fact label="Site address">
            <a href={SITE_ADDRESS} target="_blank" rel="noopener noreferrer" className="break-all text-zinc-950 underline underline-offset-2">
              {SITE_ADDRESS.replace("https://", "")}
            </a>
          </Fact>
          <Fact label="App version">
            <span className="font-mono text-[13px]">{version}</span>
          </Fact>
          <Fact label="Environment">
            <Status on={environment === "production" ? true : "warn"}>{environment === "production" ? "Production" : environment}</Status>
          </Fact>
          <Fact label="Online payments (Mollie)">
            <Status on={payments === "Live" ? true : payments === "Test mode" ? "warn" : false}>{payments}</Status>
          </Fact>
          <Fact label="Invoicing (Moneybird)">
            <Status on={moneybird}>{moneybird ? "Connected" : "Not connected"}</Status>
          </Fact>
          <Fact label="Email sending">
            <Status on={email ? true : "warn"}>{email ? `On (${email})` : "Not set up, emails are only logged"}</Status>
          </Fact>
          <Fact label="Team and fleet">
            {plural(counts.staff, "staff account", "staff accounts")}, {plural(counts.vehicles, "vehicle", "vehicles")}
          </Fact>
          <Fact label="Drivers and partners">
            {plural(counts.drivers, "active driver", "active drivers")}, {plural(counts.partners, "corporate partner", "corporate partners")}
          </Fact>
        </dl>
        <div className="grid gap-3 border-t border-zinc-100 px-5 py-4 text-sm text-zinc-700 md:grid-cols-2">
          <p className="m-0">
            <span className="font-medium text-zinc-950">Booking rules: </span>
            bookings must be made at least {plural(rules.minNoticeHours, "hour", "hours")} before pickup, {plural(rules.waitingMinutes, "minute", "minutes")} of waiting
            at pickup are included, and the cancellation window is {plural(rules.cancellationHours, "hour", "hours")} before pickup.
          </p>
          <p className="m-0">
            <span className="font-medium text-zinc-950">Legal pages: </span>
            {liveTerms ? `Terms & Conditions version ${liveTerms.version}` : "the built-in Terms & Conditions"} and{" "}
            {livePrivacy ? `Privacy Policy version ${livePrivacy.version}` : "the built-in Privacy Policy"} are on the website
            {terms.some((entry) => entry.status === "draft") || privacy.some((entry) => entry.status === "draft") ? "; there are unpublished drafts." : "."}
          </p>
        </div>
      </Card>

      <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Booking rules" description="Checked when a booking is made." />
            <BookingRulesForm rules={rules} action={saveBookingRules} />
          </Card>
        </div>
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Terms & Conditions" description="Work on a draft, then publish it: the website and new bookings use it at once." />
            <LegalEditor doc="terms" name="Terms & Conditions" versions={terms} publicPath="/terms" />
          </Card>
          <Card>
            <CardHeader title="Privacy Policy" description="Work on a draft, then publish it: the website shows it at once." />
            <LegalEditor doc="privacy" name="Privacy Policy" versions={privacy} publicPath="/privacy" />
          </Card>
        </div>
      </div>
    </PageBody>
  );
}
