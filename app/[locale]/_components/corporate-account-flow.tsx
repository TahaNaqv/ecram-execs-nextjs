"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, type RefObject } from "react";
import { refreshOnce } from "@/lib/nav/refresh-once";
import { abandonSignupChallenge, completeCode, verifyCode } from "@/lib/corporate/account-actions";
import { requestCode, requestReset, resendCode } from "@/lib/corporate/actions";
import type { CorporateState } from "@/lib/corporate/state";
import { normalizePassword, PASSWORD_MIN } from "@/lib/corporate/validation";
import type { Locale } from "@/lib/i18n/config";
import { interpolate } from "@/lib/i18n/interpolate";
import { Honeypot, PasswordInput, Status, ghostClass, submitFullClass } from "./corporate-ui";
import { control, Field } from "./form-field";
import { PhoneDialField } from "./phone-dial-field";

type Step = "request" | "code" | "password";
type Mode = "signup" | "reset";

const STEP_RANK: Record<Step, number> = { request: 0, code: 1, password: 2 };

type HeadingRef = {
  headingRef: RefObject<HTMLHeadingElement | null>;
};

export type AccountFlowCopy = Record<
  | "stepRequest" | "stepCode" | "stepPassword" | "resetStepRequest" | "resetStepCode" | "resetStepPassword" | "progressLabel"
  | "labelEmail" | "phEmail" | "labelName" | "phName" | "labelPosition" | "phPosition"
  | "labelSignatory" | "phSignatory" | "labelPointOfCall" | "phPointOfCall"
  | "labelBillingStreet" | "phBillingStreet" | "labelBillingPostcode" | "phBillingPostcode" | "labelBillingCity" | "phBillingCity"
  | "labelPhone" | "labelPhoneCountry" | "phBookerPhone" | "labelBillingVat" | "phBillingVat" | "labelBillingEmail" | "phBillingEmail"
  | "consentLabel" | "privacyNote" | "privacyLink"
  | "sendCode" | "sendResetCode" | "sending" | "verifyHeading" | "verifyIntro" | "resetVerifyHeading" | "resetVerifyIntro" | "verifyCta" | "verifying"
  | "passwordHeading" | "passwordIntro" | "resetPasswordHeading" | "resetPasswordIntro"
  | "labelCode" | "phCode" | "labelNewPassword" | "labelConfirmPassword" | "passwordHint" | "createAccountCta" | "creating"
  | "resetCta" | "resetting" | "resend" | "changeEmail" | "showPassword" | "hidePassword" | "haveAccount" | "loginLink" | "backToLogin"
  | "passwordTooShort",
  string
>;

type Props = {
  mode: Mode;
  locale: Locale;
  initial: { step: Step; email?: string };
  staleChallengeId?: string;
  copy: AccountFlowCopy;
  minutes: number;
  privacyHref: string;
  loginHref: string;
};

