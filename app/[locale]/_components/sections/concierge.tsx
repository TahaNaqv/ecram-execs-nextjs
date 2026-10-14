import { ConciergeInput } from "../concierge-input";
import { getDict } from "@/lib/i18n/get-dictionary";

const FAQ_COUNT = 13;

export async function Concierge() {
  const d = await getDict();
  const t = d.conciergeSection;
  // Questions and answers live in the dictionary as faq1Q/faq1A … faq13Q/faq13A.
  const strings = t as Record<string, string>;
  const faqs = Array.from({ length: FAQ_COUNT }, (_, i) => [strings[`faq${i + 1}Q`], strings[`faq${i + 1}A`]] as const);
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
          <div className="max-h-[480px] overflow-y-auto" role="group" aria-label={t.faqLabel}>
            {faqs.map(([question, answer]) => (
              <details key={question} className="group border-b border-b-ink-800 last:border-b-0">
                <summary className="py-4 px-4 gap-4 items-center flex cursor-pointer justify-between list-none text-ink-150 text-[14px] md:px-[22px] [&::-webkit-details-marker]:hidden">
                  <span>{question}</span>
                  <svg className="shrink-0 transition-transform duration-300 group-open:rotate-45" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                    <path d="M12 5v14M5 12h14"></path>
                  </svg>
                </summary>
                <p className="m-0 pb-5 px-4 text-ink-400 text-[14px] font-light md:px-[22px]">
                  {answer}
                </p>
              </details>
            ))}
          </div>
          <ConciergeInput copy={t} faqs={faqs} />
        </div>
      </div>
    </section>
  );
}
