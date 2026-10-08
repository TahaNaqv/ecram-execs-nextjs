import Image from "next/image";

export function Hero() {
  return (
    <section className="overflow-hidden flex flex-col justify-center min-h-[calc(-77px_+_100svh)] relative md:min-h-[860px]" id="top">
      <div className="inset-0 overflow-hidden bg-ink-940 absolute">
        <Image className="hero-img inset-0 text-transparent h-full absolute w-full" src="/assets/3b00bbaea002c5bc3c19878670191ab0.jpg" alt="Ecram Execs electric Mercedes van on a Dutch polder road at blue hour" fill priority sizes="100vw" />
        <div className="inset-0 bg-[radial-gradient(at_50%_45%,rgba(10,10,11,0.55)_0%,rgba(10,10,11,0.85)_70%,#0a0a0b_100%)] absolute"></div>
      </div>
      <div className="px-5 pt-12 pb-10 my-0 mx-auto gap-[22px] items-center box-border flex flex-col max-w-[1280px] relative text-center w-full md:px-6 md:pt-20 md:pb-24 md:gap-7 2xl:max-w-[1440px]">
        <div className="emblem max-w-[min(300px,82vw)] md:max-w-[520px]">
          <Image className="block h-auto w-full" src="/assets/ecram-execs-logo-transparent.webp" alt="Ecram Execs luxury chrome emblem with QR code" width={1040} height={416} priority sizes="(max-width: 760px) 82vw, 520px" />
        </div>
        <h1 className="rise d2 mx-0 mt-2 mb-0 text-white font-serif text-[clamp(36px,10.4vw,46px)] font-light tracking-[-0.01em] leading-[1.05] md:text-[clamp(40px,5.4vw,76px)]">
          Every journey is part{" "}
          <br className="hidden md:inline" />
          <em className="chrome-live block italic font-light md:inline">
            of the experience.
          </em>
        </h1>
        <p className="rise d3 m-0 text-ink-300 text-[16px] font-light max-w-[620px] md:text-[17px]">
          Private executive chauffeurs across the Netherlands, in a fully electric fleet. Calm, discreet and effortless — from the moment you are collected to the moment you arrive.
        </p>
        <div className="rise d4 mt-2 gap-3 items-stretch flex flex-col flex-wrap justify-center max-w-[360px] w-full md:gap-4 md:items-stretch md:flex-row md:max-w-none md:w-auto">
          <a className="btn-fill py-0 px-5 no-underline items-center bg-ink-50 text-ink-950 inline-flex text-[12px] font-semibold justify-center tracking-[0.24em] min-h-[52px] uppercase md:py-0 md:px-[34px] md:justify-normal" href="#enquire">
            Request a quotation
          </a>
          {" "}
          <a className="btn-line py-0 px-5 gap-3 border border-ink-700 no-underline items-center text-white inline-flex text-[12px] justify-center tracking-[0.24em] min-h-[52px] uppercase md:py-0 md:px-[30px] md:justify-normal" href="#experience">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M7 4l13 8-13 8z"></path>
            </svg>
            Watch the arrival
          </a>
        </div>
      </div>
      <div className="rise d4 pb-7 gap-3 items-center hidden flex-col relative md:flex">
        <span className="text-ink-450 text-[10px] tracking-[0.3em]">
          SCROLL
        </span>
        <span className="cue" aria-hidden="true"></span>
      </div>
      <div className="border-t border-t-ink-850 relative">
        <div className="p-5 my-0 mx-auto items-center text-ink-450 gap-x-10 flex flex-col flex-wrap font-display text-[10px] justify-center tracking-[0.28em] max-w-[1280px] gap-y-[10px] text-center md:py-[22px] md:px-6 md:text-[12px] md:tracking-[0.38em] md:gap-y-4 md:gap-x-10 md:items-stretch md:flex-row xl:gap-4 xl:justify-between xl:text-start 2xl:max-w-[1440px]">
          <span>
            QUIET · REFINED · ELECTRIC
          </span>
          {" "}
          <span>
            SERVING THE WHOLE OF THE NETHERLANDS
          </span>
          {" "}
          <span>
            AVAILABLE 24 / 7
          </span>
        </div>
      </div>
    </section>
  );
}
