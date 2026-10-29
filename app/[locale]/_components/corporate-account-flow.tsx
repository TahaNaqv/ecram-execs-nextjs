"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, type RefObject } from "react";
import { abandonSignupChallenge, completeCode, verifyCode } from "@/lib/corporate/account-actions";
import { requestCode, requestReset, resendCode } from "@/lib/corporate/actions";
import type { CorporateState } from "@/lib/corporate/state";
import { PASSWORD_MIN } from "@/lib/corporate/validation";
import type { Locale } from "@/lib/i18n/config";
import { interpolate } from "@/lib/i18n/interpolate";
import { Honeypot, PasswordInput, Status, ghostClass, submitFullClass } from "./corporate-ui";
import { control, Field } from "./form-field";

type Step = "request" | "code" | "password";
type Mode = "signup" | "reset";

const STEP_RANK: Record<Step, number> = { request: 0, code: 1, password: 2 };

type HeadingRef = {
  headingRef: RefObject<HTMLHeadingElement | null>;
};

export type AccountFlowCopy = Record<
  | "stepRequest" | "stepCode" | "stepPassword" | "resetStepRequest" | "resetStepCode" | "resetStepPassword" | "progressLabel"
  | "labelEmail" | "phEmail" | "labelName" | "phName" | "labelPosition" | "phPosition" | "consentLabel" | "privacyNote" | "privacyLink"
  | "sendCode" | "sendResetCode" | "sending" | "verifyHeading" | "verifyIntro" | "resetVerifyHeading" | "resetVerifyIntro" | "verifyCta" | "verifying"
  | "passwordHeading" | "passwordIntro" | "resetPasswordHeading" | "resetPasswordIntro"
  | "labelCode" | "phCode" | "labelNewPassword" | "labelConfirmPassword" | "passwordHint" | "createAccountCta" | "creating"
  | "resetCta" | "resetting" | "resend" | "changeEmail" | "showPassword" | "hidePassword" | "haveAccount" | "loginLink" | "backToLogin",
  string
>;

type Props = {
  mode: Mode;
  locale: Locale;
  initial: { step: Step; email?: string };
  /** Challenge cookie present when this sign-up page was rendered. Cleared once, so a refresh starts empty. */
  staleChallengeId?: string;
  copy: AccountFlowCopy;
  minutes: number;
  privacyHref: string;
  loginHref: string;
};

