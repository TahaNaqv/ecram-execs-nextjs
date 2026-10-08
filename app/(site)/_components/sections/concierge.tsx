import { ConciergeInput } from "../concierge-input";

export function Concierge() {
  return (
    <section className="border-b border-b-ink-850">
      <div className="py-20 px-5 my-0 mx-auto gap-12 items-center flex flex-wrap max-w-[1280px] md:py-30 md:px-6 xl:gap-20 2xl:max-w-[1440px]">
        <div className="gap-6 flex-[1_1_380px] flex flex-col min-w-0">
          <span className="reveal text-ink-450 font-display text-[12px] tracking-[0.3em] md:tracking-[0.42em]">
            VII — ECRAM CONCIERGE
          </span>
          <h2 className="reveal m-0 text-white font-serif text-[clamp(32px,8.6vw,40px)] font-light leading-[1.08] md:text-[clamp(36px,4vw,52px)]">
            Immediate answers.{" "}
            <br />
            <em className="chrome italic">
              A personal touch, always.
            </em>
          </h2>
          <p className="m-0 text-ink-400 font-light">
            Our digital concierge answers questions, explains our services and begins your quotation at any hour. When a request deserves a personal conversation, it hands you to a member of our team — seamlessly.
          </p>
        </div>
        <div className="border border-ink-750 flex-[1_1_100%] bg-ink-900 flex flex-col max-w-none min-w-0 xl:flex-[1_1_440px] xl:max-w-[520px]">
          <div className="py-[18px] px-[22px] border-b border-b-ink-800 items-center flex justify-between">
            <div className="flex flex-col">
              <span className="text-white font-display text-[13px] tracking-[0.3em]">
                ECRAM CONCIERGE
              </span>
              <span className="text-ink-450 text-[12px]">
                Replies instantly · Team on hand 24/7
              </span>
            </div>
            <span className="live rounded-full bg-ink-150 h-2 w-2"></span>
          </div>
          <div className="py-5 px-4 gap-[14px] flex flex-col text-[14px] md:py-6 md:px-[22px]">
            <div className="py-3 px-4 self-end bg-ink-150 text-ink-950 max-w-[80%]">
              I land at Schiphol on Thursday at 07:40 and need to be in Eindhoven by 10:00.
            </div>
            <div className="py-3 px-4 border border-ink-750 self-start text-ink-150 max-w-[85%]">
              Certainly. Your chauffeur will track your flight and meet you in arrivals. May I ask how many passengers, and roughly how much luggage?
            </div>
            <div className="py-3 px-4 self-end bg-ink-150 text-ink-950 max-w-[80%]">
              Two of us, two cases. Can the car wait and bring us back in the evening?
            </div>
            <div className="py-3 px-4 border border-ink-750 self-start text-ink-150 max-w-[85%]">
              Of course. For a return with waiting time, I&apos;ll pass you to our reservations team for a tailored quotation — they&apos;ll reply shortly.
            </div>
            <div className="pt-1 self-center text-ink-450 text-[11px] tracking-[0.2em] uppercase">
              — Connecting you with our team —
            </div>
            <div className="py-3 px-4 gap-3 border border-ink-750 items-center self-start text-ink-450 flex text-[12px]">
              Sophie, reservations{" "}
              <span className="typing gap-1 inline-flex" aria-label="is typing">
                <span></span>
                <span></span>
                <span></span>
              </span>
            </div>
          </div>
          <ConciergeInput />
        </div>
      </div>
    </section>
  );
}
