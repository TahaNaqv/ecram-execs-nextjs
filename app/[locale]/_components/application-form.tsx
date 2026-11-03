"use client";

import { ScrollIntoViewOnMount } from "./scroll-into-view-on-mount";
import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { checkApplication, submitApplication, type ApplicationFormState } from "@/lib/partners/actions";
import { DECLARATIONS, DOCUMENT_TYPES, DOCUMENTS, MAX_DOCUMENT_BYTES } from "@/lib/partners/criteria";
import type { FormField } from "@/lib/partners/validation";
import type { Locale } from "@/lib/i18n/config";
import type { DeclarationLabels, DocumentLabels } from "@/lib/partners/criteria";
import { localizedPath } from "@/lib/i18n/pathnames";
import Link from "next/link";
import { COUNTRY_CODES } from "@/lib/quotes/constants";
import { cleanPhoneInput, PASTE_MAX } from "@/lib/phone";

// Inputs use 16px on phones so iOS doesn't zoom in on focus
const control =
  "w-full min-w-0 border-none bg-transparent p-0 text-[16px] tracking-[0] text-ink-950 normal-case outline-none placeholder:text-ink-420 md:text-[15px]";

function Field({
  label,
  name,
  error,
  className = "",
  children,
}: {
  label: string;
  name: FormField;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label
      htmlFor={`a-${name}`}
      className={`flex min-w-0 flex-col gap-[6px] bg-white px-[18px] py-4 text-[10px] tracking-[0.22em] text-ink-600 uppercase ${
        error ? "shadow-[inset_0_-2px_0_var(--color-error)]" : "focus-within:shadow-[inset_0_-2px_0_var(--color-ink-950)]"
      } ${className}`}
    >
      {label}
      {children}
      {error && (
        <span id={`a-${name}-error`} className="text-[11px] tracking-[0] text-error normal-case">
          {error}
        </span>
      )}
    </label>
  );
}

type Stage = "checking" | "uploading" | "saving";

/** The copy this form needs. Passed in from the server so the client bundle carries only these. */
export type ApplicationFormCopy = {
  documents: DocumentLabels;
  declarations: DeclarationLabels;
  forms: { documentRequired: string; documentType: string; documentTooLarge: string; documentConnectionFailed: string; documentNotUploaded: string };
  page: Record<
    | "labelPlate" | "phPlate" | "labelName" | "phName" | "labelEmail" | "phEmail" | "labelPhone" | "labelCountry" | "phPhone"
    | "labelKvk" | "phKvk" | "labelExperience" | "phExperience" | "labelNotes" | "phNotes"
    | "documentsLegend" | "confirmLegend" | "submit" | "stageChecking" | "stageUploading" | "stageSaving"
    | "successLabel" | "successHeading" | "successNote" | "rdwRejected" | "privacyNote" | "privacyLink",
    string
  >;
};

const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (token, key: string) => values[key] ?? token);

/**
 * A Dutch plate as it is written, with its dashes put in while it is typed. The dashes fall between runs of letters and runs of digits
 * (XX-999-X, 99-XXX-9, 9-XXX-99, XXX-99-X, X-999-XX), and a run of four is split in two (99-99-XX, XX-XX-99, 99-XX-XX).
 */
export function formatPlate(raw: string): string {
  const chars = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  const runs = chars.match(/[A-Z]+|[0-9]+/g) ?? [];
  return runs.flatMap((run) => (run.length === 4 ? [run.slice(0, 2), run.slice(2)] : [run])).join("-");
}

