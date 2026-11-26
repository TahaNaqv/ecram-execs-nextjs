"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { commissionBasisPoints, COMMISSION_SCHEDULE_BP, anniversary, formatRate } from "@/lib/admin/commission";
import { fillTemplate } from "@/lib/admin/template-tags";
import { AdminModal } from "../../_components/admin-modal";
import { ActionForm } from "../../_components/action-feedback";
import { MailIcon, PhoneIcon, PlusIcon, SearchIcon, TrashIcon, UsersIcon } from "../../_components/icons";
import { btn, Card, EmptyState, field, fieldLabel, PageHeader } from "../../_components/ui";
import { deleteIntroducer, emailIntroducer, saveIntroducer } from "./actions";

export type IntroducerView = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  notes: string | null;
  /** YYYY-MM-DD: the commission schedule counts tenure years from here */
  startDate: string;
  /** Today's rate, e.g. "2.5%", and the tenure year it belongs to */
  rate: string;
  tenureYear: number;
  /** "2% from 27 Nov 2027", or null once the rate is locked at 0.5% */
  nextChange: string | null;
  active: boolean;
  partners: { id: string; name: string }[];
  monthNet: string;
  monthCommission: string;
  monthCommissionCents: number;
  monthNetCents: number;
  monthYear: string;
  notified: string | null;
};

/** A non-archived corporate partner that can be linked to an introducer. */
export type PartnerOption = {
  id: string;
  company: string | null;
  name: string;
  email: string;
  introducerId: string | null;
};

const compact = "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2.5 h-8 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const NOTES_MAX = 500;

