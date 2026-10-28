import Image from "next/image";
import { ConciergeChat } from "../concierge-chat";
import { currentLocale, getDict } from "@/lib/i18n/get-dictionary";
import { localizedPath } from "@/lib/i18n/pathnames";
import { RETENTION } from "@/lib/retention";

export async function Concierge() {
  const [locale, d] = await Promise.all([currentLocale(), getDict()]);
  const t = d.conciergeSection;
  const b = d.booking;
  // The booking form's own words for the card the chat shows when a booking is ready to send
  const card = {
    summaryRoute: b.summaryRoute, summaryWhen: b.summaryWhen, summaryReturn: b.summaryReturn, summaryParty: b.summaryParty, summaryFlight: b.summaryFlight,
    stepCar: b.stepCar, stepDetails: b.stepDetails, noPreference: b.noPreference, passengerName: b.passengerName, notes: b.notes,
    stopLabel: b.stopLabel, waitMinutes: b.waitMinutes, asDirected: b.asDirected, guestOne: b.guestOne, guestMany: b.guestMany,
    bagNone: b.bagNone, bagOne: b.bagOne, bagMany: b.bagMany, privacyNote: b.privacyNote, privacyLink: b.privacyLink,
    seatsUpTo: b.seatsUpTo, carDetails: b.carDetails,
  };
  return (
    <section className="scroll-mt-28 border-b border-b-ink-850" id="concierge">
      <div className="py-12 px-5 my-0 mx-auto gap-12 items-center flex flex-wrap max-w-[1280px] md:py-16 md:px-6 xl:gap-20 2xl:max-w-[1440px]">
        <div className="gap-6 flex-[1_1_380px] flex flex-col min-w-0">
          <span className="reveal text-white/80 font-display text-[12px] tracking-[0.3em] md:tracking-[0.42em]">
            {d.conciergeSection.eyebrow}
          </span>
          <h2 className="reveal m-0 text-white font-serif text-[clamp(32px,8.6vw,40px)] font-light leading-[1.08] md:text-[clamp(36px,4vw,52px)]">
            {d.conciergeSection.headingBefore}{" "}
            <br />
            <em className="chrome italic">
              {d.conciergeSection.headingEmphasis}
            </em>
          </h2>
          <p className="m-0 text-ink-400 font-light">
            {d.conciergeSection.body}
          </p>
          <p className="m-0 text-ink-400 font-light">
            {d.conciergeSection.body2}
          </p>
        </div>
        {/* The frame is a 2px silver line with a soft glow around it, so the chat cannot be missed; the panel inside is a shade lighter than the page */}
        <div
          id="concierge-chat"
          className="scroll-mt-28 flex max-w-none min-w-0 flex-[1_1_100%] flex-col rounded-[26px] bg-[linear-gradient(145deg,rgba(255,255,255,0.95),rgba(143,166,232,0.55)_40%,rgba(255,255,255,0.9))] p-[2px] shadow-[0_0_0_6px_rgba(255,255,255,0.05),0_0_70px_-12px_rgba(120,150,255,0.55),0_30px_60px_-20px_rgba(0,0,0,0.6)] xl:max-w-[540px] xl:flex-[1_1_460px]"
        >
          <div className="flex flex-1 flex-col overflow-hidden rounded-3xl bg-ink-900">
            <div className="flex items-center justify-between gap-4 border-b border-b-ink-600 bg-[linear-gradient(180deg,var(--color-ink-800),var(--color-ink-900))] px-[22px] py-4">
              <div className="flex items-center gap-3.5">
                <span className="relative grid size-12 shrink-0 place-items-center rounded-full border border-solid border-ink-400 bg-ink-950">
                  <Image src="/assets/logo-mark.png" alt="" width={48} height={48} className="size-9" />
                  <span className="live absolute right-0 bottom-0 size-3 rounded-full border-2 border-solid border-ink-800 bg-[#25D366]" aria-hidden="true"></span>
                </span>
                <div className="flex flex-col">
                  <span className="font-display text-[13px] tracking-[0.3em] text-white">{d.conciergeSection.panelTitle}</span>
                  <span className="text-[12px] text-ink-300">{d.conciergeSection.panelSubtitle}</span>
                </div>
              </div>
            </div>
            <ConciergeChat copy={t} locale={locale} card={card} fleetDict={d.fleetSection} privacyHref={localizedPath("/privacy", locale)} keepDays={RETENTION.chatDays} />
          </div>
        </div>
      </div>
    </section>
  );
}
