"use client";

import Link from "next/link";
import { useCallback, useState, useTransition } from "react";
import { ActionForm, pushToast } from "../../_components/action-feedback";
import { AdminModal } from "../../_components/admin-modal";
import { PlusIcon, RefreshIcon, SearchIcon } from "../../_components/icons";
import { btn, Card, field, fieldLabel } from "../../_components/ui";
import { addContact, changeContact, syncNow } from "./actions";

export type ContactView = {
  id: string;
  email: string;
  name: string | null;
  source: "booking" | "corporate" | "manual" | "mailchimp";
  sourceRef: string | null;
  status: "subscribed" | "unsubscribed" | "suppressed";
  consentedAt: string | null;
  changedAt: string;
  syncPending: boolean;
  syncError: string | null;
};

const SOURCE: Record<ContactView["source"], string> = {
  booking: "Booking form",
  corporate: "Corporate sign-up",
  manual: "Added by the team",
  mailchimp: "Mailchimp form",
};
const STATUS: Record<ContactView["status"], { label: string; tone: string }> = {
  subscribed: { label: "Subscribed", tone: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  unsubscribed: { label: "Unsubscribed", tone: "bg-zinc-100 text-zinc-600 ring-zinc-200" },
  suppressed: { label: "Removed", tone: "bg-red-50 text-red-700 ring-red-200" },
};

export function NewsletterBoard({
  contacts,
  counts,
  status,
  q,
  mailchimp,
}: {
  contacts: ContactView[];
  counts: { subscribed: number; unsubscribed: number; suppressed: number; pending: number };
  status: ContactView["status"] | null;
  q: string;
  mailchimp: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [confirm, setConfirm] = useState<{ contact: ContactView; to: "unsubscribed" | "suppressed" | "subscribed" | "delete" } | null>(null);
  const [pending, start] = useTransition();
  const closeAdd = useCallback(() => setAdding(false), []);
  const closeConfirm = useCallback(() => setConfirm(null), []);
  const href = (next: { status?: string | null; q?: string }) => {
    const params = new URLSearchParams();
    const s = next.status === undefined ? status : next.status;
    if (s) params.set("status", s);
    const query = next.q === undefined ? q : next.q;
    if (query) params.set("q", query);
    const text = params.toString();
    return `/admin/newsletter${text ? `?${text}` : ""}`;
  };

  function apply() {
    if (!confirm) return;
    const data = new FormData();
    data.set("id", confirm.contact.id);
    data.set("to", confirm.to);
    start(async () => {
      const result = await changeContact(data);
      setConfirm(null);
      if ("error" in result) return pushToast(result.error, false);
      pushToast(confirm.to === "delete" ? "Contact deleted." : "Contact updated.");
    });
  }

  function sync() {
    start(async () => {
      const result = await syncNow();
      if ("error" in result) return pushToast(result.error, false);
      pushToast(result.message ?? "Synced.");
    });
  }

  return (
    <>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {(["subscribed", "unsubscribed", "suppressed"] as const).map((key) => (
          <Link
            key={key}
            href={href({ status: status === key ? null : key })}
            className={`rounded-xl border bg-white px-4 py-3 no-underline shadow-card ${status === key ? "border-zinc-900" : "border-zinc-200/80 hover:border-zinc-300"}`}
          >
            <span className="block text-xs font-medium text-zinc-500">{STATUS[key].label}</span>
            <span className="block text-2xl font-semibold tabular-nums text-zinc-950">{counts[key]}</span>
          </Link>
        ))}
      </div>

      <Card className="mt-4">
        <div className="flex flex-wrap items-center gap-3 border-b border-zinc-100 px-5 py-3">
          <form action="/admin/newsletter" className="relative min-w-0 flex-1">
            {status ? <input type="hidden" name="status" value={status} /> : null}
            <SearchIcon size={14} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-zinc-400" />
            <input name="q" type="search" defaultValue={q} placeholder="Search by email or name" className={`${field} h-9 pl-8`} />
          </form>
          <button type="button" onClick={() => setAdding(true)} className={`${btn.base} ${btn.secondary} ${btn.md}`}>
            <PlusIcon size={14} /> Add someone
          </button>
          {/* A file download from a route handler, not a page: a plain link, so the browser saves it */}
          <a href="/admin/newsletter/export" download className={`${btn.base} ${btn.secondary} ${btn.md}`}>
            Export subscribed (CSV)
          </a>
          {mailchimp ? (
            <button type="button" disabled={pending} onClick={sync} className={`${btn.base} ${btn.primary} ${btn.md}`}>
              <RefreshIcon size={14} /> Sync to Mailchimp{counts.pending > 0 ? ` (${counts.pending})` : ""}
            </button>
          ) : null}
        </div>
        <p className={`m-0 border-b border-zinc-100 px-5 py-2.5 text-xs ${mailchimp ? "text-emerald-800" : "text-zinc-500"}`}>
          {mailchimp
            ? "Mailchimp is connected: every change here is sent to the audience, and unsubscribes there come back here."
            : "Mailchimp is not connected yet. The list is kept here; once the API key and audience are set on the server, “Sync to Mailchimp” sends it there."}
        </p>
        {contacts.length === 0 ? (
          <p className="m-0 px-5 py-8 text-center text-sm text-zinc-500">{q || status ? "No contacts match." : "No one has agreed to the newsletter yet."}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-zinc-100 text-xs text-zinc-500">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Contact</th>
                  <th className="px-4 py-2.5 font-medium">Agreed</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-5 py-2.5 text-right font-medium">Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {contacts.map((contact) => (
                  <tr key={contact.id}>
                    <td className="px-5 py-3">
                      <p className="m-0 font-medium text-zinc-950">{contact.email}</p>
                      {contact.name ? <p className="m-0 text-xs text-zinc-500">{contact.name}</p> : null}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-600">
                      {SOURCE[contact.source]}
                      {contact.sourceRef ? ` · ${contact.sourceRef}` : ""}
                      {contact.consentedAt ? <span className="block text-zinc-400">{contact.consentedAt}</span> : null}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS[contact.status].tone}`}>{STATUS[contact.status].label}</span>
                      {mailchimp && contact.syncError ? <span className="mt-1 block max-w-56 text-[11px] text-red-700">{contact.syncError}</span> : null}
                      {mailchimp && !contact.syncError && contact.syncPending ? <span className="mt-1 block text-[11px] text-zinc-400">Not yet in Mailchimp</span> : null}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {contact.status === "subscribed" ? (
                          <button type="button" onClick={() => setConfirm({ contact, to: "unsubscribed" })} className={`${btn.base} ${btn.secondary} ${btn.sm}`}>
                            Unsubscribe
                          </button>
                        ) : null}
                        {contact.status !== "suppressed" ? (
                          <button type="button" onClick={() => setConfirm({ contact, to: "suppressed" })} className={`${btn.base} ${btn.secondary} ${btn.sm}`}>
                            Remove
                          </button>
                        ) : null}
                        <button type="button" onClick={() => setConfirm({ contact, to: "delete" })} className={`${btn.base} ${btn.ghost} ${btn.sm} text-red-700`}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <AdminModal isOpen={adding} onClose={closeAdd} title="Add someone to the newsletter" subtitle="Only someone who asked you for it: their consent is recorded with today's date.">
        <ActionForm action={addContact} success="Added to the newsletter!" onDone={closeAdd} className="grid gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={fieldLabel}>Email</span>
            <input name="email" type="email" required maxLength={254} className={`${field} h-10`} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={fieldLabel}>Name (optional)</span>
            <input name="name" maxLength={120} className={`${field} h-10`} />
          </label>
          <label className="flex items-start gap-2 text-sm text-zinc-800">
            <input type="checkbox" name="consent" required className="mt-1" />
            They asked to receive news and offers by email.
          </label>
          <button className={`${btn.base} ${btn.primary} ${btn.md} w-fit`}>Add</button>
        </ActionForm>
      </AdminModal>

      <AdminModal
        isOpen={confirm !== null}
        onClose={closeConfirm}
        title={
          confirm?.to === "delete" ? "Delete this contact?" : confirm?.to === "suppressed" ? "Remove from the newsletter?" : confirm?.to === "unsubscribed" ? "Unsubscribe?" : "Subscribe again?"
        }
        subtitle={confirm?.contact.email}
      >
        {confirm && (
          <>
            <p className="m-0 text-sm text-zinc-700">
              {confirm.to === "delete"
                ? "Their address is erased from this list and from Mailchimp. A later newsletter tick would add them again; use Remove instead if they must never get it. This cannot be undone."
                : confirm.to === "suppressed"
                  ? "They no longer receive the newsletter and are never added again, not even by a new tick on a booking."
                  : "They no longer receive the newsletter. A new tick on a booking would add them again."}
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={closeConfirm} className={`${btn.base} ${btn.secondary} ${btn.md}`}>
                Cancel
              </button>
              <button type="button" disabled={pending} onClick={apply} className={`${btn.base} ${confirm.to === "delete" ? btn.danger : btn.primary} ${btn.md}`}>
                {confirm.to === "delete" ? "Delete" : confirm.to === "suppressed" ? "Remove" : "Unsubscribe"}
              </button>
            </div>
          </>
        )}
      </AdminModal>
    </>
  );
}