function PencilIcon() {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M21.17 6.81a2.83 2.83 0 0 0-4-4L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

export function IntroducerBoard({
  rows,
  partners,
  subjectTemplate,
  bodyTemplate,
}: {
  rows: IntroducerView[];
  partners: PartnerOption[];
  subjectTemplate: string;
  bodyTemplate: string;
}) {
  // `key` changes on every open, so the form always starts from the latest saved values.
  const [editor, setEditor] = useState<{ key: number; row: IntroducerView | null } | null>(null);
  const [preview, setPreview] = useState<IntroducerView | null>(null);
  const closeEditor = useCallback(() => setEditor(null), []);
  const open = (row: IntroducerView | null) => setEditor({ key: Date.now(), row });
  const names = useMemo(() => new Map(rows.map((row) => [row.id, row.name])), [rows]);

  const addButton = (
    <button type="button" onClick={() => open(null)} className={`${btn.base} ${btn.primary} ${btn.lg}`}>
      <PlusIcon /> Add introducer
    </button>
  );

  return (
    <>
      <PageHeader
        title="Introducers"
        description="People who introduce corporate partners. They earn a share of the net payments their partners make each month."
        actions={addButton}
      />
      <Card className="mt-6 overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState
            icon={<UsersIcon />}
            title="No introducers yet"
            description="Add an introducer and link the corporate partners they brought in to start tracking their commission."
            action={addButton}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[68rem] text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50/60 text-[12px] tracking-wide text-zinc-500 uppercase">
                  <th className="px-5 py-2.5 font-medium">Introducer</th>
                  <th className="px-4 py-2.5 font-medium">Contact</th>
                  <th className="px-4 py-2.5 font-medium">Corporate partners</th>
                  <th className="px-4 py-2.5 text-right font-medium">This month</th>
                  <th className="px-4 py-2.5 text-right font-medium">Commission</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-5 py-2.5 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <IntroducerRow key={row.id} row={row} onEdit={() => open(row)} onEmail={() => setPreview(row)} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {editor ? <IntroducerDialog key={editor.key} row={editor.row} partners={partners} names={names} onClose={closeEditor} /> : null}
      {preview ? (
        <InvoicePreview
          row={preview}
          subject={fillTemplate(subjectTemplate, { amount: preview.monthCommission, name: preview.name, introducerName: preview.name, monthYear: preview.monthYear, commission: preview.monthCommission, netTotal: preview.monthNet })}
          body={fillTemplate(bodyTemplate, { amount: preview.monthCommission, name: preview.name, introducerName: preview.name, monthYear: preview.monthYear, commission: preview.monthCommission, netTotal: preview.monthNet })}
          onClose={() => setPreview(null)}
        />
      ) : null}
    </>
  );
}

function IntroducerRow({ row, onEdit, onEmail }: { row: IntroducerView; onEdit: () => void; onEmail: () => void }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <tr className="border-b border-zinc-100 align-top last:border-0 hover:bg-zinc-50/50">
      <td className="max-w-[16rem] px-5 py-4">
        <p className="m-0 truncate font-medium text-zinc-950">{row.name}</p>
        {row.company ? <p className="m-0 mt-0.5 truncate text-xs text-zinc-500">{row.company}</p> : null}
        {row.notes ? (
          <p className="m-0 mt-1 line-clamp-2 text-xs text-zinc-400" title={row.notes}>
            {row.notes}
          </p>
        ) : null}
      </td>
      <td className="max-w-[16rem] px-4 py-4">
        {row.email ? (
          <a href={`mailto:${row.email}`} className="flex items-center gap-1.5 truncate text-zinc-800 no-underline hover:text-zinc-950 hover:underline">
            <MailIcon size={14} className="shrink-0 text-zinc-400" />
            <span className="truncate">{row.email}</span>
          </a>
        ) : (
          <span className="text-zinc-400">No email</span>
        )}
        {row.phone ? (
          <a href={`tel:${row.phone.replace(/[^\d+]/g, "")}`} className="mt-1 flex items-center gap-1.5 text-xs text-zinc-600 no-underline hover:text-zinc-950 hover:underline">
            <PhoneIcon size={13} className="shrink-0 text-zinc-400" />
            {row.phone}
          </a>
        ) : null}
      </td>
      <td className="max-w-[20rem] px-4 py-4">
        {row.partners.length === 0 ? (
          <span className="text-zinc-400">None yet</span>
        ) : (
          <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
            {row.partners.map((partner) => (
              <li key={partner.id}>
                <Link href={`/admin/corporate/${partner.id}`} className="inline-flex rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-900 no-underline hover:bg-zinc-200">
                  {partner.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </td>
      <td className="px-4 py-4 text-right whitespace-nowrap">
        <p className="m-0 tabular-nums text-zinc-900">{row.monthNet}</p>
        <p className="m-0 mt-0.5 text-xs text-zinc-500">Net, ex. VAT</p>
      </td>
      <td className="px-4 py-4 text-right whitespace-nowrap">
        <p className="m-0 font-medium tabular-nums text-zinc-950">{row.monthCommission}</p>
        <p className="m-0 mt-0.5 text-xs text-zinc-500">
          {row.tenureYear === 0 ? "Starts later" : `${row.rate} of net · year ${row.tenureYear}`}
        </p>
        {row.nextChange ? <p className="m-0 mt-0.5 text-xs text-zinc-400">{row.nextChange}</p> : null}
      </td>
      <td className="px-4 py-4">
        {row.active ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-emerald-700 ring-1 ring-emerald-200 ring-inset">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-emerald-500" />
            Active
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-zinc-600 ring-1 ring-zinc-200 ring-inset">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-zinc-400" />
            Inactive
          </span>
        )}
      </td>
      <td className="px-5 py-4">
        {confirming ? (
          <ActionForm action={deleteIntroducer} tone="delete" success="Introducer removed!" className="flex flex-col items-end gap-2">
            <input type="hidden" name="id" value={row.id} />
            <p className="m-0 max-w-[15rem] text-right text-xs text-zinc-600">Remove {row.name}? Their partners stay, but are no longer linked.</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setConfirming(false)} className={`${compact} border border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50`}>
                Cancel
              </button>
              <RemoveButton />
            </div>
          </ActionForm>
        ) : (
          <div className="flex flex-col items-end gap-2">
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" onClick={onEdit} className={`${compact} border border-zinc-200 bg-white text-zinc-800 shadow-card hover:border-zinc-300 hover:bg-zinc-50`}>
                <PencilIcon /> Edit
              </button>
              <button
                type="button"
                disabled={!row.email}
                title={row.email ? undefined : "Add an email address first"}
                onClick={onEmail}
                className={`${compact} border border-zinc-200 bg-white text-zinc-800 shadow-card hover:border-zinc-300 hover:bg-zinc-50`}
              >
                <MailIcon size={13} /> Email invoice request
              </button>
              <button type="button" onClick={() => setConfirming(true)} aria-label={`Remove ${row.name}`} className={`${compact} text-red-700 ring-1 ring-red-200 ring-inset hover:bg-red-50`}>
                <TrashIcon size={13} /> Remove
              </button>
            </div>
            {row.notified ? <p className="m-0 text-[11px] text-zinc-500">Invoice request sent {row.notified}</p> : null}
          </div>
        )}
      </td>
    </tr>
  );
}

function RemoveButton() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className={`${compact} bg-red-600 text-white hover:bg-red-700`}>
      {pending ? "Removing…" : "Remove"}
    </button>
  );
}

function SaveButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className={`${btn.base} ${btn.primary} ${btn.lg}`}>
      {pending ? "Saving…" : label}
    </button>
  );
}

