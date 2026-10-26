"use client";

import { useId, useState, type ComponentProps, type ReactNode } from "react";
import { COUNTRY_CODES } from "@/lib/quotes/constants";
import { cleanPhoneInput, PASTE_MAX } from "@/lib/phone";
import { interpolate } from "@/lib/i18n/interpolate";

/**
 * Building blocks for the Corporate Partner forms (the booking request and the company introduction): numbered cards
 * in a two-column grid, each with an icon, a title and a line of guidance, rounded fields with their label above,
 * choice pills, a locked field for what comes from the account, and a phone field with its country code.
 * (The home page's enquiry forms keep their own bordered cells: see form-field.tsx.)
 */

/** Inputs use 16px on phones so iOS doesn't zoom in on focus. */
export const cardControl =
  "box-border block w-full min-w-0 rounded-md font-sans border border-solid border-ink-225 bg-ink-50 px-3 py-2.5 text-[16px] text-ink-950 outline-none placeholder:text-ink-420 hover:border-ink-350 focus:border-ink-950 focus:bg-white focus:shadow-[0_0_0_3px_rgba(var(--ec-black-rgb),0.1)] aria-[invalid=true]:border-error md:text-[15px]";

const ICONS = {
  building: <path d="M4 21V4h10v17M14 9h6v12M2 21h20M8 8h2M8 12h2M8 16h2M17 13h1M17 17h1" />,
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1-4.5 4-6.5 8-6.5s7 2 8 6.5" />
    </>
  ),
  users: <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM22 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8" />,
  pin: (
    <>
      <path d="M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  car: <path d="M5 16l1.5-5.5A2 2 0 018.4 9h7.2a2 2 0 011.9 1.5L19 16M3.5 16h17v3h-17zM6 19v1.5M18 19v1.5M7 13h.01M17 13h.01" />,
  doc: <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8zM14 3v5h5M9 13h6M9 17h6" />,
  briefcase: <path d="M3 8h18v11H3zM8 8V5h8v3M3 13h18" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
} as const;

export type CardIcon = keyof typeof ICONS;

const svgProps = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

/** The paper-plane glyph on the submit buttons. */
export const SendIcon = () => (
  <svg {...svgProps} strokeWidth={1.8} width={17} height={17} className="shrink-0">
    <path d="M21 3L3 10.5l7 3 3 7zM10 13.5L21 3" />
  </svg>
);

/** The forms' main button: the one in corporate-styles.ts, rounded to match the cards and wide enough for the longer labels. */
export const cardSubmit =
  "box-border inline-flex min-h-[56px] w-full max-w-[560px] cursor-pointer items-center justify-center gap-3 rounded-md border-none bg-ink-950 px-8 font-sans text-[12px] font-semibold tracking-[0.2em] text-white uppercase hover:bg-ink-800 disabled:pointer-events-none disabled:cursor-progress disabled:opacity-70";

/** Two columns from `md` up, one on phones. Cards in the same row stretch to the same height. */
export function CardGrid({ children, ...rest }: ComponentProps<"div">) {
  return (
    <div {...rest} className="grid grid-cols-1 items-stretch gap-5 md:grid-cols-2">
      {children}
    </div>
  );
}

export function FormCard({
  icon,
  step,
  title,
  hint,
  wide,
  as: Heading = "h3",
  children,
}: {
  icon: CardIcon;
  step: number;
  title: string;
  hint?: string;
  wide?: boolean;
  /** The heading level: h3 under a form heading, h2 where the card titles are the page's first headings below the h1. */
  as?: "h2" | "h3";
  children: ReactNode;
}) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className={`flex min-w-0 flex-col gap-5 rounded-[10px] border border-solid border-ink-225 bg-white p-5 md:p-6 ${wide ? "md:col-span-2" : ""}`}>
      <header className="flex items-start gap-3.5">
        <span className="grid size-10 shrink-0 place-items-center rounded-full border border-solid border-ink-225 bg-ink-50 text-ink-950">
          <svg {...svgProps} strokeWidth={1.6} width={20} height={20}>
            {ICONS[icon]}
          </svg>
        </span>
        <div className="min-w-0">
          <Heading id={titleId} className="m-0 font-sans text-[17px] leading-[1.3] font-bold text-ink-950">
            <span className="text-ink-475 tabular-nums">{step}.</span> {title}
          </Heading>
          {hint && <p className="m-0 mt-0.5 text-[13.5px] text-ink-600">{hint}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}

