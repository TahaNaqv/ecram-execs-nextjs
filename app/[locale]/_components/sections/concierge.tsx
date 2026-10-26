import { ConciergeChat } from "../concierge-chat";
import { currentLocale, getDict } from "@/lib/i18n/get-dictionary";
import { localizedPath } from "@/lib/i18n/pathnames";

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
  };
  return (
    <section className="border-b border-b-ink-850">
      <div className="py-12 px-5 my-0 mx-auto gap-12 items-center flex flex-wrap max-w-[1280px] md:py-16 md:px-6 xl:gap-20 2xl:max-w-[1440px]">
        <div className="gap-6 flex-[1_1_380px] flex flex-col min-w-0">
          <span className="reveal text-ink-450 font-display text-[12px] tracking-[0.3em] md:tracking-[0.42em]">
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
        <div className="border border-ink-750 flex-[1_1_100%] bg-ink-900 flex flex-col max-w-none min-w-0 xl:flex-[1_1_440px] xl:max-w-[520px]">
          <div className="py-[18px] px-[22px] border-b border-b-ink-800 items-center flex justify-between">
            <div className="flex flex-col">
              <span className="text-white font-display text-[13px] tracking-[0.3em]">
                {d.conciergeSection.panelTitle}
              </span>
              <span className="text-ink-450 text-[12px]">
                {d.conciergeSection.panelSubtitle}
              </span>
            </div>
            <span className="live rounded-full bg-ink-150 h-2 w-2"></span>
          </div>
          <ConciergeChat copy={t} locale={locale} card={card} privacyHref={localizedPath("/privacy", locale)} />
        </div>
      </div>
    </section>
  );
}
