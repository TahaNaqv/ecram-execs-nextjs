"use client";

import { useRef, useState, useSyncExternalStore, useTransition, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Compliance } from "@/lib/drivers/compliance";
import { documentAccepts, type DriverDocumentKind } from "@/lib/drivers/documents";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { interpolate } from "@/lib/i18n/interpolate";
import { MAX_DOCUMENT_BYTES } from "@/lib/partners/criteria";
import { ActionForm, pushToast } from "../../../_components/action-feedback";
import { ChevronLeftIcon } from "../../../_components/icons";
import { btn, field, fieldLabel, PageBody, PageHeader } from "../../../_components/ui";
import {
  addDriverVehicle,
  eraseDriver,
  prepareDriverUpload,
  recordDriverDocument,
  removeDriverDocument,
  removeDriverVehicle,
  saveAuthorisedModels,
  saveDriverSection,
} from "./actions";

type Copy = Dictionary["admin"]["driverProfile"];
export type ProfileDocument = { id: string; fileName: string; url: string | null };

type Driver = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  dateOfBirth: string | null;
  emergencyName: string | null;
  emergencyPhone: string | null;
  driverType: string;
  accountStatus: string;
  statusNote: string | null;
  languages: string[];
  bio: string | null;
  securityTrained: boolean;
  licenceNumber: string | null;
  licenceCountry: string | null;
  licenceExpiry: string | null;
  catB: boolean;
  catBeCode96: boolean;
  catDCode95: boolean;
  code95Expiry: string | null;
  noPrivateCodes: boolean;
  kiwaCardNumber: string | null;
  kiwaCardType: string | null;
  taxipasExpiry: string | null;
  cdtCheckedOn: string | null;
  vogIssuedOn: string | null;
  vogVerified: boolean;
  medicalStatus: string;
  agencyName: string | null;
  agencyContact: string | null;
  agencyContractRef: string | null;
  agencyRateTier: string | null;
  timesheetId: string | null;
  evInduction: boolean;
  trailerInduction: boolean;
  authorisedModels: string[];
  tradeName: string | null;
  kvk: string | null;
  btwId: string | null;
  iban: string | null;
  permitNumber: string | null;
  permitExpiry: string | null;
  ondernemerskaartNumber: string | null;
  ondernemerskaartExpiry: string | null;
  insurer: string | null;
  insurancePolicy: string | null;
  insuranceExpiry: string | null;
};

type OwnVehicle = { id: string; make: string; model: string | null; colour: string | null; plate: string; passengers: number | null; luggage: number | null; apkExpiry: string | null };