export function AccountFlow({ mode, locale, initial, staleChallengeId = "", copy: t, minutes, privacyHref, loginHref }: Props) {
  const router = useRouter();
  const start = mode === "signup" ? { step: "request" as Step, email: "" } : initial;
  const [step, setStep] = useState<Step>(start.step);
  const [email, setEmail] = useState(start.email ?? "");
  const [banner, setBanner] = useState<string | undefined>();
  const [flowKey, setFlowKey] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);
  const wasHidden = useRef(false);
  const heldChallenge = useRef(staleChallengeId);
  const reached = useRef(STEP_RANK[start.step]);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    heading.current?.focus();
  }, [step]);

  useEffect(() => {
    reached.current = Math.max(reached.current, STEP_RANK[step]);
  }, [step]);

  useEffect(() => {
    if (initial.step !== "request" || reached.current === 0) return;
    reached.current = 0;
    setStep("request");
    setEmail(initial.email ?? "");
    setBanner(undefined);
    setFlowKey((n) => n + 1);
  }, [initial.step, initial.email]);

  useEffect(() => {
    if (mode !== "signup" || !heldChallenge.current) return;
    void abandonSignupChallenge(heldChallenge.current);
  }, [mode]);

  const routerRef = useRef(router);
  routerRef.current = router;

  useEffect(() => {
    const clearSignup = () => {
      reached.current = 0;
      setEmail("");
      setBanner(undefined);
      setStep("request");
      setFlowKey((n) => n + 1);
      void abandonSignupChallenge();
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      if (mode === "signup") {
        clearSignup();
        return;
      }
      setFlowKey((n) => n + 1);
      setBanner(undefined);
      routerRef.current.refresh();
    };
    window.addEventListener("pageshow", onPageShow);
    if (mode === "signup" && wasHidden.current) {
      wasHidden.current = false;
      clearSignup();
    }
    return () => {
      if (mode === "signup") wasHidden.current = true;
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [mode]);

  const restart = (message?: string) => {
    reached.current = 0;
    setBanner(message);
    setEmail("");
    setStep("request");
    setFlowKey((n) => n + 1);
    if (mode === "signup") void abandonSignupChallenge();
    refreshOnce(router);
  };

  const steps: [Step, string][] = [
    ["request", mode === "signup" ? t.stepRequest : t.resetStepRequest],
    ["code", mode === "signup" ? t.stepCode : t.resetStepCode],
    ["password", mode === "signup" ? t.stepPassword : t.resetStepPassword],
  ];

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col items-center gap-5 text-center">
      {/* Strictly inline, single-line high contrast step headings */}
      <ol className="mx-auto flex w-full max-w-full list-none flex-wrap items-center justify-center gap-x-3 gap-y-1.5 p-0 text-center text-[10px] leading-tight tracking-[0.1em] uppercase sm:flex-nowrap sm:gap-x-6 sm:text-[12px] sm:tracking-[0.18em]" aria-label={t.progressLabel}>
        {steps.map(([key, label], i) => {
          const current = key === step;
          return (
            <li key={key} aria-current={current ? "step" : undefined} className={`flex items-center gap-1.5 ${current ? "font-bold text-[#ffffff]" : "text-zinc-400"}`}>
              <span className="shrink-0 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
              <span className="whitespace-nowrap">{label}</span>
            </li>
          );
        })}
      </ol>

      {step === "request" ? (
        <RequestForm
          key={flowKey}
          mode={mode}
          locale={locale}
          copy={t}
          banner={banner}
          privacyHref={privacyHref}
          headingRef={heading}
          onSent={(sentTo: string) => {
            setEmail(sentTo);
            setBanner(undefined);
            setStep("code");
          }}
        />
      ) : step === "code" ? (
        <CodeForm
          key={flowKey}
          mode={mode}
          locale={locale}
          copy={t}
          email={email}
          minutes={minutes}
          headingRef={heading}
          onVerified={() => setStep("password")}
          onRestart={restart}
        />
      ) : (
        <PasswordForm
          key={flowKey}
          mode={mode}
          locale={locale}
          copy={t}
          email={email}
          headingRef={heading}
          onRestart={restart}
        />
      )}

      <p className="m-0 text-[14px] text-ink-700">
        {mode === "signup" ? (
          <>
            {t.haveAccount}{" "}
            <Link href={loginHref} className="text-ink-950 underline underline-offset-4">
              {t.loginLink}
            </Link>
          </>
        ) : (
          <Link href={loginHref} className="text-ink-950 underline underline-offset-4">
            {t.backToLogin}
          </Link>
        )}
      </p>
    </div>
  );
}

