import type { Metadata } from "next";
import { Suspense } from "react";
import { formatTimestamp } from "@/lib/admin/format";
import { requireArea } from "@/lib/auth/session";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { contactCounts, listContacts } from "@/lib/marketing/contacts";
import { mailchimpConnected } from "@/lib/marketing/mailchimp";
import { siteConfig } from "@/lib/site-config";
import { PageBody, PageHeader } from "../../_components/ui";
import { NewsletterBoard, type ContactView } from "./newsletter-board";

export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const { admin } = await getDictionary(DEFAULT_LOCALE);
  return { title: `${admin.nav.newsletter ?? "Newsletter"} — Ecram Execs` };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default function NewsletterPage(props: Props) {
  return (
    <Suspense fallback={<PageBody><div className="min-h-[40vh]" aria-busy="true" /></PageBody>}>
      <Newsletter {...props} />
    </Suspense>
  );
}

const STATUSES = ["subscribed", "unsubscribed", "suppressed"] as const;

/**
 * The newsletter list (the client, 27 Nov 2026): who agreed to receive news and offers, from a booking's tick or a
 * corporate sign-up (lib/marketing/contacts.ts), kept in step with Mailchimp when it is connected.
 */
async function Newsletter({ searchParams }: Props) {
  await requireArea("/admin/newsletter");
  const params = await searchParams;
  const status = STATUSES.find((value) => value === params.status) ?? undefined;
  const q = typeof params.q === "string" ? params.q.slice(0, 100) : "";
  const [rows, counts] = await Promise.all([listContacts({ status, q }), contactCounts()]);
  const contacts: ContactView[] = rows.map((row) => ({
    id: row.id,
    email: row.email,
    name: row.name,
    source: row.source,
    sourceRef: row.sourceRef,
    status: row.status,
    consentedAt: row.consentedAt ? formatTimestamp(row.consentedAt) : null,
    changedAt: formatTimestamp(row.updatedAt),
    syncPending: row.syncPending,
    syncError: row.syncError,
  }));
  return (
    <PageBody>
      <PageHeader
        title="Newsletter"
        description={`Everyone who agreed to receive news and offers. To be removed, a client emails ${siteConfig.contact.email}; mark them “Removed” here and they are never added again.`}
      />
      <NewsletterBoard contacts={contacts} counts={counts} status={status ?? null} q={q} mailchimp={mailchimpConnected()} />
    </PageBody>
  );
}
