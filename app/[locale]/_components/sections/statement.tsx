import { getDict } from "@/lib/i18n/get-dictionary";

export async function Statement() {
  const d = await getDict();
  return (
    <section className="border-b border-b-ink-850">
      <div className="mx-auto my-0 flex max-w-[1080px] flex-col items-center gap-6 px-4 py-12 text-center sm:px-6 md:px-8 md:py-14 lg:py-16">
        <span className="reveal text-white/80 font-display text-[12px] tracking-[0.3em] md:tracking-[0.42em]">
          {d.statement.eyebrow}
        </span>
        <p className="reveal m-0 text-ink-50 font-serif text-[clamp(30px,3.6vw,50px)] font-light leading-[1.22] not-italic">
          {d.statement.before}{" "}
          <span className="chrome font-normal not-italic">
            {d.statement.emphasis}
          </span>
          {" "}{d.statement.after}
        </p>
        
      </div>
    </section>
  );
}