/** `documents` is false when document storage isn't configured (local development) */
export function ApplicationForm({
  documents,
  locale,
  copy,
}: {
  documents: boolean;
  locale: Locale;
  copy: ApplicationFormCopy;
}) {
  const [stage, setStage] = useState<Stage>("checking");
  const [plate, setPlate] = useState("");
  const [phoneCountry, setPhoneCountry] = useState("31");
  const [countryOpen, setCountryOpen] = useState(false);
  const countryRef = useRef<HTMLDivElement>(null);
  const t = copy.page;
  const countryLabel = COUNTRY_CODES.find(([code]) => code === phoneCountry);
  const countryText = countryLabel ? `${countryLabel[1]} +${countryLabel[0]}` : `+${phoneCountry}`;

  useEffect(() => {
    if (!countryOpen) return;
    const close = (event: PointerEvent) => {
      if (!countryRef.current?.contains(event.target as Node)) setCountryOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCountryOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [countryOpen]);
  const stageText: Record<Stage, string> = {
    checking: t.stageChecking,
    uploading: t.stageUploading,
    saving: t.stageSaving,
  };

  async function apply(_prev: ApplicationFormState, formData: FormData): Promise<ApplicationFormState> {
    // Files go straight to storage, so only their type and size are sent to the server
    const files = new Map<string, File>();
    const fileErrors: Partial<Record<FormField, string>> = {};
    for (const name of DOCUMENTS) {
      const file = formData.get(name);
      formData.delete(name);
      if (!documents) continue;
      if (!(file instanceof File) || file.size === 0) {
        fileErrors[name] = fill(copy.forms.documentRequired, { document: copy.documents[name].label });
      } else if (!DOCUMENT_TYPES[file.type]) fileErrors[name] = copy.forms.documentType;
      else if (file.size > MAX_DOCUMENT_BYTES) fileErrors[name] = copy.forms.documentTooLarge;
      else {
        files.set(name, file);
        formData.set(`${name}Type`, file.type);
        formData.set(`${name}Size`, String(file.size));
      }
    }

    setStage("checking");
    const checked = await checkApplication(formData);
    if (checked.status === "error") return { ...checked, fieldErrors: { ...checked.fieldErrors, ...fileErrors } };
    if (Object.keys(fileErrors).length) return { status: "error", message: "Please check the highlighted details.", fieldErrors: fileErrors };
    if (checked.status !== "ready") return checked;

    setStage("uploading");
    const failed = await Promise.all(
      checked.uploads.map(async (u) => {
        const file = files.get(u.name)!;
        const res = await fetch(u.url, { method: "PUT", headers: { "content-type": file.type, "x-upsert": "false" }, body: file }).catch(() => null);
        return res?.ok ? null : u.name;
      }),
    );
    const notUploaded = failed.filter((f) => f !== null);
    if (notUploaded.length) {
      return {
        status: "error",
        message: copy.forms.documentConnectionFailed,
        fieldErrors: Object.fromEntries(notUploaded.map((n) => [n, copy.forms.documentNotUploaded])),
      };
    }

    setStage("saving");
    formData.set("ticket", checked.ticket);
    return submitApplication(formData);
  }

  const [state, dispatch, pending] = useActionState(apply, { status: "idle" });
  // Submitting through onSubmit (rather than a form action) keeps what was entered, files included, after an error
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(() => dispatch(formData));
  };

  if (state.status === "success") {
    return (
      <div role="status" tabIndex={-1} className="flex flex-col gap-3 border border-ink-225 bg-white px-8 py-10 outline-none">
        <ScrollIntoViewOnMount />
        <span className="text-[10px] tracking-[0.22em] text-ink-600 uppercase">
          {t.successLabel} · {state.reference}
        </span>
        <p className="m-0 font-serif text-[30px] leading-[1.15] text-ink-950">{fill(t.successHeading, { name: state.name })}</p>
        <p className="m-0 text-[14px] text-ink-600">{t.successNote}</p>
      </div>
    );
  }

  const err = state.status === "error" ? state.fieldErrors : {};
  const issues = state.status === "error" ? state.vehicleIssues : undefined;
  const describedBy = (f: FormField) => (err[f] ? `a-${f}-error` : undefined);

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-px border border-ink-225 bg-ink-225 md:grid-cols-2 xl:grid-cols-3">
        <Field label={t.labelPlate} name="plate" error={err.plate} className="md:col-span-2 xl:col-span-1">
          <span className="flex items-center gap-3">
            {/* Dutch taxi plates are blue */}
            <span aria-hidden="true" className="grid h-7 w-6 shrink-0 place-items-center bg-[#1d3f8f] text-[9px] font-semibold tracking-[0] text-white">
              NL
            </span>
            <input id="a-plate" name="plate" type="text" placeholder={t.phPlate} required maxLength={12}
              value={plate} onChange={(e) => setPlate(formatPlate(e.target.value))}
              autoComplete="off" autoCapitalize="characters" spellCheck={false}
              aria-invalid={!!err.plate} aria-describedby={describedBy("plate")}
              className={`${control} font-semibold tracking-[0.12em] uppercase`} />
          </span>
        </Field>
        <Field label={t.labelName} name="name" error={err.name}>
          <input id="a-name" name="name" type="text" placeholder={t.phName} required maxLength={120}
            autoComplete="name" aria-invalid={!!err.name}
            aria-describedby={describedBy("name")} className={control} />
        </Field>
        <Field label={t.labelEmail} name="email" error={err.email}>
          <input id="a-email" name="email" type="text" inputMode="email" spellCheck={false} placeholder={t.phEmail} required maxLength={200}
            autoComplete="email" aria-invalid={!!err.email}
            aria-describedby={describedBy("email")} className={control} />
        </Field>
        <Field label={t.labelPhone} name="phone" error={err.phone ?? err.phoneCountry} className={countryOpen ? "relative z-30" : ""}>
          <span className="flex min-w-0 items-center gap-2">
            <div ref={countryRef} className="relative shrink-0">
              <input type="hidden" name="phoneCountry" value={phoneCountry} />
              <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={countryOpen}
                aria-controls={countryOpen ? "a-phone-country" : undefined}
                aria-label={t.labelCountry}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setCountryOpen((open) => !open);
                }}
                className="flex w-[92px] cursor-pointer items-center border-0 border-r border-solid border-[#c5d4ff] bg-transparent py-0 pr-1 pl-0 text-left text-[16px] tracking-[0] text-[#ffffff] normal-case outline-none md:text-[15px]"
              >
                {countryText}
              </button>
              {countryOpen && (
                <ul
                  id="a-phone-country"
                  role="listbox"
                  aria-label={t.labelCountry}
                  className="absolute top-full left-0 z-50 mt-2 box-border max-h-60 w-[140px] list-none overflow-y-auto rounded-xl border border-solid border-[#c5d4ff] bg-[#ffffff] p-1 text-[#10224f] shadow-lg [color-scheme:light] [scrollbar-width:thin] [scrollbar-color:#d4d4d8_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-300 hover:[&::-webkit-scrollbar-thumb]:bg-zinc-400"
                >
                  {COUNTRY_CODES.map(([code, iso]) => {
                    const selected = code === phoneCountry;
                    return (
                      <li key={code}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={selected}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            setPhoneCountry(code);
                            const typed = document.getElementById("a-phone");
                            if (typed instanceof HTMLInputElement) typed.value = cleanPhoneInput(typed.value, code);
                            setCountryOpen(false);
                          }}
                          className={`m-0 w-full cursor-pointer rounded-lg border-0 px-3 py-2 text-left text-[14px] text-[#10224f] ${selected ? "bg-[#e8eeff] font-semibold" : "bg-[#ffffff] hover:bg-[#f4f7ff]"}`}
                        >
                          {iso} +{code}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <input id="a-phone" name="phone" type="text" placeholder={t.phPhone} required maxLength={PASTE_MAX}
              onInput={(e) => {
                const target = e.target as HTMLInputElement;
                target.value = cleanPhoneInput(target.value, phoneCountry);
              }}
              autoComplete="tel-national" inputMode="numeric" pattern="[0-9]*" aria-invalid={!!(err.phone ?? err.phoneCountry)}
              aria-describedby={describedBy("phone")} className={`${control} flex-1`} />
          </span>
        </Field>
        <Field label={t.labelKvk} name="kvk" error={err.kvk}>
          <input id="a-kvk" name="kvk" type="text" inputMode="numeric" placeholder={t.phKvk} required maxLength={8}
            onInput={(e) => {
              const target = e.target as HTMLInputElement;
              target.value = target.value.replace(/\D/g, "").slice(0, 8);
            }}
            autoComplete="off" aria-invalid={!!err.kvk}
            aria-describedby={describedBy("kvk")} className={control} />
        </Field>
        <Field label={t.labelExperience} name="experienceYears" error={err.experienceYears}>
          <input id="a-experienceYears" name="experienceYears" type="number" inputMode="numeric" min={0} max={60}
            placeholder={t.phExperience} required aria-invalid={!!err.experienceYears}
            aria-describedby={describedBy("experienceYears")} className={control} />
        </Field>
        <Field label={t.labelNotes} name="notes" error={err.notes} className="md:col-span-2 xl:col-span-3">
          <textarea id="a-notes" name="notes" rows={2} placeholder={t.phNotes}
            maxLength={2000} className={`${control} resize-y font-sans`} />
        </Field>
      </div>

      {documents && (
        <fieldset className="m-0 flex min-w-0 flex-col border-none p-0">
          <legend className="mb-3 p-0 text-[10px] tracking-[0.22em] text-ink-600 uppercase">{t.documentsLegend}</legend>
          <div className="grid grid-cols-1 gap-px border border-ink-225 bg-ink-225 md:grid-cols-2">
            {DOCUMENTS.map((name) => (
              <Field key={name} label={`${copy.documents[name].label} · ${copy.documents[name].hint}`} name={name} error={err[name]}>
                <input id={`a-${name}`} name={name} type="file" required accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
                  aria-invalid={!!err[name]} aria-describedby={describedBy(name)}
                  className={`${control} cursor-pointer text-[14px] file:mr-3 file:cursor-pointer file:border file:border-solid file:border-ink-225 file:bg-ink-50 file:px-3 file:py-1.5 file:font-sans file:text-[12px] file:text-ink-950`} />
              </Field>
            ))}
          </div>
        </fieldset>
      )}

      <fieldset className="m-0 flex flex-col gap-3 border-none p-0">
        <legend className="mb-3 p-0 text-[10px] tracking-[0.22em] text-ink-600 uppercase">{t.confirmLegend}</legend>
        {DECLARATIONS.map((name) => (
          <label key={name} className="flex cursor-pointer items-start gap-3 text-[14px] leading-[1.5] text-ink-950">
            <input type="checkbox" name={name} required
              aria-invalid={!!err[name]} className="mt-[3px] size-4 shrink-0 cursor-pointer accent-ink-950" />
            <span>
              {copy.declarations[name]}
              {err[name] && <span className="block text-[12px] text-error">{err[name]}</span>}
            </span>
          </label>
        ))}
      </fieldset>

      {/* A Server Action cannot read `next/root-params`, so the form carries the locale. */}
      <input type="hidden" name="locale" value={locale} />

      {/* Honeypot for bots — hidden from people and assistive tech */}
      <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
        <input type="text" name="company_website" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>

      {issues && issues.length > 0 && (
        <div role="alert" className="border border-error/40 bg-white px-5 py-4 text-[14px] text-ink-950">
          <p className="m-0 font-semibold">{t.rdwRejected}</p>
          <ul className="mt-2 mb-0 flex flex-col gap-1 pl-5">
            {issues.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-6">
        <button
          type="submit"
          disabled={pending}
          className="min-h-[60px] cursor-pointer border-none bg-ink-950 px-10 font-sans text-[12px] font-semibold tracking-[0.24em] text-white uppercase hover:bg-ink-800 disabled:pointer-events-none disabled:cursor-progress disabled:opacity-70"
        >
          {pending ? stageText[stage] : t.submit}
        </button>
        <p aria-live="polite" className={`m-0 text-[13px] ${state.status === "error" && !issues ? "text-error" : "text-ink-475"}`}>
          {state.status === "error" && !issues ? (
            state.message
          ) : (
            <>
              {t.privacyNote}{" "}
              <Link href={localizedPath("/privacy", locale)} className="text-inherit">
                {t.privacyLink}
              </Link>
            </>
          )}
        </p>
      </div>
    </form>
  );
}