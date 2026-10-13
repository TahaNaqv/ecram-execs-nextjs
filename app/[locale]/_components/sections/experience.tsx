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
      </div>
    </section>
  );
}