/** A label above its control, with the validation message beneath. The message id is `{idPrefix}-{name}-error`. */
export function CardField({
  idPrefix,
  name,
  label,
  htmlFor,
  error,
  hideLabel,
  className = "",
  children,
}: {
  idPrefix: string;
  name: string;
  label: string;
  /** Keeps the label for screen readers when the card's own title already says it. */
  hideLabel?: boolean;
  /** The control's id suffix when it differs from `name` (the phone field is labelled by its number box). */
  htmlFor?: string;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <label htmlFor={`${idPrefix}-${htmlFor ?? name}`} className={hideLabel ? "sr-only" : "text-[13px] font-semibold text-ink-950"}>
        {label}
      </label>
      {children}
      {error && (
        <p id={`${idPrefix}-${name}-error`} className="m-0 text-[12px] text-error">
          {error}
        </p>
      )}
    </div>
  );
}

/** A native select with the arrow redrawn, so it matches the other fields. */
export function CardSelect({ className = "", children, ...props }: ComponentProps<"select">) {
  return (
    <div className="relative">
      <select {...props} className={`${cardControl} cursor-pointer appearance-none pr-10 ${className}`}>
        {children}
      </select>
      <svg {...svgProps} strokeWidth={2} width={16} height={16} className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ink-600">
        <path d="M6 9l6 6 6-6" />
      </svg>
    </div>
  );
}

/** A value that comes from the partner's account: shown, never typed, and read again from the database on the server. */
export function LockedInput({ id, type = "text", value, hint }: { id: string; type?: "text" | "email"; value: string; hint: string }) {
  return (
    <div className="relative" title={hint}>
      <input id={id} type={type} value={value} readOnly aria-readonly="true" aria-describedby={`${id}-hint`}
        className="box-border block w-full min-w-0 cursor-default rounded-md border border-solid border-ink-225 bg-ink-100 py-2.5 pr-10 pl-3 font-sans text-[16px] text-ink-700 md:text-[15px]" />
      <span id={`${id}-hint`} className="sr-only">
        {hint}
      </span>
      <svg {...svgProps} strokeWidth={2} width={15} height={15} className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ink-600">
        <rect x="5" y="11" width="14" height="10" rx="2" />
        <path d="M8 11V7a4 4 0 018 0v4" />
      </svg>
    </div>
  );
}

/** A small set of options shown as pills rather than a drop-down: one tap instead of two, and all of them visible. */
export function ChoiceGroup({
  idPrefix,
  name,
  legend,
  options,
  defaultValue,
  size = "long",
  error,
  required,
}: {
  idPrefix: string;
  name: string;
  legend: string;
  options: { value: string; label: string; wide?: boolean }[];
  defaultValue?: string;
  size?: "short" | "long";
  error?: string;
  required?: boolean;
}) {
  return (
    <fieldset aria-describedby={error ? `${idPrefix}-${name}-error` : undefined} className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
      <legend className="mb-2 p-0 text-[13px] font-semibold text-ink-950">{legend}</legend>
      <div className={`grid gap-2.5 ${size === "short" ? "grid-cols-[repeat(auto-fit,minmax(7.75rem,1fr))]" : "grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]"}`}>
        {options.map((o) => (
          <label
            key={o.value}
            className={`flex min-w-0 cursor-pointer items-center gap-2.5 rounded-md border border-solid border-ink-225 bg-ink-50 px-3 py-2.5 text-[14px] text-ink-950 hover:border-ink-475 has-[:checked]:border-ink-950 has-[:checked]:bg-white has-[:checked]:shadow-[inset_0_0_0_1px_var(--color-ink-950)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink-950 ${o.wide ? "col-span-full" : ""}`}
          >
            <input type="radio" id={`${idPrefix}-${name}-${o.value}`} name={name} value={o.value} defaultChecked={defaultValue === o.value} required={required} className="m-0 size-[17px] shrink-0 accent-ink-950" />
            <span className="min-w-0 [overflow-wrap:anywhere]">{o.label}</span>
          </label>
        ))}
      </div>
      {error && (
        <p id={`${idPrefix}-${name}-error`} className="m-0 text-[12px] text-error">
          {error}
        </p>
      )}
    </fieldset>
  );
}

