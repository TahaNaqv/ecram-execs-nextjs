"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { OPEN_SETTINGS_EVENT, parseConsent, readConsentValue, subscribeConsent, type ConsentCategory } from "@/lib/consent";
import { saveConsent } from "@/lib/consent-client";
import type { Dictionary } from "@/lib/i18n/types";
import { CookieTable } from "./cookie-table";

type Copy = Dictionary["cookieConsent"];
type Choice = Record<ConsentCategory, boolean>;

const ALL: Choice = { analytics: true, marketing: true };
const NONE: Choice = { analytics: false, marketing: false };

/** Accepting and rejecting look exactly alike: neither is made easier to press than the other. */
const choiceButton =
  "min-h-[44px] cursor-pointer border border-solid border-ink-250 bg-transparent px-5 font-sans text-[11px] font-semibold tracking-[0.2em] text-white uppercase transition-colors hover:bg-white hover:text-ink-950";
/** The dialog's own action: filled, so it stands apart from the two equal choices beside it. */
const primaryButton =
  "min-h-[44px] cursor-pointer border border-solid border-white bg-white px-5 font-sans text-[11px] font-semibold tracking-[0.2em] text-ink-950 uppercase transition-colors hover:bg-ink-150";
const linkButton =
  "min-h-[44px] cursor-pointer border-none bg-transparent px-2 font-sans text-[11px] font-medium tracking-[0.18em] text-ink-150 uppercase underline underline-offset-4 hover:text-white";

/**
 * The cookie banner and the preferences dialog. Until the visitor chooses, only strictly necessary cookies are set. The
 * choice is stored by lib/consent.ts, and anything optional waits for it (see ConsentGate). The page is prerendered, so
 * nothing is drawn on the server: the banner appears once the browser has read the stored choice. It is fixed to the
 * bottom of the window, so appearing moves nothing, and it does not block the page: leaving it unanswered keeps the
 * optional cookies off.
 */
