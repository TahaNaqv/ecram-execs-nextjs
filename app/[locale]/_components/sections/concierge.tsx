import { ConciergeInput } from "../concierge-input";
import { getDict } from "@/lib/i18n/get-dictionary";

export async function Concierge() {
  const d = await getDict();
  return (
    <section className="border-b border-b-ink-850">
      <div className="py-20 px-5 my-0 mx-auto gap-12 items-center flex flex-wrap max-w-[1280px] md:py-30 md:px-6 xl:gap-20 2xl:max-w-[1440px]">
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
          <div className="py-5 px-4 gap-[14px] flex flex-col text-[14px] md:py-6 md:px-[22px]">
            <div className="py-3 px-4 self-end bg-ink-150 text-ink-950 max-w-[80%]">
              {d.conciergeSection.chatGuest1}
            </div>
            <div className="py-3 px-4 border border-ink-750 self-start text-ink-150 max-w-[85%]">
              {d.conciergeSection.chatAgent1}
            </div>
            <div className="py-3 px-4 self-end bg-ink-150 text-ink-950 max-w-[80%]">
              {d.conciergeSection.chatGuest2}
            </div>
            <div className="py-3 px-4 border border-ink-750 self-start text-ink-150 max-w-[85%]">
              {d.conciergeSection.chatAgent2}
            </div>
            <div className="pt-1 self-center text-ink-450 text-[11px] tracking-[0.2em] uppercase">
              {d.conciergeSection.connecting}
            </div>
            <div className="py-3 px-4 gap-3 border border-ink-750 items-center self-start text-ink-450 flex text-[12px]">
              {d.conciergeSection.agent}{" "}
              <span className="typing gap-1 inline-flex" aria-label={d.conciergeSection.isTyping}>
                <span></span>
                <span></span>
                <span></span>
              </span>
            </div>
          </div>
          <ConciergeInput copy={d.conciergeSection} />
        </div>
      </div>
    </section>
  );
}
