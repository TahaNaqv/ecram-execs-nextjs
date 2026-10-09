"use client";

import { startTransition, useActionState, useState, type FormEvent, type ReactNode } from "react";
import { checkApplication, submitApplication, type ApplicationFormState } from "@/lib/partners/actions";
import { DECLARATIONS, DOCUMENT_TYPES, DOCUMENTS, MAX_DOCUMENT_BYTES } from "@/lib/partners/criteria";
import type { FormField } from "@/lib/partners/validation";

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
const STAGE_TEXT: Record<Stage, string> = { checking: "Checking your car…", uploading: "Uploading documents…", saving: "Sending…" };

/** `documents` is false when document storage isn't configured (local development) */
export function ApplicationForm({ documents }: { documents: boolean }) {
  const [stage, setStage] = useState<Stage>("checking");

  async function apply(_prev: ApplicationFormState, formData: FormData): Promise<ApplicationFormState> {
    // Files go straight to storage, so only their type and size are sent to the server
    const files = new Map<string, File>();
    const fileErrors: Partial<Record<FormField, string>> = {};
    for (const d of DOCUMENTS) {
      const file = formData.get(d.name);
      formData.delete(d.name);
      if (!documents) continue;
      if (!(file instanceof File) || file.size === 0) fileErrors[d.name] = `Please add your ${d.label}.`;
      else if (!DOCUMENT_TYPES[file.type]) fileErrors[d.name] = "Please upload a PDF, JPG or PNG.";
      else if (file.size > MAX_DOCUMENT_BYTES) fileErrors[d.name] = "This file is larger than 5 MB.";
      else {
        files.set(d.name, file);
        formData.set(`${d.name}Type`, file.type);
        formData.set(`${d.name}Size`, String(file.size));
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
        message: "We couldn't upload your documents. Please check your connection and try again.",
        fieldErrors: Object.fromEntries(notUploaded.map((n) => [n, "This file didn't upload."])),
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
      <div role="status" className="flex flex-col gap-3 border border-ink-225 bg-white px-8 py-10">
        <span className="text-[10px] tracking-[0.22em] text-ink-600 uppercase">Application received · {state.reference}</span>
        <p className="m-0 font-serif text-[30px] leading-[1.15] text-ink-950">
          Thank you, {state.name}. Your car meets our criteria — we will be in touch to arrange an introduction.
        </p>
        <p className="m-0 text-[14px] text-ink-600">
          Please bring the originals of your documents and your Kiwa licence to the introduction.
        </p>
      </div>
    );
  }

  const err = state.status === "error" ? state.fieldErrors : {};
  const issues = state.status === "error" ? state.vehicleIssues : undefined;
  const describedBy = (f: FormField) => (err[f] ? `a-${f}-error` : undefined);

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-px border border-ink-225 bg-ink-225 md:grid-cols-2 xl:grid-cols-3">
        <Field label="Licence plate" name="plate" error={err.plate} className="md:col-span-2 xl:col-span-1">
          <span className="flex items-center gap-3">
            {/* Dutch taxi plates are blue */}
            <span aria-hidden="true" className="grid h-7 w-6 shrink-0 place-items-center bg-[#1d3f8f] text-[9px] font-semibold tracking-[0] text-white">
              NL
            </span>
            <input id="a-plate" name="plate" type="text" placeholder="T-123-AB" required maxLength={12}
              autoComplete="off" autoCapitalize="characters" spellCheck={false}
              aria-invalid={!!err.plate} aria-describedby={describedBy("plate")}
              className={`${control} font-semibold tracking-[0.12em] uppercase`} />
          </span>
        </Field>
        <Field label="Full name" name="name" error={err.name}>
          <input id="a-name" name="name" type="text" placeholder="Your name" required maxLength={120}
            autoComplete="name" aria-invalid={!!err.name}
            aria-describedby={describedBy("name")} className={control} />
        </Field>
        <Field label="Email" name="email" error={err.email}>
          <input id="a-email" name="email" type="email" placeholder="you@example.com" required maxLength={200}
            autoComplete="email" aria-invalid={!!err.email}
            aria-describedby={describedBy("email")} className={control} />
        </Field>
        <Field label="Phone" name="phone" error={err.phone}>
          <input id="a-phone" name="phone" type="tel" placeholder="+31 6 1234 5678" required maxLength={24}
            autoComplete="tel" aria-invalid={!!err.phone}
            aria-describedby={describedBy("phone")} className={control} />
        </Field>
        <Field label="KvK number" name="kvk" error={err.kvk}>
          <input id="a-kvk" name="kvk" type="text" inputMode="numeric" placeholder="12345678" required maxLength={12}
            autoComplete="off" aria-invalid={!!err.kvk}
            aria-describedby={describedBy("kvk")} className={control} />
        </Field>
        <Field label="Years as a professional driver" name="experienceYears" error={err.experienceYears}>
          <input id="a-experienceYears" name="experienceYears" type="number" inputMode="numeric" min={0} max={60}
            placeholder="5" required aria-invalid={!!err.experienceYears}
            aria-describedby={describedBy("experienceYears")} className={control} />
        </Field>
        <Field label="Anything else? (optional)" name="notes" error={err.notes} className="md:col-span-2 xl:col-span-3">
          <textarea id="a-notes" name="notes" rows={2} placeholder="Languages, areas you cover, availability"
            maxLength={2000} className={`${control} resize-y font-sans`} />
        </Field>
      </div>

      {documents && (
        <fieldset className="m-0 flex min-w-0 flex-col border-none p-0">
          <legend className="mb-3 p-0 text-[10px] tracking-[0.22em] text-ink-600 uppercase">Your documents · PDF, JPG or PNG, up to 5 MB each</legend>
          <div className="grid grid-cols-1 gap-px border border-ink-225 bg-ink-225 md:grid-cols-2">
            {DOCUMENTS.map((d) => (
              <Field key={d.name} label={`${d.label} · ${d.hint}`} name={d.name} error={err[d.name]}>
                <input id={`a-${d.name}`} name={d.name} type="file" required accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
                  aria-invalid={!!err[d.name]} aria-describedby={describedBy(d.name)}
                  className={`${control} cursor-pointer text-[14px] file:mr-3 file:cursor-pointer file:border file:border-solid file:border-ink-225 file:bg-ink-50 file:px-3 file:py-1.5 file:font-sans file:text-[12px] file:text-ink-950`} />
              </Field>
            ))}
          </div>
        </fieldset>
      )}

      <fieldset className="m-0 flex flex-col gap-3 border-none p-0">
        <legend className="mb-3 p-0 text-[10px] tracking-[0.22em] text-ink-600 uppercase">Please confirm</legend>
        {DECLARATIONS.map((d) => (
          <label key={d.name} className="flex cursor-pointer items-start gap-3 text-[14px] leading-[1.5] text-ink-950">
            <input type="checkbox" name={d.name} required
              aria-invalid={!!err[d.name]} className="mt-[3px] size-4 shrink-0 cursor-pointer accent-ink-950" />
            <span>
              {d.label}
              {err[d.name] && <span className="block text-[12px] text-error">{err[d.name]}</span>}
            </span>
          </label>
        ))}
      </fieldset>

      {/* Honeypot for bots — hidden from people and assistive tech */}
      <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
        <input type="text" name="company_website" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>

      {issues && issues.length > 0 && (
        <div role="alert" className="border border-error/40 bg-white px-5 py-4 text-[14px] text-ink-950">
          <p className="m-0 font-semibold">According to the RDW register, this car doesn&apos;t meet our criteria:</p>
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
          {pending ? STAGE_TEXT[stage] : "Apply to drive with us"}
        </button>
        <p aria-live="polite" className={`m-0 text-[13px] ${state.status === "error" && !issues ? "text-error" : "text-ink-475"}`}>
          {state.status === "error" && !issues ? (
            state.message
          ) : (
            <>
              We check your plate against the RDW register straight away. Your details are used only to assess your application.{" "}
              <a href="/privacy" className="text-inherit">
                Privacy policy
              </a>
            </>
          )}
        </p>
      </div>
    </form>
  );
}