/** Country code and number in one field with dynamic length limits based on the selected country code. */
export function PhoneField({
  idPrefix,
  label,
  countryLabel,
  placeholder,
  defaultCountry,
  defaultNumber,
  error,
}: {
  idPrefix: string;
  label: string;
  countryLabel: string;
  placeholder: string;
  defaultCountry?: string;
  defaultNumber?: string;
  error?: string;
}) {
  const [selectedCountry, setSelectedCountry] = useState(defaultCountry || "31");

  return (
    <CardField idPrefix={idPrefix} name="phone" label={label} error={error}>
      <div
        className={`flex items-stretch rounded-md border border-solid bg-ink-50 focus-within:bg-white focus-within:shadow-[0_0_0_3px_rgba(var(--ec-black-rgb),0.1)] ${error ? "border-error" : "border-ink-225 hover:border-ink-350 focus-within:border-ink-950"}`}
      >
        <select
          id={`${idPrefix}-phoneCountry`}
          name="phoneCountry"
          aria-label={countryLabel}
          value={selectedCountry}
          onChange={(e) => {
            setSelectedCountry(e.target.value);
            // A country with shorter numbers than the last one: cut what was typed down to the new limit
            const typed = document.getElementById(`${idPrefix}-phone`);
            if (typed instanceof HTMLInputElement) typed.value = cleanPhoneInput(typed.value, e.target.value);
          }}
          className="w-[104px] shrink-0 cursor-pointer rounded-l-md border-0 border-r border-solid border-ink-225 bg-transparent py-2.5 pr-1 pl-3 text-[16px] tracking-[0] text-ink-950 normal-case outline-none md:text-[15px]"
        >
          {COUNTRY_CODES.map(([code, iso]) => (
            <option key={code} value={code}>
              {iso} +{code}
            </option>
          ))}
        </select>
        <input
          id={`${idPrefix}-phone`}
          name="phone"
          type="tel"
          required
          maxLength={PASTE_MAX}
          onInput={(e) => {
            const target = e.target as HTMLInputElement;
            target.value = cleanPhoneInput(target.value, selectedCountry);
          }}
          autoComplete="tel-national"
          placeholder={placeholder}
          defaultValue={defaultNumber}
          aria-invalid={!!error}
          aria-describedby={error ? `${idPrefix}-phone-error` : undefined}
          className="min-w-0 flex-1 rounded-r-md border-0 bg-transparent px-3 py-2.5 text-[16px] text-ink-950 outline-none placeholder:text-ink-420 md:text-[15px]"
        />
      </div>
    </CardField>
  );
}

/** A text area that counts what has been typed against its limit. */
export function CountedTextarea({
  id,
  name,
  max,
  rows,
  counter,
  placeholder,
  defaultValue = "",
  invalid,
  describedBy,
}: {
  id: string;
  name: string;
  max: number;
  rows: number;
  counter: string;
  placeholder?: string;
  defaultValue?: string;
  invalid?: boolean;
  describedBy?: string;
}) {
  const [length, setLength] = useState(defaultValue.length);
  return (
    <div className="flex flex-col gap-1.5">
      <textarea
        id={id}
        name={name}
        rows={rows}
        maxLength={max}
        placeholder={placeholder}
        defaultValue={defaultValue}
        onChange={(e) => setLength(e.target.value.length)}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        className={`${cardControl} min-h-[120px] resize-y`}
      />
      <p className="m-0 text-right text-[12px] text-ink-600 tabular-nums">{interpolate(counter, { count: length, max })}</p>
    </div>
  );
}

/** The closing card of a form: the button, a line saying what happens next, and the status line. */
export function ActionCard({ children }: { children: ReactNode }) {
  return <div className="flex flex-col items-center gap-3 rounded-[10px] border border-solid border-ink-225 bg-white p-5 text-center md:col-span-2 md:p-6 md:pb-4">{children}</div>;
}