"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useActionState } from "react";
import { ACCOUNT_AREAS, type AccountArea, type StaffRole } from "@/lib/admin/access";
import { CreateAccountForm, TeamAccessFields } from "../(app)/account/create-account";
import { removeTeamAccount, updateTeamAccess, type RemoveAccountState, type UpdateAccessState } from "../(app)/account/actions";
import { SetPasswordForm } from "./set-password";
import { pushToast, SavedMark } from "./action-feedback";
import { Avatar, btn } from "./ui";

type Person = { id: string; name: string; email: string; role: string; permissions: string[] | null };

type Copy = {
  fullName: string;
  email: string;
  password: string;
  passwordHint: string;
  showPassword: string;
  hidePassword: string;
  role: string;
  permissions: string;
  owner: string;
  manager: string;
  staff: string;
  ownersAll: string;
  createAccount: string;
  createdPlain: string;
  exists: string;
  short: string;
  invalid: string;
  denied: string;
  handoff: string;
  people: string;
  peopleEmpty: string;
  sectionTitle: string;
  sectionNote: string;
  actions: string;
  editAccess: string;
  accessSaved: string;
  close: string;
  saveAccess: string;
  lastOwner: string;
  setPassword: string;
  passwordSet: string;
  removeAccount: string;
  removeSaved: string;
  cannotRemoveSelf: string;
};

const badge: Record<StaffRole, string> = {
  staff: "border-zinc-200 bg-zinc-50 text-zinc-800",
  manager: "border-slate-200 bg-slate-50 text-slate-800",
  owner: "border-zinc-950 bg-zinc-950 text-white",
};

function roleOf(value: string): StaffRole {
  return value === "owner" || value === "manager" ? value : "staff";
}

function Dialog({
  title,
  description,
  closeLabel,
  onClose,
  children,
}: {
  title: string;
  description?: string;
  closeLabel: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-zinc-950/40 px-4 py-8" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="team-dialog-title"
        className="my-auto w-full max-w-lg rounded-xl border border-zinc-200 bg-white shadow-xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-zinc-100 px-5 py-4">
          <div className="min-w-0">
            <h2 id="team-dialog-title" className="text-base font-semibold text-zinc-950">{title}</h2>
            {description ? <p className="mt-1 text-sm leading-snug text-zinc-500">{description}</p> : null}
          </div>
          <button type="button" onClick={onClose} className={`${btn.base} ${btn.ghost} ${btn.sm}`}>{closeLabel}</button>
        </header>
        {children}
      </div>
    </div>,
    document.body,
  );
}

