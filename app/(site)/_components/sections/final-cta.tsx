import { siteConfig, telHref } from "@/lib/site-config";

export function FinalCta() {
  return (
    <section className="relative">
      <div className="py-20 px-5 my-0 mx-auto gap-7 items-center flex flex-col max-w-[1080px] text-center md:py-40 md:px-6">
        <span className="reveal text-ink-450 font-display text-[12px] tracking-[0.3em] md:tracking-[0.42em]">
          TAILORED TO YOUR JOURNEY
        </span>
        <h2 className="m-0 text-white font-serif text-[clamp(32px,8.6vw,40px)] font-light leading-[1.05] md:text-[clamp(40px,5vw,72px)]">
          Allow us to take care{" "}
          <br />
          <em className="chrome italic">
            of the rest.
          </em>
        </h2>
        <p className="m-0 text-ink-400 font-light max-w-[540px]">
          Every journey is different, so every quotation is personal. Tell us where, when and how — we will respond promptly.
        </p>
        <div className="gap-3 items-stretch flex flex-col flex-wrap justify-center max-w-[360px] w-full md:gap-4 md:items-stretch md:flex-row md:max-w-none md:w-auto">
          <a className="btn-fill py-0 px-5 no-underline items-center bg-ink-50 text-ink-950 inline-flex text-[12px] font-semibold justify-center tracking-[0.24em] min-h-[52px] uppercase md:py-0 md:px-[34px] md:justify-normal" href="#enquire">
            Request a quotation
          </a>
          {siteConfig.contact.phone && (
          <a className="btn-line py-0 px-5 border border-ink-700 no-underline items-center text-white inline-flex text-[12px] justify-center tracking-[0.24em] min-h-[52px] uppercase md:py-0 md:px-[30px] md:justify-normal" href={telHref(siteConfig.contact.phone)}>
            Call {siteConfig.contact.phone}
          </a>
          )}
        </div>
      </div>
    </section>
  );
}