const tone = {
  active: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  pending: "bg-amber-50 text-amber-900 ring-amber-200",
  suspended: "bg-red-50 text-red-800 ring-red-200",
} as const;

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-card">
      <h2 className="m-0 text-sm font-semibold text-zinc-950">{title}</h2>
      {hint ? <p className="m-0 mt-1 text-xs text-zinc-500">{hint}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Text({ name, label, value, type = "text", hint, wide, maxLength, required }: { name: string; label: string; value: string | null; type?: string; hint?: string; wide?: boolean; maxLength?: number; required?: boolean }) {
  return (
    <label className={`flex flex-col gap-1.5 ${wide ? "sm:col-span-2" : ""}`}>
      <span className={fieldLabel}>{label}</span>
      <input name={name} type={type} defaultValue={value ?? ""} maxLength={maxLength} required={required} className={`${field} h-10`} />
      {hint ? <span className="text-[11px] text-zinc-500">{hint}</span> : null}
    </label>
  );
}

function Check({ name, label, checked }: { name: string; label: string; checked: boolean }) {
  return (
    <label className="flex items-start gap-2 text-sm text-zinc-800 sm:col-span-2">
      <input type="checkbox" name={name} defaultChecked={checked} className="mt-0.5" />
      <span>{label}</span>
    </label>
  );
}

function Choice({ name, label, value, options, onChange }: { name: string; label: string; value: string; options: { value: string; label: string }[]; onChange?: (value: string) => void }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={fieldLabel}>{label}</span>
      <select name={name} defaultValue={value} onChange={(event) => onChange?.(event.target.value)} className={`${field} h-10`}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * A form that keeps what was typed when the save is refused (a React form action would reset it to the stored values, so a
 * mistyped IBAN would wipe the whole card). After a save the parent's key changes and the card shows the stored values.
 */
function ProfileForm({
  action,
  success,
  resetOnSuccess,
  className,
  children,
}: {
  action: (formData: FormData) => Promise<{ ok: true } | { ok: false; error: string }>;
  success: string;
  resetOnSuccess?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [pending, start] = useTransition();
  // Until the page is interactive the form cannot be sent at all: a plain browser submit would put an IBAN in the address bar
  const ready = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    start(async () => {
      try {
        const result = await action(data);
        if (!result.ok) {
          pushToast(result.error, false);
          return;
        }
        pushToast(success);
        if (resetOnSuccess) form.reset();
      } catch {
        pushToast("That action did not complete.", false);
      }
    });
  }
  return (
    <form method="post" onSubmit={onSubmit} aria-busy={pending} className={className}>
      <fieldset disabled={pending || !ready} className="contents">
        {children}
      </fieldset>
    </form>
  );
}

/** One card's form. Keyed on what was saved, so the inputs show the stored values again after each save. */
function SectionForm({ driverId, section, saved, copy, children }: { driverId: string; section: string; saved: unknown; copy: Copy; children: ReactNode }) {
  return (
    <ProfileForm key={JSON.stringify(saved)} action={saveDriverSection} success={copy.saved} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="driverId" value={driverId} />
      <input type="hidden" name="section" value={section} />
      {children}
      <button className={`${btn.base} ${btn.primary} ${btn.md} w-fit sm:col-span-2`}>{copy.save}</button>
    </ProfileForm>
  );
}

function DocumentSlot({ driverId, kind, label, doc, storage, copy }: { driverId: string; kind: DriverDocumentKind; label: string; doc: ProfileDocument | undefined; storage: boolean; copy: Copy }) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const accepts = documentAccepts(kind);

  async function onPick(file: File | undefined) {
    if (!file) return;
    const reset = () => {
      if (input.current) input.current.value = "";
    };
    if (!accepts.includes(file.type) || file.size === 0 || file.size > MAX_DOCUMENT_BYTES) {
      pushToast(kind === "photo" ? copy.badPhoto : copy.badType, false);
      reset();
      return;
    }
    setBusy(true);
    try {
      const prepared = await prepareDriverUpload(driverId, kind, file.type);
      if (!prepared.ok) throw new Error(prepared.error);
      const put = await fetch(prepared.url, { method: "PUT", headers: { "content-type": file.type, "x-upsert": "false" }, body: file });
      if (!put.ok) throw new Error(copy.uploadFailed);
      const recorded = await recordDriverDocument(driverId, kind, prepared.path, file.name, prepared.claim);
      if (!recorded.ok) throw new Error(recorded.error);
      pushToast(copy.saved);
      router.refresh();
    } catch (err) {
      pushToast(err instanceof Error && err.message ? err.message : copy.uploadFailed, false);
    } finally {
      setBusy(false);
      reset();
    }
  }

  return (
    <div className="flex flex-col gap-1.5 sm:col-span-2">
      <span className={fieldLabel}>{label}</span>
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-zinc-200 px-3 py-2">
        {kind === "photo" && doc?.url ? (
          // eslint-disable-next-line @next/next/no-img-element -- a private, signed, short-lived link: not for the image optimiser
          <img src={doc.url} alt="" className="size-14 rounded-full object-cover" />
        ) : null}
        <span className="min-w-0 flex-1 truncate text-sm text-zinc-700">{doc ? doc.fileName : copy.noFile}</span>
        {doc?.url ? (
          <a href={doc.url} className={`${btn.base} ${btn.ghost} ${btn.sm}`}>
            {copy.view}
          </a>
        ) : null}
        {storage ? (
          <>
            <input ref={input} type="file" accept={accepts.join(",")} hidden onChange={(event) => void onPick(event.target.files?.[0])} />
            <button type="button" disabled={busy} onClick={() => input.current?.click()} className={`${btn.base} ${btn.secondary} ${btn.sm}`}>
              {busy ? copy.uploading : doc ? copy.replace : copy.upload}
            </button>
          </>
        ) : (
          <span className="text-xs text-zinc-500">{copy.storageOff}</span>
        )}
        {doc ? (
          <ActionForm action={removeDriverDocument} tone="delete">
            <input type="hidden" name="documentId" value={doc.id} />
            <button className={`${btn.base} ${btn.ghost} ${btn.sm} text-red-700`}>{copy.removeFile}</button>
          </ActionForm>
        ) : null}
      </div>
    </div>
  );
}

export function DriverProfile({
  driver,
  compliance,
  documents,
  vehicles,
  authorisable,
  applicationId,
  privateOk,
  canErase,
  storage,
  copy,
  locale,
}: {
  driver: Driver;
  compliance: Compliance;
  documents: Partial<Record<DriverDocumentKind, ProfileDocument>>;
  vehicles: OwnVehicle[];
  authorisable: { key: string; label: string }[];
  applicationId: string | null;
  privateOk: boolean;
  canErase: boolean;
  storage: boolean;
  copy: Copy;
  locale: string;
}) {
  const [type, setType] = useState(driver.driverType);
  const freelance = type === "freelance";
  const labels = copy.labels as Record<string, string>;
  const day = (iso: string) => new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
  const itemLabel = (e: { key: string; vehicleLabel?: string }) => (e.vehicleLabel ? `${labels[e.key] ?? e.key} (${e.vehicleLabel})` : (labels[e.key] ?? e.key));
  const statusLabel = { active: copy.statusActive, pending: copy.statusPending, suspended: copy.statusSuspended }[compliance.status];
  const slot = (kind: DriverDocumentKind, label: string) => <DocumentSlot driverId={driver.id} kind={kind} label={label} doc={documents[kind]} storage={storage} copy={copy} />;
  const pick = <K extends keyof Driver>(...keys: K[]) => Object.fromEntries(keys.map((k) => [k, driver[k]]));

  return (
    <PageBody>
      <Link href="/admin/drivers" className={`${btn.base} ${btn.ghost} ${btn.sm} -ml-2 mb-2 w-fit`}>
        <ChevronLeftIcon />
        {copy.back}
      </Link>
      <PageHeader
        title={
          <span className="inline-flex flex-wrap items-center gap-3">
            {driver.name}
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${tone[compliance.status]}`}>{statusLabel}</span>
          </span>
        }
        description={freelance ? copy.typeFreelance : copy.typeAgency}
      />

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Section title={copy.statusCard} hint={copy.statusHint}>
          <div className="mb-4 flex flex-col gap-2 text-sm">
            {compliance.autoSuspended ? <p className="m-0 font-medium text-red-700">{interpolate(copy.autoSuspended, { items: compliance.expired.map(itemLabel).join(", ") })}</p> : null}
            {driver.accountStatus === "suspended" ? <p className="m-0 font-medium text-red-700">{copy.manualSuspended}</p> : null}
            {compliance.expired.length > 0 ? (
              <ul className="m-0 list-disc pl-5 text-red-700">
                {compliance.expired.map((e) => (
                  <li key={`${e.key}${e.vehicleId ?? ""}`}>{interpolate(copy.expiredLine, { item: itemLabel(e), date: day(e.date) })}</li>
                ))}
              </ul>
            ) : null}
            {compliance.missing.length > 0 ? (
              <div>
                <p className="m-0 font-medium text-amber-900">{copy.missingTitle}</p>
                <ul className="m-0 mt-1 list-disc pl-5 text-amber-900">
                  {compliance.missing.map((key) => (
                    <li key={key}>{labels[key] ?? key}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {compliance.dueSoon.length > 0 ? (
              <div>
                <p className="m-0 font-medium text-zinc-800">{copy.dueTitle}</p>
                <ul className="m-0 mt-1 list-disc pl-5 text-zinc-700">
                  {compliance.dueSoon.map((e) => (
                    <li key={`${e.key}${e.vehicleId ?? ""}`} className={e.tier === 7 ? "text-red-700" : e.tier === 30 ? "text-amber-900" : undefined}>
                      {interpolate(copy.dueLine, { item: itemLabel(e), date: day(e.date), days: e.days })}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
          <SectionForm driverId={driver.id} section="status" saved={pick("accountStatus", "statusNote")} copy={copy}>
            <Choice
              name="accountStatus"
              label={copy.statusLabel}
              value={driver.accountStatus}
              options={[
                { value: "pending", label: copy.statusPending },
                { value: "active", label: copy.statusActive },
                { value: "suspended", label: copy.statusSuspended },
              ]}
            />
            <Text name="statusNote" label={copy.statusNote} value={driver.statusNote} maxLength={300} />
          </SectionForm>
          {applicationId ? (
            <Link href={`/admin/drivers/applications/${applicationId}`} className="mt-4 inline-block text-sm text-zinc-700 underline">
              {copy.fromApplication}
            </Link>
          ) : null}
        </Section>

        <Section title={copy.coreCard} hint={copy.coreHint}>
          <SectionForm
            driverId={driver.id}
            section="core"
            saved={pick("name", "phone", "email", "address", "dateOfBirth", "emergencyName", "emergencyPhone", "driverType", "languages", "bio", "securityTrained")}
            copy={copy}
          >
            <Text name="name" label={copy.name} value={driver.name} required maxLength={120} wide />
            <Choice
              name="driverType"
              label={copy.driverType}
              value={driver.driverType}
              onChange={setType}
              options={[
                { value: "agency", label: copy.typeAgency },
                { value: "freelance", label: copy.typeFreelance },
              ]}
            />
            <Text name="phone" label={copy.mobile} value={driver.phone} type="tel" required />
            <Text name="email" label={copy.email} value={driver.email} type="email" />
            {privateOk ? (
              <>
                <Text name="dateOfBirth" label={copy.dob} value={driver.dateOfBirth} type="date" />
                <Text name="address" label={copy.address} value={driver.address} maxLength={300} wide />
              </>
            ) : (
              <p className="m-0 text-xs text-zinc-500 sm:col-span-2">
                {copy.dob} · {copy.address}: {copy.privateHidden}
              </p>
            )}
            <Text name="emergencyName" label={copy.emergencyName} value={driver.emergencyName} maxLength={120} />
            <Text name="emergencyPhone" label={copy.emergencyPhone} value={driver.emergencyPhone} type="tel" />
            <Text name="languages" label={copy.languages} value={driver.languages.join(", ")} hint={copy.languagesHint} wide />
            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className={fieldLabel}>{copy.bio}</span>
              <textarea name="bio" defaultValue={driver.bio ?? ""} maxLength={400} rows={3} className={`${field} py-2`} />
              <span className="text-[11px] text-zinc-500">{copy.bioHint}</span>
            </label>
            <Check name="securityTrained" label={copy.securityTrained} checked={driver.securityTrained} />
          </SectionForm>
          <div className="mt-4 grid">{slot("photo", `${copy.photo} · ${copy.photoHint}`)}</div>
        </Section>

        <Section title={copy.licenceCard} hint={copy.licenceHint}>
          <SectionForm driverId={driver.id} section="licence" saved={pick("licenceNumber", "licenceCountry", "licenceExpiry", "catB", "catBeCode96", "catDCode95", "code95Expiry", "noPrivateCodes")} copy={copy}>
            <Text name="licenceNumber" label={copy.licenceNumber} value={driver.licenceNumber} maxLength={40} />
            <Text name="licenceCountry" label={copy.licenceCountry} value={driver.licenceCountry ?? "NL"} maxLength={2} />
            <Text name="licenceExpiry" label={copy.licenceExpiry} value={driver.licenceExpiry} type="date" />
            <Text name="code95Expiry" label={copy.code95Expiry} value={driver.code95Expiry} type="date" />
            <Check name="catB" label={copy.catB} checked={driver.catB} />
            <Check name="catBeCode96" label={copy.catBe} checked={driver.catBeCode96} />
            <Check name="catDCode95" label={copy.catD} checked={driver.catDCode95} />
            <Check name="noPrivateCodes" label={copy.noPrivateCodes} checked={driver.noPrivateCodes} />
          </SectionForm>
        </Section>

        <Section title={copy.kiwaCard} hint={copy.kiwaHint}>
          <SectionForm driverId={driver.id} section="kiwa" saved={pick("kiwaCardNumber", "kiwaCardType", "taxipasExpiry", "cdtCheckedOn")} copy={copy}>
            <Text name="kiwaCardNumber" label={copy.kiwaNumber} value={driver.kiwaCardNumber} maxLength={40} />
            <Choice
              name="kiwaCardType"
              label={copy.kiwaType}
              value={driver.kiwaCardType ?? ""}
              options={[
                { value: "", label: "—" },
                { value: "full", label: copy.kiwaFull },
                { value: "limited", label: copy.kiwaLimited },
              ]}
            />
            <Text name="taxipasExpiry" label={copy.kiwaExpiry} value={driver.taxipasExpiry} type="date" />
            <Text name="cdtCheckedOn" label={copy.cdt} value={driver.cdtCheckedOn} type="date" />
          </SectionForm>
          <div className="mt-4 grid gap-3">
            {slot("kiwafront", copy.kiwaFront)}
            {slot("kiwaback", copy.kiwaBack)}
          </div>
        </Section>

        <Section title={copy.vettingCard}>
          <SectionForm driverId={driver.id} section="vetting" saved={pick("vogIssuedOn", "vogVerified", "medicalStatus")} copy={copy}>
            <Text name="vogIssuedOn" label={copy.vogIssued} value={driver.vogIssuedOn} type="date" />
            <Choice
              name="medicalStatus"
              label={copy.medical}
              value={driver.medicalStatus}
              options={[
                { value: "missing", label: copy.medicalMissing },
                { value: "submitted", label: copy.medicalSubmitted },
                { value: "approved", label: copy.medicalApproved },
              ]}
            />
            <Check name="vogVerified" label={copy.vogVerified} checked={driver.vogVerified} />
          </SectionForm>
        </Section>

        {!freelance ? (
          <>
            <Section title={copy.agencyCard} hint={copy.agencyHint}>
              <SectionForm driverId={driver.id} section="agency" saved={pick("agencyName", "agencyContact", "agencyContractRef", "agencyRateTier", "timesheetId", "evInduction", "trailerInduction")} copy={copy}>
                <Text name="agencyName" label={copy.agencyName} value={driver.agencyName} maxLength={120} />
                <Text name="agencyContact" label={copy.agencyContact} value={driver.agencyContact} maxLength={200} />
                <Text name="agencyContractRef" label={copy.agencyContract} value={driver.agencyContractRef} maxLength={80} />
                <Text name="agencyRateTier" label={copy.agencyRate} value={driver.agencyRateTier} maxLength={80} />
                <Text name="timesheetId" label={copy.timesheetId} value={driver.timesheetId} maxLength={80} wide />
                <Check name="evInduction" label={copy.evInduction} checked={driver.evInduction} />
                <Check name="trailerInduction" label={copy.trailerInduction} checked={driver.trailerInduction} />
              </SectionForm>
            </Section>
            <Section title={copy.authorisedCard} hint={copy.authorisedHint}>
              <ProfileForm key={driver.authorisedModels.join(",")} action={saveAuthorisedModels} success={copy.saved} className="flex flex-col gap-2">
                <input type="hidden" name="driverId" value={driver.id} />
                {authorisable.map((car) => (
                  <label key={car.key} className="flex items-center gap-2 text-sm text-zinc-800">
                    <input type="checkbox" name="model" value={car.key} defaultChecked={driver.authorisedModels.includes(car.key)} />
                    {car.label}
                  </label>
                ))}
                <button className={`${btn.base} ${btn.primary} ${btn.md} mt-2 w-fit`}>{copy.save}</button>
              </ProfileForm>
            </Section>
          </>
        ) : (
          <>
            <Section title={copy.businessCard} hint={copy.businessHint}>
              <SectionForm driverId={driver.id} section="business" saved={pick("tradeName", "kvk", "btwId", "iban")} copy={copy}>
                <Text name="tradeName" label={copy.tradeName} value={driver.tradeName} maxLength={160} wide />
                <Text name="kvk" label={copy.kvk} value={driver.kvk} maxLength={12} />
                <Text name="btwId" label={copy.btw} value={driver.btwId} maxLength={20} />
                {privateOk ? (
                  <Text name="iban" label={copy.iban} value={driver.iban} maxLength={40} wide />
                ) : (
                  <p className="m-0 text-sm text-zinc-700 sm:col-span-2">
                    {copy.iban}: {driver.iban ?? "—"} <span className="text-xs text-zinc-500">({copy.privateHidden})</span>
                  </p>
                )}
              </SectionForm>
              <div className="mt-4 grid">{slot("zzpagreement", copy.zzpAgreement)}</div>
            </Section>
            <Section title={copy.permitsCard}>
              <SectionForm driverId={driver.id} section="permits" saved={pick("permitNumber", "permitExpiry", "ondernemerskaartNumber", "ondernemerskaartExpiry")} copy={copy}>
                <Text name="permitNumber" label={copy.permitNumber} value={driver.permitNumber} maxLength={40} />
                <Text name="permitExpiry" label={copy.permitExpiry} value={driver.permitExpiry} type="date" />
                <Text name="ondernemerskaartNumber" label={copy.okNumber} value={driver.ondernemerskaartNumber} maxLength={40} />
                <Text name="ondernemerskaartExpiry" label={copy.okExpiry} value={driver.ondernemerskaartExpiry} type="date" />
              </SectionForm>
              <div className="mt-4 grid gap-3">
                {slot("permit", copy.permitScan)}
                {slot("ondernemerskaart", copy.okScan)}
              </div>
            </Section>
            <Section title={copy.insuranceCard}>
              <SectionForm driverId={driver.id} section="insurance" saved={pick("insurer", "insurancePolicy", "insuranceExpiry")} copy={copy}>
                <Text name="insurer" label={copy.insurer} value={driver.insurer} maxLength={120} />
                <Text name="insurancePolicy" label={copy.policy} value={driver.insurancePolicy} maxLength={80} />
                <Text name="insuranceExpiry" label={copy.insuranceExpiry} value={driver.insuranceExpiry} type="date" />
              </SectionForm>
              <div className="mt-4 grid">{slot("insurance", copy.certificate)}</div>
            </Section>
            <Section title={copy.vehiclesCard} hint={copy.vehiclesHint}>
              {vehicles.length === 0 ? <p className="m-0 mb-3 text-sm text-zinc-500">{copy.noVehicles}</p> : null}
              <ul className="m-0 mb-4 flex list-none flex-col gap-2 p-0">
                {vehicles.map((car) => (
                  <li key={car.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm">
                    <span>
                      <span className="font-medium text-zinc-950">{[car.make, car.model].filter(Boolean).join(" ")}</span>
                      <span className="text-zinc-600">
                        {" "}
                        · {car.plate}
                        {car.colour ? ` · ${car.colour}` : ""} · {car.passengers ?? "—"} {copy.passengers.toLowerCase()} · {car.luggage ?? "—"} {copy.luggage.toLowerCase()} · {copy.apk} {car.apkExpiry ? day(car.apkExpiry) : "—"}
                      </span>
                    </span>
                    <ActionForm action={removeDriverVehicle} tone="delete">
                      <input type="hidden" name="vehicleId" value={car.id} />
                      <button className={`${btn.base} ${btn.ghost} ${btn.sm} text-red-700`}>{copy.removeVehicle}</button>
                    </ActionForm>
                  </li>
                ))}
              </ul>
              <ProfileForm action={addDriverVehicle} success={copy.saved} resetOnSuccess className="grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="driverId" value={driver.id} />
                <Text name="make" label={copy.make} value="" required maxLength={60} />
                <Text name="model" label={copy.model} value="" maxLength={80} />
                <Text name="colour" label={copy.colour} value="" maxLength={40} />
                <Text name="plate" label={copy.plate} value="" required maxLength={10} />
                <Text name="passengers" label={copy.passengers} value="" type="number" required />
                <Text name="luggage" label={copy.luggage} value="" type="number" required />
                <Text name="apkExpiry" label={copy.apk} value="" type="date" required />
                <button className={`${btn.base} ${btn.secondary} ${btn.md} w-fit self-end`}>{copy.addVehicle}</button>
              </ProfileForm>
            </Section>
          </>
        )}

        {canErase ? (
          <Section title={copy.eraseCard} hint={copy.eraseHint}>
            <ActionForm
              action={eraseDriver}
              tone="delete"
              onSubmit={(event) => {
                if (!window.confirm(interpolate(copy.eraseConfirm, { name: driver.name }))) event.preventDefault();
              }}
            >
              <input type="hidden" name="driverId" value={driver.id} />
              <button className={`${btn.base} ${btn.danger} ${btn.md}`}>{copy.erase}</button>
            </ActionForm>
          </Section>
        ) : null}
      </div>
    </PageBody>
  );
}
