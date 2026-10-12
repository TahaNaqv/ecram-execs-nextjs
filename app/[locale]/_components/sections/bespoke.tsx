import { currentLocale, getDict } from "@/lib/i18n/get-dictionary";
import { BespokeForm } from "../bespoke-form";

export async function Bespoke() {
  const [locale, d] = await Promise.all([currentLocale(), getDict()]);
  const t = d.bespokeSection;
  const cases = [
    [t.caseDelegationsTitle, t.caseDelegationsText],
    [t.caseDiplomaticTitle, t.caseDiplomaticText],
    [t.caseRoadshowsTitle, t.caseRoadshowsText],
  ];
  return (
    <section className="border-b border-b-ink-850" id="bespoke">
      <div className="py-20 px-5 my-0 mx-auto gap-12 flex flex-col max-w-[1280px] md:py-30 md:px-6 md:gap-14 2xl:max-w-[1440px]">
        <div className="gap-6 items-end flex flex-wrap justify-between">
          <div className="gap-4 flex flex-col max-w-[640px]">
            <span className="reveal text-ink-450 font-display text-[12px] tracking-[0.3em] md:tracking-[0.42em]">
              {t.eyebrow}
            </span>
            <h2 className="reveal m-0 text-white font-serif text-[clamp(32px,8.6vw,40px)] font-light leading-[1.08] md:text-[clamp(36px,4vw,56px)]">
              {t.headingBefore}{" "}
              <br />
              <em className="chrome italic">
                {t.headingEmphasis}
              </em>
            </h2>
          </div>
          <p className="m-0 text-ink-400 font-light max-w-[460px]">
            {t.body}
          </p>
        </div>

        <ul className="gap-px p-0 m-0 border border-ink-800 bg-ink-800 list-none grid grid-cols-1 md:grid-cols-3">
          {cases.map(([title, text]) => (
            <li key={title} className="p-6 gap-3 bg-ink-950 flex flex-col md:p-8">
              <h3 className="m-0 text-white font-serif text-[22px] font-light">
                {title}
              </h3>
              <p className="m-0 text-ink-400 text-[14px] font-light">
                {text}
              </p>
            </li>
          ))}
        </ul>

        <div className="p-6 gap-6 bg-ink-50 text-ink-950 flex flex-col md:p-10" id="bespoke-inquiry">
          <div className="gap-3 items-baseline flex flex-wrap justify-between">
            <h3 className="m-0 font-serif text-[30px] font-normal leading-[1.1] md:text-[34px]">
              {t.formHeading}
            </h3>
            <p className="m-0 text-ink-600 text-[14px]">
              {t.formNote}
            </p>
          </div>
          <BespokeForm locale={locale} copy={t} />
        </div>
      </div>
    </section>
  );
}
