"use client";

import { useId, type ComponentProps, type ReactNode } from "react";
import { COUNTRY_CODES } from "@/lib/quotes/constants";
import { cleanPhoneInput, PASTE_MAX } from "@/lib/phone";
import { interpolate } from "@/lib/i18n/interpolate";

export const cardControl =
  "box-border block w-full min-w-0 rounded-xl border border-solid border-[rgba(116,161,255,0.35)] bg-[#102a63] px-3.5 py-3 font-sans text-[16px] text-[#ffffff] font-medium outline-none transition-[border-color,box-shadow,background-color] duration-200 placeholder:text-[#8eaee8] hover:border-[#8eb0ff] focus:border-[#60a5fa] focus:bg-[#133175] focus:shadow-[0_0_0_3px_rgba(96,165,250,0.25)] aria-[invalid=true]:border-[#ffb4ab] aria-[invalid=true]:shadow-[0_0_0_3px_rgba(255,180,171,0.16)] md:text-[15px] [&>option]:bg-[#102a63] [&>option]:text-[#ffffff]";

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

export const SendIcon = () => (
  <svg {...svgProps} strokeWidth={1.8} width={17} height={17} className="shrink-0">
    <path d="M21 3L3 10.5l7 3 3 7zM10 13.5L21 3" />
  </svg>
);

export const cardSubmit =
  "box-border inline-flex min-h-[52px] w-full max-w-[560px] cursor-pointer items-center justify-center gap-3 rounded-xl border border-[rgba(147,197,253,0.4)] bg-[#2563eb] px-8 font-sans text-[12px] font-bold tracking-[0.2em] text-[#ffffff] uppercase transition-[color,background-color,box-shadow,transform] duration-200 hover:bg-[#1d4ed8] hover:shadow-[0_0_30px_rgba(59,130,246,0.6)] active:scale-[0.99] disabled:pointer-events-none disabled:cursor-progress disabled:opacity-70";