export function CookieConsent({ copy, policyHref }: { copy: Copy; policyHref: string }) {
  // null on the server and while hydrating; "" when there is no stored choice
  const stored = useSyncExternalStore(subscribeConsent, readConsentValue, () => null);
  const consent = parseConsent(stored);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const open = () => setSettingsOpen(true);
    window.addEventListener(OPEN_SETTINGS_EVENT, open);
    return () => window.removeEventListener(OPEN_SETTINGS_EVENT, open);
  }, []);

  const open = stored !== null && !consent;
  const bar = useRef<HTMLDivElement>(null);
  // While the bar is up, the floating buttons (WhatsApp, section arrows) are lifted above it instead of hidden behind it
  useEffect(() => {
    const el = bar.current;
    if (!open || !el) return;
    const root = document.documentElement;
    const measure = () => root.style.setProperty("--cookie-banner-h", `${el.offsetHeight}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--cookie-banner-h");
    };
  }, [open]);

  if (stored === null) return null;
  return (
    <>
      {!consent && (
        <div ref={bar} role="region" aria-label={copy.bannerTitle} className="fixed inset-x-0 bottom-0 z-[60] border-t border-solid border-ink-700 bg-ink-950 font-sans text-ink-150 shadow-[0_-12px_40px_rgba(0,0,0,0.45)]">
          <div className="mx-auto flex max-w-[1280px] flex-col gap-4 px-5 py-5 md:flex-row md:items-center md:justify-between md:gap-10 md:px-6 2xl:max-w-[1440px]">
            <div className="flex min-w-0 flex-col gap-1.5 md:max-w-[760px]">
              <p className="m-0 font-serif text-[20px] leading-tight text-white">{copy.bannerTitle}</p>
              <p className="m-0 text-[13px] leading-relaxed font-light text-ink-300">
                {copy.bannerText}{" "}
                <Link href={policyHref} prefetch={false} className="text-ink-150 underline underline-offset-4">
                  {copy.policyLink}
                </Link>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 md:shrink-0 md:flex-nowrap">
              {/* One column width for both, so refusing is exactly as big as accepting */}
              <div className="grid grid-flow-col auto-cols-fr gap-3 max-md:w-full">
                <button type="button" className={choiceButton} onClick={() => void saveConsent(NONE)}>
                  {copy.rejectAll}
                </button>
                <button type="button" className={choiceButton} onClick={() => void saveConsent(ALL)}>
                  {copy.acceptAll}
                </button>
              </div>
              <button type="button" className={`${linkButton} max-md:w-full`} onClick={() => setSettingsOpen(true)}>
                {copy.preferences}
              </button>
            </div>
          </div>
        </div>
      )}
      {settingsOpen && <Preferences copy={copy} initial={consent ?? NONE} onClose={() => setSettingsOpen(false)} />}
    </>
  );
}

/** The dialog is only mounted while it is open, so it starts from the stored choice each time. */
function Preferences({ copy, initial, onClose }: { copy: Copy; initial: Choice; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [draft, setDraft] = useState<Choice>(initial);

  useEffect(() => {
    const el = dialog.current;
    if (el && !el.open) el.showModal();
  }, []);

  const choose = (choice: Choice) => {
    void saveConsent(choice);
    dialog.current?.close();
  };

  const categories: { key: ConsentCategory; title: string; text: string }[] = [
    { key: "analytics", title: copy.analyticsTitle, text: copy.analyticsText },
    { key: "marketing", title: copy.marketingTitle, text: copy.marketingText },
  ];

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        // A click on the dimmed area around the panel closes it, without saving anything
        if (e.target === e.currentTarget) dialog.current?.close();
      }}
      className="m-auto max-h-[92vh] w-[min(720px,calc(100vw-2rem))] overflow-y-auto border border-solid border-ink-700 bg-ink-950 p-0 font-sans text-ink-150 backdrop:bg-black/70"
    >
      <div className="flex flex-col gap-6 p-6 md:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <h2 id={titleId} tabIndex={-1} autoFocus className="m-0 font-serif text-[26px] leading-tight font-normal text-white outline-none">
              {copy.prefsTitle}
            </h2>
            <p className="m-0 text-[14px] font-light text-ink-300">{copy.prefsIntro}</p>
          </div>
          <button type="button" onClick={() => dialog.current?.close()} aria-label={copy.close} className="grid size-10 shrink-0 cursor-pointer place-items-center border border-solid border-ink-700 bg-transparent text-ink-150 hover:bg-white hover:text-ink-950">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M5 5l14 14M19 5L5 19" />
            </svg>
          </button>
        </div>

        <ul className="m-0 flex list-none flex-col gap-px bg-ink-800 p-0">
          <li className="flex items-start justify-between gap-6 bg-ink-950 py-4">
            <div className="flex flex-col gap-1">
              <p className="m-0 text-[15px] font-medium text-white">{copy.necessaryTitle}</p>
              <p className="m-0 text-[13px] font-light text-ink-300">{copy.necessaryText}</p>
            </div>
            <span className="shrink-0 pt-0.5 text-[11px] tracking-[0.18em] text-ink-450 uppercase">{copy.alwaysOn}</span>
          </li>
          {categories.map(({ key, title, text }) => (
            <li key={key} className="flex items-start justify-between gap-6 bg-ink-950 py-4">
              <div className="flex flex-col gap-1">
                <p className="m-0 text-[15px] font-medium text-white">{title}</p>
                <p className="m-0 text-[13px] font-light text-ink-300">
                  {text} <span className="text-ink-450">{copy.noneInUse}</span>
                </p>
              </div>
              <label className="flex shrink-0 cursor-pointer items-center gap-3 pt-0.5">
                <span className="w-7 text-right text-[11px] tracking-[0.18em] text-ink-300 uppercase" aria-hidden="true">
                  {draft[key] ? copy.switchOn : copy.switchOff}
                </span>
                <input
                  type="checkbox"
                  role="switch"
                  checked={draft[key]}
                  onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.checked }))}
                  aria-label={title}
                  className="peer sr-only"
                />
                <span className="relative block h-6 w-11 rounded-full bg-ink-700 transition-colors after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-white after:transition-transform after:content-[''] peer-checked:bg-emerald-500 peer-checked:after:translate-x-5 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-white" aria-hidden="true" />
              </label>
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-2">
          <p className="m-0 text-[11px] tracking-[0.22em] text-ink-450 uppercase">{copy.tableTitle}</p>
          <CookieTable copy={copy} />
        </div>

        {/* Stays at the bottom of the dialog while the list above scrolls, so the choices are always in reach */}
        <div className="sticky bottom-0 -mx-6 -mb-6 flex flex-col gap-3 border-t border-solid border-ink-800 bg-ink-950 px-6 py-4 md:-mx-8 md:-mb-8 md:flex-row md:justify-end md:px-8">
          <button type="button" className={choiceButton} onClick={() => choose(NONE)}>
            {copy.rejectAll}
          </button>
          <button type="button" className={choiceButton} onClick={() => choose(ALL)}>
            {copy.acceptAll}
          </button>
          <button type="button" className={primaryButton} onClick={() => choose(draft)}>
            {copy.save}
          </button>
        </div>
      </div>
    </dialog>
  );
}
