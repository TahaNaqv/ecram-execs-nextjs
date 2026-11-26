"use client";

import { useState } from "react";
import { ActionForm } from "../../_components/action-feedback";
import { AdminModal } from "../../_components/admin-modal";
import { AdminSelect } from "../../_components/admin-fields";
import { MailIcon, NoteIcon, PhoneIcon, PlusIcon, TrashIcon, UsersIcon } from "../../_components/icons";
import { btn, Card, CardHeader, EmptyState, field, fieldLabel } from "../../_components/ui";
import { addSupplier, deleteSupplier, saveAddonStock, updateSupplier } from "./actions";
import { LIMITS, LOW_STOCK, PHONE_HINT, PHONE_PATTERN } from "./addon-rules";
import { PendingSubmit } from "./pending-submit";

export type StockRow = { key: string; label: string; onHand: number; supplierId: string | null };
export type SupplierRow = { id: string; name: string; email: string | null; phone: string | null; notes: string | null; linked: string[] };

// Inputs: 40px tall with a 20px line, so the text and caret sit in the middle.
const input = `${field} h-10 py-2 leading-5`;
const textarea = `${field} min-h-24 resize-y py-2.5 leading-6`;
// AdminSelect at the same height and radius as the inputs; the wrapper grows while the list is open so the modal does not clip it.
const selectWrap = "[&>div>button]:h-10 [&>div>button]:rounded-lg [&>div>button]:py-0 has-[[aria-expanded=true]]:pb-48";
const chip = "inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-700 ring-1 ring-inset ring-zinc-200";
const primary = `${btn.base} ${btn.primary} ${btn.lg} disabled:cursor-progress disabled:opacity-70`;
const secondary = `${btn.base} ${btn.secondary} ${btn.lg}`;

function PencilIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21.17 6.81a2.83 2.83 0 0 0-4-4L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