export function CardGrid({ children, ...rest }: ComponentProps<"div">) {
  return (
    <div {...rest} className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 md:gap-5">
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
  as?: "h2" | "h3";
  children: ReactNode;
}) {
  const titleId = useId();
  return (
    <section 
      aria-labelledby={titleId} 
      className={`flex min-w-0 flex-col gap-5 rounded-2xl border border-solid border-[rgba(99,145,255,0.25)] bg-[#0c1f4d] p-5 shadow-[0_10px_30px_rgba(6,16,43,0.4)] md:p-6 text-[#ffffff] ${wide ? "md:col-span-2" : ""}`}
    >
      <div className="flex items-start gap-3.5">
        <span className="grid size-10 shrink-0 place-items-center rounded-full border border-solid border-[rgba(255,255,255,0.2)] bg-[#17326c] text-[#60a5fa] shadow-[0_0_16px_rgba(47,98,255,0.3)]">
          <svg {...svgProps} strokeWidth={1.6} width={20} height={20}>
            {ICONS[icon]}
          </svg>
        </span>
        <div className="min-w-0">
          <Heading id={titleId} className="m-0 font-sans text-[17px] leading-[1.3] font-bold text-[#ffffff]">
            <span className="text-[#ffffff] tabular-nums">{step}.</span> {title}
          </Heading>
          {hint && <p className="m-0 mt-0.5 text-[13.5px] leading-snug text-[#ffffff]">{hint}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

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
  hideLabel?: boolean;
  htmlFor?: string;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <label htmlFor={`${idPrefix}-${htmlFor ?? name}`} className={hideLabel ? "sr-only" : "text-[13px] font-semibold tracking-wide text-[#ffffff]"}>
        {label}
      </label>
      {children}
      {error && (
        <p id={`${idPrefix}-${name}-error`} className="m-0 text-[12px] text-[#ffb4ab]">
          {error}
        </p>
      )}
    </div>
  );
}

export function CardSelect({ className = "", children, ...props }: ComponentProps<"select">) {
  return (
    <div className="relative">
      <select {...props} className={`${cardControl} cursor-pointer appearance-none pr-10 ${className}`}>
        {children}
      </select>
      <svg {...svgProps} strokeWidth={2} width={16} height={16} className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[#60a5fa]">
        <path d="M6 9l6 6 6-6" />
      </svg>
    </div>
  );
}

export function LockedInput({ id, type = "text", value, hint }: { id: string; type?: "text" | "email"; value: string; hint: string }) {
  return (
    <div className="relative" title={hint}>
      <input id={id} type={type} value={value} readOnly aria-readonly="true" aria-describedby={`${id}-hint`}
        className="box-border block w-full min-w-0 cursor-default rounded-xl border border-solid border-[rgba(116,161,255,0.35)] bg-[#102a63] py-3 pr-10 pl-3.5 font-sans text-[16px] text-[#ffffff] font-semibold md:text-[15px]" />
      <span id={`${id}-hint`} className="sr-only">
        {hint}
      </span>
      <svg {...svgProps} strokeWidth={2} width={15} height={15} className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[#60a5fa]">
        <rect x="5" y="11" width="14" height="10" rx="2" />
        <path d="M8 11V7a4 4 0 018 0v4" />
      </svg>
    </div>
  );
}

export function ChoiceGroup({
  idPrefix,
  name,
  legend,
  options,
  value,
  onValueChange,
  defaultValue,
  error,
  required,
}: {
  idPrefix: string;
  name: string;
  legend: string;
  options: { value: string; label: string; wide?: boolean }[];
  value?: string;
  onValueChange?: (value: string) => void;
  defaultValue?: string;
  size?: "short" | "long";
  error?: string;
  required?: boolean;
}) {
  const controlled = onValueChange !== undefined;
  return (
    <fieldset aria-describedby={error ? `${idPrefix}-${name}-error` : undefined} className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
      <legend className="mb-1 p-0 text-[13px] font-semibold tracking-wide text-[#ffffff]">{legend}</legend>
      <div className="grid grid-cols-2 gap-2">
        {options.map((o, i) => (
          <label
            key={o.value}
            className={`flex min-h-12 min-w-0 cursor-pointer items-center gap-2.5 rounded-xl border border-solid border-[rgba(116,161,255,0.35)] bg-[#102a63] px-3.5 py-2.5 text-[14px] text-[#ffffff] transition-[border-color,background-color,box-shadow,color] duration-200 hover:border-[#60a5fa] hover:bg-[#133175] hover:shadow-[0_0_16px_rgba(96,165,250,0.16)] has-[:checked]:border-[#60a5fa] has-[:checked]:bg-[#163882] has-[:checked]:text-[#ffffff] has-[:checked]:shadow-[0_0_18px_rgba(96,165,250,0.28)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[#60a5fa] ${o.wide || (options.length % 2 === 1 && i === options.length - 1) ? "col-span-2" : ""}`}
          >
            <input
              type="radio"
              id={`${idPrefix}-${name}-${o.value}`}
              name={name}
              value={o.value}
              checked={controlled ? value === o.value : undefined}
              defaultChecked={controlled ? undefined : defaultValue === o.value}
              onChange={controlled ? () => onValueChange(o.value) : undefined}
              required={required}
              style={{ accentColor: "#ffffff" }}
              className="m-0 size-[17px] shrink-0 cursor-pointer bg-transparent text-white"
            />
            <span className="min-w-0 [overflow-wrap:anywhere]">{o.label}</span>
          </label>
        ))}
      </div>
      {error && (
        <p id={`${idPrefix}-${name}-error`} className="m-0 text-[12px] text-[#ffb4ab]">
          {error}
        </p>
      )}
    </fieldset>
  );
}

export function PhoneField({
  idPrefix,
  label,
  countryLabel,
  placeholder,
  country,
  number,
  onCountryChange,
  onNumberChange,
  error,
}: {
  idPrefix: string;
  label: string;
  countryLabel: string;
  placeholder: string;
  country: string;
  number: string;
  onCountryChange: (country: string) => void;
  onNumberChange: (number: string) => void;
  error?: string;
}) {
  return (
    <CardField idPrefix={idPrefix} name="phone" label={label} error={error}>
      <div
        className={`flex min-w-0 items-stretch rounded-xl border border-solid bg-[#102a63] transition-[border-color,box-shadow,background-color] duration-200 focus-within:bg-[#133175] focus-within:shadow-[0_0_0_3px_rgba(96,165,250,0.25)] ${error ? "border-[#ffb4ab]" : "border-[rgba(116,161,255,0.35)] hover:border-[#8eb0ff] focus-within:border-[#60a5fa]"}`}
      >
        <select
          id={`${idPrefix}-phoneCountry`}
          name="phoneCountry"
          aria-label={countryLabel}
          value={country}
          onChange={(e) => {
            onCountryChange(e.target.value);
            onNumberChange(cleanPhoneInput(number, e.target.value));
          }}
          className="w-[104px] max-w-[40%] shrink-0 cursor-pointer rounded-l-xl border-0 border-r border-solid border-[rgba(116,161,255,0.35)] bg-transparent py-3 pr-1 pl-3 text-[16px] tracking-[0] text-[#ffffff] normal-case outline-none md:text-[15px] [&>option]:bg-[#102a63] [&>option]:text-[#ffffff]"
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
          value={number}
          onChange={(e) => onNumberChange(cleanPhoneInput(e.target.value, country))}
          autoComplete="tel-national"
          placeholder={placeholder}
          aria-invalid={!!error}
          aria-describedby={error ? `${idPrefix}-phone-error` : undefined}
          className="min-w-0 flex-1 rounded-r-xl border-0 bg-transparent px-3 py-3 text-[16px] text-[#ffffff] outline-none placeholder:text-[#8eaee8] md:text-[15px]"
        />
      </div>
    </CardField>
  );
}

export function CountedTextarea({
  id,
  name,
  max,
  rows,
  counter,
  placeholder,
  value,
  onChange,
  invalid,
  describedBy,
}: {
  id: string;
  name: string;
  max: number;
  rows: number;
  counter: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  describedBy?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <textarea
        id={id}
        name={name}
        rows={rows}
        maxLength={max}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        className={`${cardControl} min-h-[120px] resize-y`}
      />
      <p className="m-0 text-right text-[12px] text-[#ffffff] tabular-nums">{interpolate(counter, { count: value.length, max })}</p>
    </div>
  );
}

export function ActionCard({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-solid border-[rgba(99,145,255,0.25)] bg-[#0c1f4d] p-5 text-center shadow-[0_10px_30px_rgba(6,16,43,0.4)] md:col-span-2 md:p-6 text-[#ffffff]">
      {children}
    </div>
  );
}