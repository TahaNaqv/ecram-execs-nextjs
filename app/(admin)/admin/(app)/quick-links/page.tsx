import type { Metadata } from "next";
import { Suspense } from "react";
import { quickLinks } from "@/lib/admin/quick-links";
import { requireArea } from "@/lib/auth/session";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { LinkIcon } from "../../_components/icons";
import { Card, CardHeader, PageBody, PageHeader } from "../../_components/ui";
import { QuickLinksEditor } from "./quick-links-editor";

function linkHost(href: string) {
  try {
    return new URL(href).host;
  } catch {
    return href;
  }
}

export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const { admin } = await getDictionary(DEFAULT_LOCALE);
  return { title: `${admin.nav.quickLinks ?? "Quick Links"} — Ecram Execs` };
}

export default function QuickLinksPage() {
  return (
    <Suspense fallback={<PageBody><div className="min-h-[40vh]" aria-busy="true" /></PageBody>}>
      <QuickLinks />
    </Suspense>
  );
}

/** The outside tools the team works in, one click away (moved out of Settings, 27 Nov 2026). Owners edit the list. */
async function QuickLinks() {
  const admin = await requireArea("/admin/quick-links");
  const links = await quickLinks();
  return (
    <PageBody>
      <PageHeader title="Quick Links" description="The outside tools the team works in. Each opens in a new tab." />
      {links.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-500">No links yet.</p>
      ) : (
        <ul className="m-0 mt-6 grid list-none gap-3 p-0 sm:grid-cols-2 xl:grid-cols-3">
          {links.map((link, index) => (
            <li key={`${index}:${link.label}:${link.href}`}>
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-xl border border-zinc-200/80 bg-white px-4 py-3.5 no-underline shadow-card transition-colors hover:border-zinc-300 hover:bg-zinc-50"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-zinc-100 text-zinc-600">
                  <LinkIcon size={16} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-zinc-950">{link.label}</span>
                  <span className="block truncate text-xs text-zinc-500">{linkHost(link.href)}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
      {admin.role === "owner" && (
        <Card className="mt-6">
          <CardHeader title="Edit the links" description="Shown here and on the dashboard to everyone with access to Billing & Financials." />
          <QuickLinksEditor links={links} />
        </Card>
      )}
    </PageBody>
  );
}
