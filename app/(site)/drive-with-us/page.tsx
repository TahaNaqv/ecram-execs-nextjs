import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import Link from "next/link";
import { amsterdamToday, APPROVED_MODELS_BY_MAKE, criteriaText } from "@/lib/partners/criteria";
import { storageConfigured } from "@/lib/storage";
import { ApplicationForm } from "../_components/application-form";
import { SiteFooter } from "../_components/sections";

export const metadata: Metadata = {
  title: "Drive with us — Ecram Execs",
  description:
    "Independent chauffeur with your own fully electric luxury car? Apply to join the Ecram Execs platform — we check your car against our criteria instantly.",
  alternates: { canonical: "/drive-with-us" },
};

const STEPS = [
  ["Apply", "Enter your licence plate and details, and upload your documents. We check your car against the RDW register instantly."],
  ["Meet the team", "We arrange a short introduction and inspect your car and documents in person."],
  ["Start driving", "Once approved you join our platform and receive executive journeys across the Netherlands."],
] as const;

/** The age rule names a year, so the list is cached for a day rather than fixed at build time. */
async function Criteria() {
  "use cache";
  cacheLife("days");
  return (
    <ul className="m-0 flex list-none flex-col p-0">
      {criteriaText(amsterdamToday()).map((c) => (
        <li key={c} className="flex gap-4 border-t border-ink-800 py-3.5 text-[14px] text-ink-150 first:border-t-0">
          <span aria-hidden="true" className="mt-[9px] size-[5px] shrink-0 rotate-45 bg-ink-300" />
          {c}
        </li>
      ))}
    </ul>
  );
}

export default function DriveWithUsPage() {
  return (
    <div className="min-h-svh bg-ink-950 font-sans leading-[1.6] text-ink-150">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="border-b border-ink-850">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-5 py-[22px] md:px-6 2xl:max-w-[1440px]">
          <Link href="/" className="chrome font-display text-[18px] tracking-[0.26em] no-underline md:text-[22px] md:tracking-[0.32em]">
            ECRAM EXECS
          </Link>
          <Link
            href="/#enquire"
            className="inline-flex min-h-[44px] items-center border border-ink-250 px-[22px] text-[11px] tracking-[0.24em] text-white uppercase no-underline"
          >
            <span className="md:hidden">Book</span>
            <span className="hidden md:inline">Request a quotation</span>
          </Link>
        </div>
      </header>

      <main id="main">
        <section className="border-b border-ink-850">
          <div className="mx-auto flex max-w-[1280px] flex-wrap gap-12 px-5 pt-16 pb-20 md:px-6 md:pt-24 md:pb-28 2xl:max-w-[1440px]">
            <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-6">
              <span className="font-display text-[12px] tracking-[0.3em] text-ink-450 md:tracking-[0.42em]">DRIVE WITH US</span>
              <h1 className="m-0 font-serif text-[clamp(36px,8.6vw,40px)] leading-[1.05] font-light text-white md:text-[clamp(40px,5vw,68px)]">
                Your car. <br />
                <em className="chrome italic">Our clients.</em>
              </h1>
              <p className="m-0 max-w-[520px] font-light text-ink-400">
                Are you an independent chauffeur with your own executive electric car? Join the Ecram Execs platform and drive for
                discerning business and private clients across the Netherlands — on your own schedule, with your own car.
              </p>
              <ol className="m-0 mt-4 flex list-none flex-col border-b border-ink-800 p-0">
                {STEPS.map(([title, text], i) => (
                  <li key={title} className="flex gap-5 border-t border-ink-800 py-5">
                    <span className="font-display text-[12px] tracking-[0.3em] text-ink-450">0{i + 1}</span>
                    <div>
                      <p className="m-0 text-[15px] text-white">{title}</p>
                      <p className="m-0 mt-1 text-[14px] font-light text-ink-400">{text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-6 self-start border border-ink-800 bg-ink-900 p-6 md:p-10">
              <span className="font-display text-[12px] tracking-[0.3em] text-ink-450 md:tracking-[0.42em]">THE CRITERIA</span>
              <h2 className="m-0 font-serif text-[30px] leading-[1.1] font-light text-white">What we ask of your car and of you</h2>
              <Criteria />
              <div className="flex flex-col gap-3">
                <span className="font-display text-[12px] tracking-[0.3em] text-ink-450">APPROVED MODELS</span>
                <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-5 gap-y-2 text-[14px]">
                  {APPROVED_MODELS_BY_MAKE.map(({ make, models }) => (
                    <div key={make} className="contents">
                      <dt className="text-ink-450">{make}</dt>
                      <dd className="m-0 text-ink-150">{models}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <p className="m-0 text-[13px] text-ink-450">
                With your application you upload your chauffeur card (chauffeurskaart / taxipas), a KvK extract, a VOG (profile 70) and
                proof of insurance for paid passenger transport. You will also need a Kiwa taxi transport licence. We check the originals in
                person before you start.
              </p>
            </div>
          </div>
        </section>

        <section className="bg-ink-50 text-ink-950" id="apply">
          <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-5 py-12 md:px-6 md:py-16 2xl:max-w-[1440px]">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="m-0 font-serif text-[30px] leading-[1.1] font-normal md:text-[34px]">Apply to join</h2>
              <p className="m-0 text-[14px] text-ink-600">Takes about two minutes.</p>
            </div>
            <ApplicationForm documents={storageConfigured()} />
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
