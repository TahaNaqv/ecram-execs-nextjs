import { BrandFilm } from "../brand-film";
import { getDict } from "@/lib/i18n/get-dictionary";

export async function Experience() {
  const d = await getDict();
  return (
    <section className="border-b border-b-ink-850" id="experience">
      <div className="py-20 px-5 my-0 mx-auto gap-10 flex flex-col max-w-[1280px] md:py-30 md:px-6 md:gap-14 2xl:max-w-[1440px]">
        <div className="gap-4 items-center flex flex-col text-center">
          <span className="reveal text-ink-450 font-display text-[12px] tracking-[0.3em] md:tracking-[0.42em]">
            {d.experienceSection.eyebrow}
          </span>
          <h2 className="reveal m-0 text-white font-serif text-[clamp(32px,8.6vw,40px)] font-light leading-[1.08] md:text-[clamp(36px,4vw,56px)]">
            {d.experienceSection.heading}
          </h2>
        </div>
        <BrandFilm copy={d.film} />
        <ol className="p-0 m-0 gap-6 list-none grid grid-cols-[1fr] md:gap-8 md:grid-cols-[repeat(2,minmax(0px,1fr))] lg:grid-cols-[repeat(5,minmax(0px,1fr))]">
          <li className="reveal pt-5 gap-[10px] border-t border-t-ink-700 flex flex-col">
            <span className="text-ink-450 font-display text-[12px] tracking-[0.3em]">
              01
            </span>
            <span className="text-white font-serif text-[24px]">
              {d.experienceSection.step1Title}
            </span>
            <span className="text-ink-400 text-[14px] font-light">
              {d.experienceSection.step1Text}
            </span>
          </li>
          <li className="reveal pt-5 gap-[10px] border-t border-t-ink-700 flex flex-col">
            <span className="text-ink-450 font-display text-[12px] tracking-[0.3em]">
              02
            </span>
            <span className="text-white font-serif text-[24px]">
              {d.experienceSection.step2Title}
            </span>
            <span className="text-ink-400 text-[14px] font-light">
              {d.experienceSection.step2Text}
            </span>
          </li>
          <li className="reveal pt-5 gap-[10px] border-t border-t-ink-700 flex flex-col">
            <span className="text-ink-450 font-display text-[12px] tracking-[0.3em]">
              03
            </span>
            <span className="text-white font-serif text-[24px]">
              {d.experienceSection.step3Title}
            </span>
            <span className="text-ink-400 text-[14px] font-light">
              {d.experienceSection.step3Text}
            </span>
          </li>
          <li className="reveal pt-5 gap-[10px] border-t border-t-ink-700 flex flex-col">
            <span className="text-ink-450 font-display text-[12px] tracking-[0.3em]">
              04
            </span>
            <span className="text-white font-serif text-[24px]">
              {d.experienceSection.step4Title}
            </span>
            <span className="text-ink-400 text-[14px] font-light">
              {d.experienceSection.step4Text}
            </span>
          </li>
          <li className="reveal pt-5 gap-[10px] border-t border-t-ink-700 col-[1/-1] flex flex-col lg:col-auto">
            <span className="text-ink-450 font-display text-[12px] tracking-[0.3em]">
              05
            </span>
            <span className="text-white font-serif text-[24px]">
              {d.experienceSection.step5Title}
            </span>
            <span className="text-ink-400 text-[14px] font-light">
              {d.experienceSection.step5Text}
            </span>
          </li>
        </ol>
      </div>
    </section>
  );
}