function Field({ label, hint, htmlFor, children }: { label: string; hint?: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={htmlFor} className={fieldLabel}>{label}</label>
      {children}
      {hint && <p className="m-0 text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}

function Actions({ onCancel, label, pendingLabel }: { onCancel: () => void; label: string; pendingLabel: string }) {
  return (
    <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4">
      <button type="button" onClick={onCancel} className={secondary}>Cancel</button>
      <PendingSubmit label={label} pendingLabel={pendingLabel} className={primary} />
    </div>
  );
}

/* ---------------------------------------------------------------- Stock */

export function StockCard({ rows, suppliers }: { rows: StockRow[]; suppliers: SupplierRow[] }) {
  const [editing, setEditing] = useState<StockRow | null>(null);
  const byId = new Map(suppliers.map((item) => [item.id, item]));
  return (
    <Card className="mt-6 overflow-hidden">
      <CardHeader title="Stock" description={`Stock is marked low under ${LOW_STOCK}. Bookings take their add-ons off the shelf.`} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50/60 text-[12px] tracking-wide text-zinc-500 uppercase">
              <th className="px-5 py-2.5 font-medium">Add-on</th>
              <th className="px-5 py-2.5 text-right font-medium">On hand</th>
              <th className="px-5 py-2.5 font-medium">Supplier</th>
              <th className="px-5 py-2.5"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const supplier = row.supplierId ? byId.get(row.supplierId) : undefined;
              const low = row.onHand < LOW_STOCK;
              return (
                <tr key={row.key} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50/50">
                  <td className="px-5 py-3.5">
                    <span className="flex items-center gap-2 font-medium text-zinc-950">
                      {row.label}
                      {low && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700 ring-1 ring-inset ring-red-200">Low</span>}
                    </span>
                  </td>
                  <td className={`px-5 py-3.5 text-right font-semibold tabular-nums ${low ? "text-red-700" : "text-zinc-950"}`}>{row.onHand}</td>
                  <td className="px-5 py-3.5">
                    {supplier ? (
                      <span className="block min-w-0">
                        <span className="block truncate font-medium text-zinc-900">{supplier.name}</span>
                        {supplier.email && <span className="block truncate text-[13px] text-zinc-500">{supplier.email}</span>}
                      </span>
                    ) : (
                      <span className="text-zinc-400">No supplier</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button type="button" onClick={() => setEditing(row)} className={`${btn.base} ${btn.secondary} ${btn.sm}`}>
                      <PencilIcon size={14} /> Edit
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <AdminModal isOpen={editing !== null} onClose={() => setEditing(null)} title={editing ? `Edit ${editing.label}` : "Edit add-on"} subtitle="Stock on hand and who supplies it.">
        {/* Only mounted while open, so each opening starts from the saved values. */}
        {editing && <StockForm row={editing} suppliers={suppliers} onDone={() => setEditing(null)} />}
      </AdminModal>
    </Card>
  );
}

function StockForm({ row, suppliers, onDone }: { row: StockRow; suppliers: SupplierRow[]; onDone: () => void }) {
  const [supplierId, setSupplierId] = useState(row.supplierId ?? "");
  // Controlled, so a refused save keeps what was typed (a form action resets uncontrolled fields)
  const [onHand, setOnHand] = useState(String(row.onHand));
  const options = [{ value: "", label: "No supplier" }, ...suppliers.map((item) => ({ value: item.id, label: item.name }))];
  return (
    <ActionForm action={saveAddonStock} success={`${row.label} saved!`} inline="" onDone={onDone} className="grid gap-4">
      <input type="hidden" name="key" value={row.key} />
      <Field label="On hand" htmlFor="stock-on-hand" hint={`A whole number from 0 to ${LIMITS.stockMax}.`}>
        <input
          id="stock-on-hand"
          name="onHand"
          type="number"
          inputMode="numeric"
          required
          min={0}
          max={LIMITS.stockMax}
          step={1}
          value={onHand}
          onChange={(event) => setOnHand(event.target.value)}
          className={`${input} tabular-nums`}
        />
      </Field>
      <Field label="Supplier" htmlFor="stock-supplier" hint={suppliers.length === 0 ? "Add a supplier first to link one here." : undefined}>
        <div className={selectWrap}>
          <AdminSelect id="stock-supplier" name="supplierId" value={supplierId} onChange={setSupplierId} options={options} />
        </div>
      </Field>
      <Actions onCancel={onDone} label="Save" pendingLabel="Saving…" />
    </ActionForm>
  );
}

/* ---------------------------------------------------------------- Suppliers */

type Addon = { key: string; label: string };

export function SuppliersCard({ suppliers, addons }: { suppliers: SupplierRow[]; addons: Addon[] }) {
  const [modal, setModal] = useState<{ kind: "add" } | { kind: "edit" | "remove"; supplier: SupplierRow } | null>(null);
  const close = () => setModal(null);
  const addButton = (
    <button type="button" onClick={() => setModal({ kind: "add" })} className={`${btn.base} ${btn.primary} ${btn.md}`}>
      <PlusIcon size={15} /> Add supplier
    </button>
  );
  return (
    <Card className="mt-6 overflow-hidden">
      <CardHeader title="Suppliers" description="Who delivers each add-on." actions={addButton} />
      {suppliers.length === 0 ? (
        <EmptyState icon={<UsersIcon size={18} />} title="No suppliers yet" description="Add the companies that deliver your champagne, chocolates, flowers and newspapers." />
      ) : (
        <ul className="m-0 list-none p-0">
          {suppliers.map((supplier) => (
            <li key={supplier.id} className="flex flex-col gap-3 border-b border-zinc-100 px-5 py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="m-0 flex flex-wrap items-center gap-2 text-sm font-medium text-zinc-950">
                  <span className="truncate">{supplier.name}</span>
                  {supplier.linked.length > 0 ? (
                    supplier.linked.map((label) => <span key={label} className={chip}>{label}</span>)
                  ) : (
                    <span className={`${chip} bg-zinc-50 text-zinc-500`}>Not linked</span>
                  )}
                </p>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-zinc-500">
                  {supplier.email && <span className="inline-flex min-w-0 items-center gap-1.5"><MailIcon size={13} /><span className="truncate">{supplier.email}</span></span>}
                  {supplier.phone && <span className="inline-flex items-center gap-1.5"><PhoneIcon size={13} />{supplier.phone}</span>}
                  {supplier.notes && <span className="inline-flex min-w-0 max-w-full items-center gap-1.5"><NoteIcon size={13} className="shrink-0" /><span className="truncate">{supplier.notes}</span></span>}
                  {!supplier.email && !supplier.phone && !supplier.notes && <span>No contact details</span>}
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <button type="button" onClick={() => setModal({ kind: "edit", supplier })} className={`${btn.base} ${btn.secondary} ${btn.sm}`}>
                  <PencilIcon size={14} /> Edit
                </button>
                <button type="button" onClick={() => setModal({ kind: "remove", supplier })} className={`${btn.base} ${btn.ghost} ${btn.sm} text-red-700 hover:bg-red-50 hover:text-red-800`}>
                  <TrashIcon size={14} /> Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <AdminModal isOpen={modal?.kind === "add"} onClose={close} title="Add supplier" subtitle="Contact details and the add-on they deliver.">
        {modal?.kind === "add" && <SupplierForm addons={addons} onDone={close} />}
      </AdminModal>
      <AdminModal isOpen={modal?.kind === "edit"} onClose={close} title="Edit supplier" subtitle={modal?.kind === "edit" ? modal.supplier.name : undefined}>
        {modal?.kind === "edit" && <SupplierForm key={modal.supplier.id} supplier={modal.supplier} addons={addons} onDone={close} />}
      </AdminModal>
      <AdminModal isOpen={modal?.kind === "remove"} onClose={close} title="Remove supplier">
        {modal?.kind === "remove" && (
          <ActionForm action={deleteSupplier} tone="delete" success="Supplier removed!" inline="" onDone={close} className="grid gap-4">
            <input type="hidden" name="id" value={modal.supplier.id} />
            <p className="m-0 text-sm text-zinc-700">
              Remove <span className="font-semibold text-zinc-950">{modal.supplier.name}</span>?
              {modal.supplier.linked.length > 0 ? ` ${modal.supplier.linked.join(", ")} will show no supplier until you choose a new one.` : " This cannot be undone."}
            </p>
            <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4">
              <button type="button" onClick={close} className={secondary}>Cancel</button>
              <PendingSubmit label="Remove supplier" pendingLabel="Removing…" className={`${btn.base} ${btn.danger} ${btn.lg} disabled:cursor-progress disabled:opacity-70`} />
            </div>
          </ActionForm>
        )}
      </AdminModal>
    </Card>
  );
}

function SupplierForm({ supplier, addons, onDone }: { supplier?: SupplierRow; addons: Addon[]; onDone: () => void }) {
  const [key, setKey] = useState("");
  // Controlled, so a refused save keeps what was typed (a form action resets uncontrolled fields)
  const [name, setName] = useState(supplier?.name ?? "");
  const [email, setEmail] = useState(supplier?.email ?? "");
  const [phone, setPhone] = useState(supplier?.phone ?? "");
  const [notes, setNotes] = useState(supplier?.notes ?? "");
  const editing = Boolean(supplier);
  const id = supplier?.id ?? "new";
  return (
    <ActionForm
      action={editing ? updateSupplier : addSupplier}
      success={editing ? "Supplier updated!" : "Supplier added!"}
      inline=""
      onDone={onDone}
      className="grid gap-4"
    >
      {supplier && <input type="hidden" name="id" value={supplier.id} />}
      <Field label="Supplier name" htmlFor={`${id}-name`}>
        <input
          id={`${id}-name`}
          name="name"
          required
          minLength={LIMITS.nameMin}
          maxLength={LIMITS.nameMax}
          autoComplete="organization"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Bloemen & Co"
          className={input}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Email (optional)" htmlFor={`${id}-email`}>
          <input
            id={`${id}-email`}
            name="email"
            type="email"
            maxLength={LIMITS.emailMax}
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="orders@supplier.com"
            className={input}
          />
        </Field>
        <Field label="Phone (optional)" htmlFor={`${id}-phone`}>
          <input
            id={`${id}-phone`}
            name="phone"
            type="tel"
            inputMode="tel"
            pattern={PHONE_PATTERN}
            title={PHONE_HINT}
            maxLength={LIMITS.phoneMax}
            autoComplete="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+31 20 123 4567"
            className={input}
          />
        </Field>
      </div>
      {editing ? (
        supplier && supplier.linked.length > 0 && (
          <div className="grid gap-1.5">
            <span className={fieldLabel}>Linked add-ons</span>
            <p className="m-0 flex flex-wrap gap-1.5">{supplier.linked.map((label) => <span key={label} className={chip}>{label}</span>)}</p>
            <p className="m-0 text-xs text-zinc-500">Change links with Edit on the stock table.</p>
          </div>
        )
      ) : (
        <Field label="Linked add-on" htmlFor={`${id}-key`} hint="Linking replaces the add-on's current supplier.">
          <div className={selectWrap}>
            <AdminSelect
              id={`${id}-key`}
              name="key"
              value={key}
              onChange={setKey}
              options={[{ value: "", label: "Not linked" }, ...addons.map((addon) => ({ value: addon.key, label: addon.label }))]}
            />
          </div>
        </Field>
      )}
      <Field label="Notes (optional)" htmlFor={`${id}-notes`} hint={`Up to ${LIMITS.notesMax} characters.`}>
        <textarea
          id={`${id}-notes`}
          name="notes"
          rows={3}
          maxLength={LIMITS.notesMax}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Order days, minimum order, account number…"
          className={textarea}
        />
      </Field>
      <Actions onCancel={onDone} label={editing ? "Save changes" : "Add supplier"} pendingLabel="Saving…" />
    </ActionForm>
  );
}