function AccessForm({
  person,
  copy,
  labels,
  onSaved,
}: {
  person: Person;
  copy: Copy;
  labels: Record<AccountArea, string>;
  onSaved: () => void;
}) {
  const [role, setRole] = useState<StaffRole>(roleOf(person.role));
  const [state, submit, pending] = useActionState(updateTeamAccess, {} as UpdateAccessState);
  const told = useRef(false);
  useEffect(() => {
    if (!state.ok || told.current) return;
    told.current = true;
    onSaved();
  }, [state.ok, onSaved]);
  const error = state.error === "denied" ? copy.denied : state.error === "last" ? copy.lastOwner : state.error === "failed" ? copy.invalid : null;
  return (
    <form action={submit} className="flex flex-col gap-5 px-5 py-5">
      <input type="hidden" name="id" value={person.id} />
      <TeamAccessFields copy={copy} labels={labels} role={role} setRole={setRole} selected={person.permissions ?? []} />
      {error ? <p role="alert" className="m-0 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
      <div className="flex items-center gap-2">
        <button disabled={pending} className={`${btn.base} ${btn.primary} ${btn.md} self-start`}>{copy.saveAccess}</button>
        <SavedMark text={state.ok ? "Saved!" : null} />
      </div>
    </form>
  );
}

function RemoveAccountForm({ person, copy, onRemoved }: { person: Person; copy: Copy; onRemoved: () => void }) {
  const [state, action, pending] = useActionState<RemoveAccountState, FormData>(removeTeamAccount, {});
  useEffect(() => {
    if (state.ok) onRemoved();
  }, [state.ok, onRemoved]);
  const error = state.error === "denied" ? copy.denied : state.error === "last" ? copy.lastOwner : state.error === "self" ? copy.cannotRemoveSelf : state.error === "failed" ? copy.invalid : null;
  return (
    <form action={action} className="flex flex-col gap-4 px-5 py-5">
      <input type="hidden" name="id" value={person.id} />
      <p className="m-0 text-sm text-zinc-700">{person.email}</p>
      {error ? <p role="alert" className="m-0 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
      <button disabled={pending} className={`${btn.base} ${btn.danger} ${btn.md} self-start`}>{copy.removeAccount}</button>
    </form>
  );
}

export function TeamDesk({
  people,
  viewerId,
  labels,
  roleLabel,
  copy,
}: {
  people: Person[];
  viewerId: string;
  labels: Record<AccountArea, string>;
  roleLabel: Record<StaffRole, string>;
  copy: Copy;
}) {
  const [open, setOpen] = useState<null | "create" | { kind: "access" | "password" | "remove"; person: Person }>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const show = useCallback((message: string) => {
    pushToast(message);
  }, []);
  const close = useCallback(() => setOpen(null), []);
  const created = useCallback(() => {
    setOpen(null);
    show(copy.createdPlain);
  }, [copy.createdPlain, show]);
  const savedAccess = useCallback(() => {
    setOpen(null);
    show(copy.accessSaved);
  }, [copy.accessSaved, show]);
  const removed = useCallback(() => {
    setOpen(null);
    show(copy.removeSaved);
  }, [copy.removeSaved, show]);

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0 text-sm font-semibold text-zinc-950">{copy.people}</h2>
        <button type="button" onClick={() => setOpen("create")} className={`${btn.base} ${btn.primary} ${btn.md}`}>
          + {copy.sectionTitle}
        </button>
      </div>
      {people.length === 0 ? (
        <p className="m-0 rounded-xl border border-dashed border-zinc-200 px-5 py-8 text-sm text-zinc-600">{copy.peopleEmpty}</p>
      ) : (
        <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 xl:grid-cols-3">
          {people.map((person) => {
            const role = roleOf(person.role);
            const areas = role === "owner" ? ACCOUNT_AREAS : ACCOUNT_AREAS.filter((area) => (person.permissions ?? []).includes(area));
            return (
              <li key={person.id} className="relative flex flex-col gap-4 rounded-xl border border-zinc-200/80 bg-white p-5 shadow-card">
                <div className="flex items-start gap-3">
                  <Avatar name={person.name} size="lg" />
                  <div className="min-w-0 flex-1">
                    <p className="m-0 truncate text-base font-semibold text-zinc-950">{person.name}</p>
                    <p className="m-0 mt-0.5 truncate text-sm text-zinc-600">{person.email}</p>
                  </div>
                  <div className="relative">
                    <button
                      type="button"
                      aria-haspopup="menu"
                      aria-expanded={menu === person.id}
                      aria-label={copy.actions}
                      onClick={() => setMenu((current) => (current === person.id ? null : person.id))}
                      className={`${btn.base} ${btn.ghost} ${btn.sm} px-2`}
                    >
                      ···
                    </button>
                    {menu === person.id ? (
                      <div role="menu" className="absolute right-0 z-10 mt-1 w-44 rounded-lg border border-zinc-200 bg-white p-1 shadow-lg">
                        <button
                          type="button"
                          role="menuitem"
                          className="block w-full rounded-md px-3 py-2 text-left text-sm text-zinc-800 hover:bg-zinc-50"
                          onClick={() => {
                            setMenu(null);
                            setOpen({ kind: "access", person });
                          }}
                        >
                          {copy.editAccess}
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          className="block w-full rounded-md px-3 py-2 text-left text-sm text-zinc-800 hover:bg-zinc-50"
                          onClick={() => {
                            setMenu(null);
                            setOpen({ kind: "password", person });
                          }}
                        >
                          {copy.setPassword}
                        </button>
                        {person.id !== viewerId ? (
                          <button
                            type="button"
                            role="menuitem"
                            className="block w-full rounded-md px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50"
                            onClick={() => {
                              setMenu(null);
                              setOpen({ kind: "remove", person });
                            }}
                          >
                            {copy.removeAccount}
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
                <span className={`inline-flex w-fit rounded-full border px-2.5 py-0.5 text-[12px] font-medium ${badge[role]}`}>{roleLabel[role]}</span>
                {role === "owner" ? (
                  <p className="m-0 text-sm leading-snug text-zinc-600">{copy.ownersAll}</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {areas.length === 0 ? <span className="text-sm text-zinc-400">—</span> : areas.map((area) => (
                      <span key={area} className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-[12px] text-zinc-800">{labels[area]}</span>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {open === "create" ? (
        <Dialog title={copy.sectionTitle} description={copy.sectionNote} closeLabel={copy.close} onClose={close}>
          <CreateAccountForm copy={copy} labels={labels} onCreated={created} />
        </Dialog>
      ) : null}
      {open && open !== "create" && open.kind === "access" ? (
        <Dialog title={copy.editAccess} description={open.person.name} closeLabel={copy.close} onClose={close}>
          <AccessForm key={open.person.id} person={open.person} copy={copy} labels={labels} onSaved={savedAccess} />
        </Dialog>
      ) : null}
      {open && open !== "create" && open.kind === "password" ? (
        <Dialog title={copy.setPassword} description={open.person.email} closeLabel={copy.close} onClose={close}>
          <div className="px-5 py-5">
            <SetPasswordForm id={open.person.id} copy={copy} />
          </div>
        </Dialog>
      ) : null}
      {open && open !== "create" && open.kind === "remove" ? (
        <Dialog title={copy.removeAccount} description={open.person.name} closeLabel={copy.close} onClose={close}>
          <RemoveAccountForm key={open.person.id} person={open.person} copy={copy} onRemoved={removed} />
        </Dialog>
      ) : null}
    </section>
  );
}
