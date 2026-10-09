"use client";

import { useActionState, type ReactNode } from "react";
import { submitApplication, type ApplicationFormState } from "@/lib/partners/actions";
import { DECLARATIONS } from "@/lib/partners/criteria";
import type { ApplicationField } from "@/lib/partners/validation";

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
  name: ApplicationField;
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

export function ApplicationForm() {
  const [state, action, pending] = useActionState<ApplicationFormState, FormData>(submitApplication, { status: "idle" });

  if (state.status === "success") {
    return (
      <div role="status" className="flex flex-col gap-3 border border-ink-225 bg-white px-8 py-10">
        <span className="text-[10px] tracking-[0.22em] text-ink-600 uppercase">Application received · {state.reference}</span>
        <p className="m-0 font-serif text-[30px] leading-[1.15] text-ink-950">
          Thank you, {state.name}. Your car meets our criteria — we will be in touch to arrange an introduction.
        </p>
        <p className="m-0 text-[14px] text-ink-600">
          Please have your chauffeurskaart, Kiwa licence and insurance documents to hand when we call.
        </p>
      </div>
    );
  }

  const v = state.status === "error" ? state.values : {};
  const err = state.status === "error" ? state.fieldErrors : {};
  const issues = state.status === "error" ? state.vehicleIssues : undefined;
  const describedBy = (f: ApplicationField) => (err[f] ? `a-${f}-error` : undefined);

  return (
    // Remount after each failed attempt so fields re-fill from the submitted values
    <form key={state.status === "error" ? state.attempt : 0} action={action} noValidate className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-px border border-ink-225 bg-ink-225 md:grid-cols-2 xl:grid-cols-3">
        <Field label="Licence plate" name="plate" error={err.plate} className="md:col-span-2 xl:col-span-1">
          <span className="flex items-center gap-3">
            {/* Dutch taxi plates are blue */}
            <span aria-hidden="true" className="grid h-7 w-6 shrink-0 place-items-center bg-[#1d3f8f] text-[9px] font-semibold tracking-[0] text-white">
              NL
            </span>
            <input id="a-plate" name="plate" type="text" placeholder="T-123-AB" required maxLength={12}
              autoComplete="off" autoCapitalize="characters" spellCheck={false} defaultValue={v.plate}
              aria-invalid={!!err.plate} aria-describedby={describedBy("plate")}
              className={`${control} font-semibold tracking-[0.12em] uppercase`} />
          </span>
        </Field>
        <Field label="Full name" name="name" error={err.name}>
          <input id="a-name" name="name" type="text" placeholder="Your name" required maxLength={120}
            autoComplete="name" defaultValue={v.name} aria-invalid={!!err.name}
            aria-describedby={describedBy("name")} className={control} />
        </Field>
        <Field label="Email" name="email" error={err.email}>
          <input id="a-email" name="email" type="email" placeholder="you@example.com" required maxLength={200}
            autoComplete="email" defaultValue={v.email} aria-invalid={!!err.email}
            aria-describedby={describedBy("email")} className={control} />
        </Field>
        <Field label="Phone" name="phone" error={err.phone}>
          <input id="a-phone" name="phone" type="tel" placeholder="+31 6 1234 5678" required maxLength={24}
            autoComplete="tel" defaultValue={v.phone} aria-invalid={!!err.phone}
            aria-describedby={describedBy("phone")} className={control} />
        </Field>
        <Field label="KvK number" name="kvk" error={err.kvk}>
          <input id="a-kvk" name="kvk" type="text" inputMode="numeric" placeholder="12345678" required maxLength={12}
            autoComplete="off" defaultValue={v.kvk} aria-invalid={!!err.kvk}
            aria-describedby={describedBy("kvk")} className={control} />
        </Field>
        <Field label="Years as a professional driver" name="experienceYears" error={err.experienceYears}>
          <input id="a-experienceYears" name="experienceYears" type="number" inputMode="numeric" min={0} max={60}
            placeholder="5" required defaultValue={v.experienceYears} aria-invalid={!!err.experienceYears}
            aria-describedby={describedBy("experienceYears")} className={control} />
        </Field>
        <Field label="Anything else? (optional)" name="notes" error={err.notes} className="md:col-span-2 xl:col-span-3">
          <textarea id="a-notes" name="notes" rows={2} placeholder="Languages, areas you cover, availability"
            maxLength={2000} defaultValue={v.notes} className={`${control} resize-y font-sans`} />
        </Field>
      </div>

      <fieldset className="m-0 flex flex-col gap-3 border-none p-0">
        <legend className="mb-3 p-0 text-[10px] tracking-[0.22em] text-ink-600 uppercase">Please confirm</legend>
        {DECLARATIONS.map((d) => (
          <label key={d.name} className="flex cursor-pointer items-start gap-3 text-[14px] leading-[1.5] text-ink-950">
            <input type="checkbox" name={d.name} required defaultChecked={v[d.name] === "on"}
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
          {pending ? "Checking your car…" : "Apply to drive with us"}
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