function RequestForm({
  mode,
  locale,
  copy: t,
  banner,
  privacyHref,
  headingRef,
  onSent,
}: HeadingRef & { mode: Mode; locale: Locale; copy: AccountFlowCopy; banner?: string; privacyHref: string; onSent: (email: string) => void }) {
  const [attempt, setAttempt] = useState(0);

  const send = mode === "signup" ? requestCode : requestReset;
  const [state, action, pending] = useActionState<CorporateState, FormData>(async (prev, formData) => {
    const next = await send(prev, formData);
    if (next.status === "sent") onSent(next.email);
    if (next.status === "error") setAttempt((n) => n + 1);
    return next;
  }, { status: "idle" });
  const v = state.status === "error" ? state.values : {};
  const err = state.status === "error" ? state.fieldErrors : {};
  const fieldInput = `${control} text-[16px] text-[#ffffff] caret-[#ffffff] placeholder:text-[14px] placeholder:text-zinc-400`;

  return (
    <form key={attempt} action={action} noValidate autoComplete={mode === "signup" ? "off" : undefined} className="corp-fields flex w-full flex-col gap-4 text-left [&_label]:text-zinc-200 [&_label]:font-semibold">
      <h2 ref={headingRef} tabIndex={-1} className="sr-only">
        {mode === "signup" ? t.stepRequest : t.resetStepRequest}
      </h2>
      {banner && <Status error>{banner}</Status>}
      <div className="grid grid-cols-1 gap-px border border-ink-225 bg-ink-225 md:grid-cols-2 [&_label]:!px-3 sm:[&_label]:!px-[18px]">
        <Field idPrefix="c" label={t.labelEmail} name="email" error={err.email} className="md:col-span-2">
          <input id="c-email" name="email" type="text" inputMode="email" spellCheck={false} required maxLength={200} autoComplete={mode === "signup" ? "off" : "email"} placeholder={t.phEmail}
            defaultValue={v.email} aria-invalid={!!err.email} aria-describedby={err.email ? "c-email-error" : undefined} className={fieldInput} />
        </Field>
        {mode === "signup" && (
          <>
            <Field idPrefix="c" label={t.labelName} name="name" error={err.name}>
              <input id="c-name" name="name" type="text" required maxLength={120} autoComplete="off" placeholder={t.phName}
                defaultValue={v.name} aria-invalid={!!err.name} aria-describedby={err.name ? "c-name-error" : undefined} className={fieldInput} />
            </Field>
            <Field idPrefix="c" label={t.labelPosition} name="position" error={err.position}>
              <input id="c-position" name="position" type="text" required maxLength={120} autoComplete="off" placeholder={t.phPosition}
                defaultValue={v.position} aria-invalid={!!err.position} aria-describedby={err.position ? "c-position-error" : undefined} className={fieldInput} />
            </Field>
            <Field idPrefix="c" label="Company Legal Name" name="companyName" error={err.companyName}>
              <input id="c-companyName" name="companyName" type="text" required maxLength={200} autoComplete="off" placeholder="e.g. Shell B.V."
                defaultValue={v.companyName} aria-invalid={!!err.companyName} className={fieldInput} />
            </Field>
            <Field idPrefix="c" label="KVK Number" name="kvkNumber" error={err.kvkNumber}>
              <input 
                id="c-kvkNumber" 
                name="kvkNumber" 
                type="text" 
                required 
                maxLength={8} 
                pattern="[0-9]{8}"
                inputMode="numeric"
                autoComplete="off" 
                placeholder="12345678"
                title="KVK number must be exactly 8 digits"
                defaultValue={v.kvkNumber} 
                onInput={(e) => {
                  e.currentTarget.value = e.currentTarget.value.replace(/\D/g, "").slice(0, 8);
                }}
                aria-invalid={!!err.kvkNumber} 
                className={`${fieldInput} tabular-nums`} 
              />
            </Field>
            <Field idPrefix="c" label={t.labelSignatory} name="signatory" error={err.signatory}>
              <input id="c-signatory" name="signatory" type="text" required maxLength={120} autoComplete="off" placeholder={t.phSignatory}
                defaultValue={v.signatory} aria-invalid={!!err.signatory} aria-describedby={err.signatory ? "c-signatory-error" : undefined} className={fieldInput} />
            </Field>
            <Field idPrefix="c" label={t.labelPointOfCall} name="pointOfCall" error={err.pointOfCall}>
              <input id="c-pointOfCall" name="pointOfCall" type="text" required maxLength={120} autoComplete="off" placeholder={t.phPointOfCall}
                defaultValue={v.pointOfCall} aria-invalid={!!err.pointOfCall} aria-describedby={err.pointOfCall ? "c-pointOfCall-error" : undefined} className={fieldInput} />
            </Field>
            <Field idPrefix="c" label={t.labelBillingStreet} name="billingStreet" error={err.billingStreet} className="md:col-span-2">
              <input id="c-billingStreet" name="billingStreet" type="text" required maxLength={200} autoComplete="off" placeholder={t.phBillingStreet}
                defaultValue={v.billingStreet} aria-invalid={!!err.billingStreet} aria-describedby={err.billingStreet ? "c-billingStreet-error" : undefined} className={fieldInput} />
            </Field>
            <Field idPrefix="c" label={t.labelBillingPostcode} name="billingPostcode" error={err.billingPostcode}>
              <input id="c-billingPostcode" name="billingPostcode" type="text" required maxLength={20} autoComplete="off" placeholder={t.phBillingPostcode}
                defaultValue={v.billingPostcode} aria-invalid={!!err.billingPostcode} aria-describedby={err.billingPostcode ? "c-billingPostcode-error" : undefined} className={fieldInput} />
            </Field>
            <Field idPrefix="c" label={t.labelBillingCity} name="billingCity" error={err.billingCity}>
              <input id="c-billingCity" name="billingCity" type="text" required maxLength={100} autoComplete="off" placeholder={t.phBillingCity}
                defaultValue={v.billingCity} aria-invalid={!!err.billingCity} aria-describedby={err.billingCity ? "c-billingCity-error" : undefined} className={fieldInput} />
            </Field>
            <Field idPrefix="c" label={t.labelPhone} name="phone" error={err.phone} className="relative z-30 md:col-span-2">
              <PhoneDialField
                id="c-phone"
                countryName="phoneCountryCode"
                countryLabel={t.labelPhoneCountry}
                placeholder={t.phBookerPhone}
                defaultCountry={v.phoneCountryCode || "31"}
                defaultNumber={v.phone}
                required
                invalid={!!err.phone}
                describedBy={err.phone ? "c-phone-error" : undefined}
              />
            </Field>
            <Field idPrefix="c" label={t.labelBillingVat} name="billingVat" error={err.billingVat} className="md:col-span-2">
              <input id="c-billingVat" name="billingVat" type="text" maxLength={30} autoComplete="off" placeholder={t.phBillingVat}
                defaultValue={v.billingVat} aria-invalid={!!err.billingVat} aria-describedby={err.billingVat ? "c-billingVat-error" : undefined} className={fieldInput} />
            </Field>
            <Field idPrefix="c" label={t.labelBillingEmail} name="billingEmail" error={err.billingEmail} className="md:col-span-2">
              <input id="c-billingEmail" name="billingEmail" type="text" inputMode="email" maxLength={254} autoComplete="off" placeholder={t.phBillingEmail}
                defaultValue={v.billingEmail} aria-invalid={!!err.billingEmail} aria-describedby={err.billingEmail ? "c-billingEmail-error" : undefined} className={fieldInput} />
            </Field>
          </>
        )}
      </div>
      {mode === "signup" && (
        <label className="flex items-start gap-3 text-[14px] text-ink-700">
          <input type="checkbox" name="marketingConsent" defaultChecked={v.marketingConsent === "on"} className="mt-1 size-4 shrink-0 accent-ink-950" />
          <span>{t.consentLabel}</span>
        </label>
      )}
      {mode === "signup" && <input type="hidden" name="billingCountry" value="NL" />}
      <input type="hidden" name="locale" value={locale} />
      <Honeypot />
      <div className="flex flex-col items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className={`flex items-center justify-center ${submitFullClass}`}
        >
          {pending
            ? t.sending
            : mode === "signup"
              ? t.sendCode
              : t.sendResetCode}
        </button>
        <Status error={state.status === "error"}>
          {state.status === "error" ? (
            state.message
          ) : mode === "signup" ? (
            <>
              {t.privacyNote}{" "}
              <Link href={privacyHref} className="text-inherit">
                {t.privacyLink}
              </Link>
            </>
          ) : undefined}
        </Status>
      </div>
    </form>
  );
}

