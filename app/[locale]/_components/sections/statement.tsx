import { getDict } from "@/lib/i18n/get-dictionary";

export async function Statement() {
  const d = await getDict();
  return (
    <section className="border-b border-b-ink-850">
      <div className="py-12 px-5 my-0 mx-auto gap-8 items-center flex flex-col max-w-[1080px] text-center md:py-16 md:px-6">
        <span className="reveal text-white/80 font-display text-[12px] tracking-[0.3em] md:tracking-[0.42em]">
          {d.statement.eyebrow}
        </span>
        <p className="reveal m-0 text-ink-50 font-serif text-[clamp(30px,3.6vw,50px)] font-light leading-[1.22]">
          {d.statement.before}{" "}
          <em className="chrome italic">
            {d.statement.emphasis}
          </em>
          {" "}{d.statement.after}
        </p>
        <div className="bg-ink-450 h-px w-16"></div>
      </div>
    </section>
  );
}