export function AccountFlow({ mode, locale, initial, staleChallengeId = "", copy: t, minutes, privacyHref, loginHref }: Props) {
  const router = useRouter();
  // Sign-up never resumes a previous attempt. Password reset still opens on the step the code is at.
  const start = mode === "signup" ? { step: "request" as Step, email: "" } : initial;
  const [step, setStep] = useState<Step>(start.step);
  const [email, setEmail] = useState(start.email ?? "");
  const [banner, setBanner] = useState<string | undefined>();
  const [flowKey, setFlowKey] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);
  const wasHidden = useRef(false);
  const heldChallenge = useRef(staleChallengeId);
  // How far this visit got. A later server render that has no challenge left (the account was just created,
  // or a password reset was dropped) must discard that progress. Sign-up always starts again at the first step.
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

  // The cookie from the render that opened this page. A code asked for afterwards has a different id and is kept.
  useEffect(() => {
    if (mode !== "signup" || !heldChallenge.current) return;
    void abandonSignupChallenge(heldChallenge.current);
  }, [mode]);

  const routerRef = useRef(router);
  routerRef.current = router;

  // Back-forward cache restores the component, action state included, without running the flow again.
  // Next also keeps this page mounted after a client navigation and runs the effect again on the way back.
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
    router.refresh();
  };

  const steps: [Step, string][] = [
    ["request", mode === "signup" ? t.stepRequest : t.resetStepRequest],
    ["code", mode === "signup" ? t.stepCode : t.resetStepCode],
    ["password", mode === "signup" ? t.stepPassword : t.resetStepPassword],
  ];

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-8">
      <ol className="m-0 flex list-none flex-nowrap items-center gap-x-4 p-0 text-[10px] tracking-[0.2em] uppercase whitespace-nowrap overflow-x-auto" aria-label={t.progressLabel}>
  {steps.map(([key, label], i) => (
    <li key={key} aria-current={key === step ? "step" : undefined} className={`flex items-center shrink-0 ${key === step ? "text-ink-950 font-medium" : "text-ink-450"}`}>
      <span className="mr-1.5">{String(i + 1).padStart(2, "0")}</span>
      {label}
    </li>
  ))}
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

  return (
    <form key={attempt} action={action} noValidate autoComplete={mode === "signup" ? "off" : undefined} className="flex flex-col gap-6">
      <h2 ref={headingRef} tabIndex={-1} className="sr-only">
        {mode === "signup" ? t.stepRequest : t.resetStepRequest}
      </h2>
      {banner && <Status error>{banner}</Status>}
      <div className="grid grid-cols-1 gap-px border border-ink-225 bg-ink-225 md:grid-cols-2">
        <Field idPrefix="c" label={t.labelEmail} name="email" error={err.email} className="md:col-span-2">
          <input id="c-email" name="email" type="email" required maxLength={200} autoComplete={mode === "signup" ? "off" : "email"} placeholder={t.phEmail}
            defaultValue={v.email} aria-invalid={!!err.email} aria-describedby={err.email ? "c-email-error" : undefined} className={control} />
        </Field>
        {mode === "signup" && (
          <>
            <Field idPrefix="c" label={t.labelName} name="name" error={err.name}>
              <input id="c-name" name="name" type="text" required maxLength={120} autoComplete="off" placeholder={t.phName}
                defaultValue={v.name} aria-invalid={!!err.name} aria-describedby={err.name ? "c-name-error" : undefined} className={control} />
            </Field>
            <Field idPrefix="c" label={t.labelPosition} name="position" error={err.position}>
              <input id="c-position" name="position" type="text" required maxLength={120} autoComplete="off" placeholder={t.phPosition}
                defaultValue={v.position} aria-invalid={!!err.position} aria-describedby={err.position ? "c-position-error" : undefined} className={control} />
            </Field>
            <Field idPrefix="c" label="Company Legal Name" name="companyName" error={err.companyName}>
              <input id="c-companyName" name="companyName" type="text" required maxLength={200} autoComplete="off" placeholder="e.g. Shell B.V."
                defaultValue={v.companyName} aria-invalid={!!err.companyName} className={control} />
            </Field>
            <Field idPrefix="c" label="KVK Number" name="kvkNumber" error={err.kvkNumber}>
              <input id="c-kvkNumber" name="kvkNumber" type="text" required maxLength={30} autoComplete="off" placeholder="8 digits or reg no."
                defaultValue={v.kvkNumber} aria-invalid={!!err.kvkNumber} className={control} />
            </Field>
            <Field idPrefix="c" label="Direct Phone" name="phone" error={err.phone} className="md:col-span-2">
              <input id="c-phone" name="phone" type="tel" required maxLength={25} autoComplete="off" placeholder="+31 20 123 4567"
                defaultValue={v.phone} aria-invalid={!!err.phone} className={control} />
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
  const [state, action, pending] = useActionState<CorporateState, FormData>(async (prev, formData) => {
    const next = await completeCode(prev, formData);
    if (next.status === "locked") onRestart(next.message);
    if (next.status === "error") setAttempt((n) => n + 1);
    return next;
  }, { status: "idle" });
  const err = state.status === "error" ? state.fieldErrors : {};
  const describedBy = (field: "password" | "confirmPassword") => (err[field] ? `c-${field}-error` : undefined);
  const heading = mode === "signup" ? t.passwordHeading : t.resetPasswordHeading;
  const intro = mode === "signup" ? t.passwordIntro : t.resetPasswordIntro;

  return (
    <div className="flex flex-col gap-6">
      <h2 ref={headingRef} tabIndex={-1} className="m-0 font-serif text-[28px] font-normal leading-[1.1] text-ink-950 outline-none md:text-[32px]">
        {heading}
      </h2>
      <p className="m-0 text-[15px] text-ink-700">{interpolate(intro, { email })}</p>
      <form key={attempt} action={action} noValidate className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-px border border-ink-225 bg-ink-225">
          <Field idPrefix="c" label={t.labelNewPassword} name="password" error={err.password}>
            <PasswordInput id="c-password" name="password" autoComplete="new-password" invalid={!!err.password}
              describedBy={describedBy("password")} copy={{ show: t.showPassword, hide: t.hidePassword }} />
          </Field>
          <Field idPrefix="c" label={t.labelConfirmPassword} name="confirmPassword" error={err.confirmPassword}>
            <PasswordInput id="c-confirmPassword" name="confirmPassword" autoComplete="new-password" invalid={!!err.confirmPassword}
              describedBy={describedBy("confirmPassword")} copy={{ show: t.showPassword, hide: t.hidePassword }} />
          </Field>
        </div>
        <p className="m-0 text-[13px] text-ink-600">{interpolate(t.passwordHint, { min: PASSWORD_MIN })}</p>
        <input type="hidden" name="locale" value={locale} />
        <button type="submit" disabled={pending} className={`flex items-center justify-center ${submitFullClass}`}>
          {pending ? (mode === "signup" ? t.creating : t.resetting) : mode === "signup" ? t.createAccountCta : t.resetCta}
        </button>
        <Status error={state.status === "error" && !err.password && !err.confirmPassword}>
          {state.status === "error" && !err.password && !err.confirmPassword ? state.message : undefined}
        </Status>
      </form>
    </div>
  );
}