function CodeForm({
  mode,
  locale,
  copy: t,
  email,
  minutes,
  headingRef,
  onVerified,
  onRestart,
}: HeadingRef & { mode: Mode; locale: Locale; copy: AccountFlowCopy; email: string; minutes: number; onVerified: () => void; onRestart: (message?: string) => void }) {
  const [attempt, setAttempt] = useState(0);
  const [state, action, pending] = useActionState<CorporateState, FormData>(async (prev, formData) => {
    const next = await verifyCode(prev, formData);
    if (next.status === "verified") onVerified();
    if (next.status === "locked") onRestart(next.message);
    if (next.status === "error") setAttempt((n) => n + 1);
    return next;
  }, { status: "idle" });
  const [resendState, resendAction, resending] = useActionState<CorporateState, FormData>(async (prev, formData) => {
    const next = await resendCode(prev, formData);
    if (next.status === "locked") onRestart(next.message);
    return next;
  }, { status: "idle" });
  const err = state.status === "error" ? state.fieldErrors : {};
  const heading = mode === "signup" ? t.verifyHeading : t.resetVerifyHeading;
  const intro = mode === "signup" ? t.verifyIntro : t.resetVerifyIntro;

  return (
    <div className="flex flex-col gap-6">
      <h2 ref={headingRef} tabIndex={-1} className="m-0 font-serif text-[28px] font-normal leading-[1.1] text-ink-950 outline-none md:text-[32px]">
        {heading}
      </h2>
      <p className="m-0 text-[15px] text-ink-700">{interpolate(intro, { email, minutes })}</p>
      <form key={attempt} action={action} noValidate className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-px border border-ink-225 bg-ink-225">
          <Field idPrefix="c" label={t.labelCode} name="code" error={err.code}>
            <input id="c-code" name="code" type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoComplete="one-time-code"
              placeholder={t.phCode} aria-invalid={!!err.code} aria-describedby={err.code ? "c-code-error" : undefined}
              className={`${control} text-[22px] tracking-[0.5em] md:text-[22px]`} />
          </Field>
        </div>
        <input type="hidden" name="locale" value={locale} />
        <button type="submit" disabled={pending} className={`flex items-center justify-center ${submitFullClass}`}>
          {pending ? t.verifying : t.verifyCta}
        </button>
        <Status error={state.status === "error" && !err.code}>{state.status === "error" && !err.code ? state.message : undefined}</Status>
      </form>
      <div className="flex w-full items-center justify-center gap-x-6 gap-y-2">
        <form action={resendAction}>
          <input type="hidden" name="locale" value={locale} />
          <button type="submit" disabled={resending} className={ghostClass}>
            {t.resend}
          </button>
        </form>
        <button type="button" onClick={() => onRestart()} className={ghostClass}>
          {t.changeEmail}
        </button>
      </div>
      <Status error={resendState.status === "error"}>
        {resendState.status === "error" ? resendState.message : resendState.status === "sent" ? resendState.notice : undefined}
      </Status>
    </div>
  );
}