function partnerLabel(partner: PartnerOption) {
  return partner.company || partner.name;
}

/** Add or edit form. Every field is controlled, so a server error never wipes what was typed. */
function IntroducerDialog({
  row,
  partners,
  names,
  onClose,
}: {
  row: IntroducerView | null;
  partners: PartnerOption[];
  names: Map<string, string>;
  onClose: () => void;
}) {
  const editing = row !== null;
  const [name, setName] = useState(row?.name ?? "");
  const [company, setCompany] = useState(row?.company ?? "");
  const [email, setEmail] = useState(row?.email ?? "");
  const [phone, setPhone] = useState(row?.phone ?? "");
  const [startDate, setStartDate] = useState(row?.startDate ?? todayIso());
  const [notes, setNotes] = useState(row?.notes ?? "");
  const [active, setActive] = useState(row?.active ?? true);
  // Only partners that can be shown here: an archived partner stays linked and is left alone on save.
  const [selected, setSelected] = useState<Set<string>>(() => {
    const linkable = new Set(partners.map((partner) => partner.id));
    return new Set((row?.partners ?? []).map((partner) => partner.id).filter((id) => linkable.has(id)));
  });
  // What was ticked when the dialog opened: the save changes only what was ticked or unticked here, never a link made meanwhile
  const [initial] = useState(() => [...selected]);
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return partners;
    return partners.filter((partner) => [partner.company ?? "", partner.name, partner.email].some((value) => value.toLowerCase().includes(needle)));
  }, [partners, query]);

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <AdminModal
      isOpen
      onClose={onClose}
      title={editing ? `Edit ${row.name}` : "Add introducer"}
      subtitle={editing ? "Update their details and the corporate partners they introduced." : "Their details, commission and the corporate partners they introduced."}
    >
      <ActionForm action={saveIntroducer} success={editing ? "Introducer saved!" : "Introducer added!"} onDone={onClose} className="grid gap-4">
        {editing ? <input type="hidden" name="id" value={row.id} /> : null}
        {/* The modal centres without scrolling, so the fields scroll inside it and it never outgrows the screen. */}
        <div className="-m-1 grid max-h-[calc(100dvh-13rem)] gap-4 overflow-y-auto p-1">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className={fieldLabel}>
                Full name <span className="text-red-600">*</span>
              </span>
              <input name="name" required minLength={2} maxLength={120} autoComplete="off" value={name} onChange={(event) => setName(event.target.value)} className={`${field} h-10`} />
            </label>
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className={fieldLabel}>
                Company <span className="font-normal text-zinc-400">(optional)</span>
              </span>
              <input name="company" maxLength={120} autoComplete="off" value={company} onChange={(event) => setCompany(event.target.value)} className={`${field} h-10`} />
            </label>
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className={fieldLabel}>
                Email <span className="text-red-600">*</span>
              </span>
              <input name="email" type="email" required maxLength={254} autoComplete="off" placeholder="name@company.com" value={email} onChange={(event) => setEmail(event.target.value)} className={`${field} h-10`} />
            </label>
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className={fieldLabel}>
                Phone <span className="font-normal text-zinc-400">(optional)</span>
              </span>
              <input name="phone" type="tel" inputMode="tel" maxLength={25} autoComplete="off" placeholder="+31 6 12345678" value={phone} onChange={(event) => setPhone(event.target.value)} className={`${field} h-10`} />
            </label>
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className={fieldLabel}>
                Start date <span className="text-red-600">*</span>
              </span>
              <input name="startDate" type="date" required value={startDate} onChange={(event) => setStartDate(event.target.value)} className={`${field} h-10`} />
              <span className="text-xs text-zinc-500">Commission counts tenure years from this date.</span>
            </label>
            {editing ? (
              <label className="flex h-10 items-center gap-2.5 self-start rounded-lg border border-zinc-200 px-3 text-sm text-zinc-800 sm:mt-[1.6rem]">
                <input type="checkbox" name="active" checked={active} onChange={(event) => setActive(event.target.checked)} className="size-4 accent-zinc-900" />
                Active
              </label>
            ) : (
              <input type="hidden" name="active" value="on" />
            )}
          </div>

          <CommissionSchedule startDate={startDate} />

          <label className="flex flex-col gap-1.5">
            <span className="flex items-baseline justify-between">
              <span className={fieldLabel}>
                Notes <span className="font-normal text-zinc-400">(optional)</span>
              </span>
              <span className={`text-xs tabular-nums ${notes.length > NOTES_MAX ? "text-red-600" : "text-zinc-400"}`}>
                {notes.length}/{NOTES_MAX}
              </span>
            </span>
            <textarea name="notes" rows={2} maxLength={NOTES_MAX} value={notes} onChange={(event) => setNotes(event.target.value)} className={`${field} resize-y py-2 leading-5`} />
          </label>

          <fieldset className="m-0 flex min-w-0 flex-col gap-1.5 border-0 p-0">
            <legend className="mb-1.5 flex w-full items-baseline justify-between p-0">
              <span className={fieldLabel}>Corporate partners</span>
              <span className="text-xs text-zinc-500">{selected.size} selected</span>
            </legend>
            {[...selected].map((id) => (
              <input key={id} type="hidden" name="partner" value={id} />
            ))}
            {initial.map((id) => (
              <input key={`was-${id}`} type="hidden" name="partnerWas" value={id} />
            ))}
            {partners.length === 0 ? (
              <p className="m-0 rounded-lg border border-dashed border-zinc-200 px-3 py-4 text-center text-sm text-zinc-500">There are no corporate partners yet.</p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-zinc-200">
                {partners.length > 5 ? (
                  <div className="relative border-b border-zinc-100">
                    <SearchIcon size={14} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-zinc-400" />
                    <input
                      type="search"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") event.preventDefault();
                      }}
                      placeholder="Search partners"
                      aria-label="Search corporate partners"
                      className="h-10 w-full border-0 bg-transparent pr-3 pl-8 text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
                    />
                  </div>
                ) : null}
                <ul className="m-0 max-h-44 list-none overflow-y-auto p-0">
                  {visible.length === 0 ? <li className="px-3 py-3 text-sm text-zinc-500">No partners match.</li> : null}
                  {visible.map((partner) => {
                    const checked = selected.has(partner.id);
                    const otherOwner = partner.introducerId && partner.introducerId !== row?.id ? names.get(partner.introducerId) ?? "another introducer" : null;
                    return (
                      <li key={partner.id} className="border-b border-zinc-100 last:border-0">
                        <label className={`flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-zinc-50 ${checked ? "bg-zinc-50" : ""}`}>
                          <input type="checkbox" checked={checked} onChange={() => toggle(partner.id)} className="mt-0.5 size-4 shrink-0 accent-zinc-900" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-zinc-900">{partnerLabel(partner)}</span>
                            <span className="block truncate text-xs text-zinc-500">{partner.company ? partner.name : partner.email}</span>
                            {otherOwner ? (
                              <span className={`mt-1 block text-xs ${checked ? "text-amber-700" : "text-zinc-400"}`}>
                                {checked ? `Moves from ${otherOwner} on save` : `Linked to ${otherOwner}`}
                              </span>
                            ) : null}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </fieldset>
        </div>

        <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4">
          <button type="button" onClick={onClose} className={`${btn.base} ${btn.secondary} ${btn.lg}`}>
            Cancel
          </button>
          <SaveButton label={editing ? "Save changes" : "Add introducer"} />
        </div>
      </ActionForm>
    </AdminModal>
  );
}

function InvoicePreview({ row, subject, body, onClose }: { row: IntroducerView; subject: string; body: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/40 p-4" role="presentation" onClick={onClose}>
      <ActionForm
        action={emailIntroducer}
        tone="email"
        success="Invoice request email sent!"
        inline="Sent!"
        onDone={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="invoice-request-title"
        className="grid w-full max-w-lg gap-3 rounded-xl bg-white p-5 shadow-card"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="invoice-request-title" className="m-0 text-base font-semibold text-zinc-950">Email invoice request</h2>
        <p className="m-0 text-sm text-zinc-600">To {row.email}. bookkeeper@ecramexecs.com is copied.</p>
        <input type="hidden" name="id" value={row.id} />
        <input type="hidden" name="cents" value={row.monthCommissionCents} />
        <input type="hidden" name="netCents" value={row.monthNetCents} />
        <label className="text-xs font-medium text-zinc-700">
          Subject
          <input name="subject" required defaultValue={subject} className={`${field} mt-1 h-10`} />
        </label>
        <label className="text-xs font-medium text-zinc-700">
          Message
          <textarea name="body" required rows={6} defaultValue={body} className={`${field} mt-1 py-2`} />
        </label>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onClose} className={`${compact} ${btn.ghost}`}>Cancel</button>
          <button className={`${compact} ${btn.primary}`}>Send invoice request</button>
        </div>
      </ActionForm>
    </div>
  );
}

const SHORT_DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const shortDate = (iso: string) => SHORT_DATE.format(new Date(`${iso}T00:00:00Z`));

/** Today as YYYY-MM-DD in the Netherlands, for a new introducer's start date. */
function todayIso() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam" }).format(new Date());
}

/** The tenure schedule for the chosen start date, with the year that applies today marked. */
function CommissionSchedule({ startDate }: { startDate: string }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return null;
  const today = todayIso();
  const nowBp = commissionBasisPoints(startDate, today);
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 px-3 py-2.5">
      <p className="m-0 text-[13px] font-medium text-zinc-900">Commission on net payments, by tenure year</p>
      <ol className="m-0 mt-1.5 grid list-none gap-1 p-0 text-xs text-zinc-600 sm:grid-cols-2">
        {COMMISSION_SCHEDULE_BP.map((bp, i) => {
          const from = anniversary(startDate, i);
          const last = i === COMMISSION_SCHEDULE_BP.length - 1;
          const current = nowBp > 0 && (last ? today >= from : today >= from && today < anniversary(startDate, i + 1));
          return (
            <li key={bp} className={current ? "font-semibold text-zinc-950" : ""}>
              Year {i + 1}
              {last ? "+" : ""}: {formatRate(bp)} from {shortDate(from)}
              {current ? " (now)" : ""}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
