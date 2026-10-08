"use client";

import { useActionState, type CSSProperties, type ReactNode } from "react";
import { SERVICES } from "@/lib/quotes/constants";
import { submitQuote, type QuoteFormState } from "@/lib/quotes/actions";
import type { QuoteField } from "@/lib/quotes/validation";

const cell: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  padding: "16px 18px",
  background: "#ffffff",
  fontSize: "10px",
  letterSpacing: "0.22em",
  textTransform: "uppercase",
  color: "#52525b",
  minWidth: 0,
};
const control: CSSProperties = {
  border: "none",
  outline: "none",
  fontSize: "15px",
  letterSpacing: "0",
  textTransform: "none",
  color: "#0a0a0b",
  padding: "0",
  background: "transparent",
  width: "100%",
  minWidth: 0,
};
const errorText: CSSProperties = {
  fontSize: "11px",
  letterSpacing: "0",
  textTransform: "none",
  color: "#b42318",
};

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
    <label style={{ ...cell, boxShadow: error ? "inset 0 -2px 0 #b42318" : undefined }} htmlFor={`q-${name}`}>
      {label}
      {children}
      {error && (
        <span id={`q-${name}-error`} style={errorText}>
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
      <div
        role="status"
        style={{
          background: "#ffffff",
          border: "1px solid #d4d4d8",
          padding: "40px 32px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        <span style={{ fontSize: "10px", letterSpacing: "0.22em", textTransform: "uppercase", color: "#52525b" }}>
          Request received · {state.reference}
        </span>
        <p
          style={{
            margin: 0,
            fontFamily: "var(--font-cormorant), serif",
            fontSize: "30px",
            lineHeight: 1.15,
            color: "#0a0a0b",
          }}
        >
          Thank you, {state.name}. We will be in touch with your tailored quotation shortly.
        </p>
        <p style={{ margin: 0, fontSize: "14px", color: "#52525b" }}>
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
      <div
        className="quote-grid"
        style={{ display: "grid", gap: "1px", background: "#d4d4d8", border: "1px solid #d4d4d8" }}
      >
        <Field label="Collection" name="collection" error={err.collection}>
          <input id="q-collection" name="collection" type="text" placeholder="Schiphol Airport" required
            maxLength={200} autoComplete="off" defaultValue={v.collection} aria-invalid={!!err.collection}
            aria-describedby={describedBy("collection")} style={control} />
        </Field>
        <Field label="Destination" name="destination" error={err.destination}>
          <input id="q-destination" name="destination" type="text" placeholder="The Hague, Hotel Des Indes" required
            maxLength={200} autoComplete="off" defaultValue={v.destination} aria-invalid={!!err.destination}
            aria-describedby={describedBy("destination")} style={control} />
        </Field>
        <Field label="Date & time" name="pickupAt" error={err.pickupAt}>
          <input id="q-pickupAt" name="pickupAt" type="datetime-local" required defaultValue={v.pickupAt}
            aria-invalid={!!err.pickupAt} aria-describedby={describedBy("pickupAt")} style={control} />
        </Field>
        <Field label="Service" name="service" error={err.service}>
          <select id="q-service" name="service" defaultValue={v.service || SERVICES[0]} style={control}>
            {SERVICES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Passengers" name="passengers" error={err.passengers}>
          <select id="q-passengers" name="passengers" defaultValue={v.passengers || ""} style={control}>
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
            aria-describedby={describedBy("name")} style={control} />
        </Field>
        <Field label="Email" name="email" error={err.email}>
          <input id="q-email" name="email" type="email" placeholder="you@company.com" required maxLength={200}
            autoComplete="email" defaultValue={v.email} aria-invalid={!!err.email}
            aria-describedby={describedBy("email")} style={control} />
        </Field>
        <Field label="Phone" name="phone" error={err.phone}>
          <input id="q-phone" name="phone" type="tel" placeholder="+31 6 1234 5678" required maxLength={24}
            autoComplete="tel" defaultValue={v.phone} aria-invalid={!!err.phone}
            aria-describedby={describedBy("phone")} style={control} />
        </Field>
        <Field label="Notes (optional)" name="notes" error={err.notes}>
          <input id="q-notes" name="notes" type="text" placeholder="Flight number, luggage, requests" maxLength={2000}
            autoComplete="off" defaultValue={v.notes} style={control} />
        </Field>

        {/* Honeypot for bots — hidden from people and assistive tech */}
        <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: "1px", height: "1px", overflow: "hidden" }}>
          <input type="text" name="company_website" tabIndex={-1} autoComplete="off" defaultValue="" />
        </div>

        <button
          type="submit"
          className="quote-submit"
          disabled={pending}
          style={{
            minHeight: "72px",
            border: "none",
            background: "#0a0a0b",
            color: "#ffffff",
            fontFamily: "var(--font-manrope), sans-serif",
            fontSize: "12px",
            letterSpacing: "0.24em",
            textTransform: "uppercase",
            fontWeight: 600,
            cursor: pending ? "progress" : "pointer",
            opacity: pending ? 0.7 : 1,
          }}
        >
          {pending ? "Sending…" : "Request tailored quote"}
        </button>
      </div>
      <p aria-live="polite" style={{ margin: "12px 0 0", fontSize: "13px", color: state.status === "error" ? "#b42318" : "#71717a" }}>
        {state.status === "error"
          ? state.message
          : (
            <>
              Your details are used only to prepare and send your quotation.{" "}
              <a href="/privacy" style={{ color: "inherit" }}>
                Privacy policy
              </a>
            </>
          )}
      </p>
    </form>
  );
}
