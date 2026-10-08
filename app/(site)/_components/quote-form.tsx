"use client";

import { useActionState, type ReactNode } from "react";
import { SERVICES } from "@/lib/quotes/constants";
import { submitQuote, type QuoteFormState } from "@/lib/quotes/actions";
import type { QuoteField } from "@/lib/quotes/validation";

// Inputs use 16px on phones so iOS doesn't zoom in on focus
const control =
  "w-full min-w-0 border-none bg-transparent p-0 text-[16px] tracking-[0] text-ink-950 normal-case outline-none placeholder:text-ink-420 md:text-[15px]";

function Field({
  label,
  name,
  error,
  children,
}: {
  label: string;
  name: QuoteField;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label
      htmlFor={`q-${name}`}
      className={`flex min-w-0 flex-col gap-[6px] bg-white px-[18px] py-4 text-[10px] tracking-[0.22em] text-ink-600 uppercase ${
        error ? "shadow-[inset_0_-2px_0_var(--color-error)]" : "focus-within:shadow-[inset_0_-2px_0_var(--color-ink-950)]"
      }`}
    >
      {label}
      {children}
      {error && (
        <span id={`q-${name}-error`} className="text-[11px] tracking-[0] text-error normal-case">
          {error}
        </span>
      )}
    </label>
  );
}

export function QuoteForm() {
  const [state, action, pending] = useActionState<QuoteFormState, FormData>(submitQuote, { status: "idle" });

  if (state.status === "success") {
    return (
      <div role="status" className="flex flex-col gap-3 border border-ink-225 bg-white px-8 py-10">
        <span className="text-[10px] tracking-[0.22em] text-ink-600 uppercase">Request received · {state.reference}</span>
        <p className="m-0 font-serif text-[30px] leading-[1.15] text-ink-950">
          Thank you, {state.name}. We will be in touch with your tailored quotation shortly.
        </p>
        <p className="m-0 text-[14px] text-ink-600">
          A member of our team reviews every request personally — usually within the hour.
        </p>
      </div>
    );
  }

  const v = state.status === "error" ? state.values : {};
  const err = state.status === "error" ? state.fieldErrors : {};
  const describedBy = (f: QuoteField) => (err[f] ? `q-${f}-error` : undefined);

  return (
    // Remount after each failed attempt so fields re-fill from the submitted values
    <form key={state.status === "error" ? state.attempt : 0} action={action} noValidate>
      <div className="grid grid-cols-1 gap-px border border-ink-225 bg-ink-225 md:grid-cols-2 xl:grid-cols-5">
        <Field label="Collection" name="collection" error={err.collection}>
          <input id="q-collection" name="collection" type="text" placeholder="Schiphol Airport" required
            maxLength={200} autoComplete="off" defaultValue={v.collection} aria-invalid={!!err.collection}
            aria-describedby={describedBy("collection")} className={control} />
        </Field>
        <Field label="Destination" name="destination" error={err.destination}>
          <input id="q-destination" name="destination" type="text" placeholder="The Hague, Hotel Des Indes" required
            maxLength={200} autoComplete="off" defaultValue={v.destination} aria-invalid={!!err.destination}
            aria-describedby={describedBy("destination")} className={control} />
        </Field>
        <Field label="Date & time" name="pickupAt" error={err.pickupAt}>
          <input id="q-pickupAt" name="pickupAt" type="datetime-local" required defaultValue={v.pickupAt}
            aria-invalid={!!err.pickupAt} aria-describedby={describedBy("pickupAt")} className={control} />
        </Field>
        <Field label="Service" name="service" error={err.service}>
          <select id="q-service" name="service" defaultValue={v.service || SERVICES[0]} className={control}>
            {SERVICES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Passengers" name="passengers" error={err.passengers}>
          <select id="q-passengers" name="passengers" defaultValue={v.passengers || ""} className={control}>
            <option value="">Select</option>
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
            <option value="8">8 or more</option>
          </select>
        </Field>

        <Field label="Full name" name="name" error={err.name}>
          <input id="q-name" name="name" type="text" placeholder="Your name" required maxLength={120}
            autoComplete="name" defaultValue={v.name} aria-invalid={!!err.name}
            aria-describedby={describedBy("name")} className={control} />
        </Field>
        <Field label="Email" name="email" error={err.email}>
          <input id="q-email" name="email" type="email" placeholder="you@company.com" required maxLength={200}
            autoComplete="email" defaultValue={v.email} aria-invalid={!!err.email}
            aria-describedby={describedBy("email")} className={control} />
        </Field>
        <Field label="Phone" name="phone" error={err.phone}>
          <input id="q-phone" name="phone" type="tel" placeholder="+31 6 1234 5678" required maxLength={24}
            autoComplete="tel" defaultValue={v.phone} aria-invalid={!!err.phone}
            aria-describedby={describedBy("phone")} className={control} />
        </Field>
        <Field label="Notes (optional)" name="notes" error={err.notes}>
          <input id="q-notes" name="notes" type="text" placeholder="Flight number, luggage, requests" maxLength={2000}
            autoComplete="off" defaultValue={v.notes} className={control} />
        </Field>

        {/* Honeypot for bots — hidden from people and assistive tech */}
        <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
          <input type="text" name="company_website" tabIndex={-1} autoComplete="off" defaultValue="" />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="min-h-[72px] cursor-pointer border-none bg-ink-950 font-sans text-[12px] font-semibold tracking-[0.24em] text-white uppercase hover:bg-ink-800 disabled:pointer-events-none disabled:cursor-progress disabled:opacity-70"
        >
          {pending ? "Sending…" : "Request tailored quote"}
        </button>
      </div>
      <p aria-live="polite" className={`mt-3 mb-0 text-[13px] ${state.status === "error" ? "text-error" : "text-ink-475"}`}>
        {state.status === "error" ? (
          state.message
        ) : (
          <>
            Your details are used only to prepare and send your quotation.{" "}
            <a href="/privacy" className="text-inherit">
              Privacy policy
            </a>
          </>
        )}
      </p>
    </form>
  );
}