function PasswordForm({
  mode,
  locale,
  copy: t,
  email,
  headingRef,
  onRestart,
}: HeadingRef & { mode: Mode; locale: Locale; copy: AccountFlowCopy; email: string; onRestart: (message?: string) => void }) {
  const [attempt, setAttempt] = useState(0);
  const tooShort = interpolate(t.passwordTooShort, { min: PASSWORD_MIN });
  // null until the field has been typed in. A long enough password clears the message at once.
  const [typed, setTyped] = useState<number | null>(null);
  const [state, action, pending] = useActionState<CorporateState, FormData>(async (prev, formData) => {
    const length = normalizePassword(String(formData.get("password") ?? "")).length;
    if (length < PASSWORD_MIN) {
      setTyped(length);
      setAttempt((n) => n + 1);
      return { status: "error", message: "", fieldErrors: { password: tooShort }, values: {} };
    }
    const next = await completeCode(prev, formData);
    if (next.status === "locked") onRestart(next.message);
    if (next.status === "error") setAttempt((n) => n + 1);
    return next;
  }, { status: "idle" });
  const err = state.status === "error" ? state.fieldErrors : {};
  const passwordError =
    typed !== null && typed < PASSWORD_MIN ? tooShort : typed !== null && err.password === tooShort ? undefined : err.password;
  const describedBy = (field: "password" | "confirmPassword") =>
    (field === "password" ? passwordError : err.confirmPassword) ? `c-${field}-error` : undefined;
  const heading = mode === "signup" ? t.passwordHeading : t.resetPasswordHeading;
  const intro = mode === "signup" ? t.passwordIntro : t.resetPasswordIntro;

  return (
    <div className="flex flex-col gap-6">
      <h2 ref={headingRef} tabIndex={-1} className="m-0 font-serif text-[28px] font-normal leading-[1.1] text-ink-950 outline-none md:text-[32px]">
        {heading}
      </h2>
      <p className="m-0 text-[15px] text-ink-700">{interpolate(intro, { email })}</p>
      <form key={attempt} action={action} noValidate className="flex flex-col gap-6">
        <div className="flex flex-col gap-5">
          <Field idPrefix="c" label={t.labelNewPassword} name="password" error={passwordError} className="border border-ink-225">
            <PasswordInput id="c-password" name="password" autoComplete="new-password" invalid={!!passwordError}
              describedBy={describedBy("password")} copy={{ show: t.showPassword, hide: t.hidePassword }}
              onValue={(value) => setTyped(normalizePassword(value).length)} />
          </Field>
          <Field idPrefix="c" label={t.labelConfirmPassword} name="confirmPassword" error={err.confirmPassword} className="border border-ink-225">
            <PasswordInput id="c-confirmPassword" name="confirmPassword" autoComplete="new-password" invalid={!!err.confirmPassword}
              describedBy={describedBy("confirmPassword")} copy={{ show: t.showPassword, hide: t.hidePassword }} />
          </Field>
        </div>
        <p className="m-0 text-[13px] text-ink-600">{interpolate(t.passwordHint, { min: PASSWORD_MIN })}</p>
        <input type="hidden" name="locale" value={locale} />
        <button type="submit" disabled={pending} className={`flex items-center justify-center ${submitFullClass}`}>
          {pending ? (mode === "signup" ? t.creating : t.resetting) : mode === "signup" ? t.createAccountCta : t.resetCta}
        </button>
        <Status error={state.status === "error" && !passwordError && !err.confirmPassword}>
          {state.status === "error" && !passwordError && !err.confirmPassword ? state.message : undefined}
        </Status>
      </form>
    </div>
  );
}