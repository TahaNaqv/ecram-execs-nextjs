import Image from "next/image";
import { getDict } from "@/lib/i18n/get-dictionary";
import { siteConfig } from "@/lib/site-config";

/**
 * V — Security & Close Protection, between the services and the statement (the client, 9 Nov 2026; their text). It is
 * offered on request, so the button writes to the enquiries address rather than opening the booking form. The photo is a
 * placeholder, swapped by replacing public/assets/protection-v1.jpg.
 */
export async function Protection() {
  const d = await getDict();
  const p = d.protectionSection;
  const mailto = `mailto:${siteConfig.contact.email}?subject=${encodeURIComponent(p.mailSubject)}`;
  const pillars = [
    { title: p.pillar1Title, text: p.pillar1Text, icon: <path d="M5 16l1.5-5h11L19 16M4 16h16v3H4zM7 19v1M17 19v1M8.5 13.5h.01M15.5 13.5h.01" /> },
    { title: p.pillar2Title, text: p.pillar2Text, icon: <path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6zM9 12l2 2 4-4" /> },
    { title: p.pillar3Title, text: p.pillar3Text, icon: <path d="M9 4L3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4zM9 4v13M15 6.5v13" /> },
    { title: p.pillar4Title, text: p.pillar4Text, icon: <path d="M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3M12 15v2" /> },
  ];
  return (
    <section className="border-b border-b-ink-850" id="protection">
      <div className="mx-auto my-0 flex max-w-[1280px] flex-col gap-10 px-4 py-12 sm:px-6 md:gap-12 md:px-8 md:py-14 lg:py-16 2xl:max-w-[1440px]">
        <div className="grid grid-cols-1 items-center gap-8 md:gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="reveal relative min-w-0 overflow-hidden">
            <Image
              src="/assets/protection-v1.jpg"
              alt={p.imageAlt}
              width={1408}
              height={768}
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="block aspect-[4/3] h-auto w-full object-cover object-[62%_50%] lg:aspect-[5/4]"
            />
          </div>
          <div className="flex min-w-0 flex-col gap-6">
            <span className="reveal text-white/80 font-display text-[12px] tracking-[0.3em] md:tracking-[0.42em]">{p.eyebrow}</span>
            <h2 className="reveal m-0 text-white font-serif text-[clamp(30px,8vw,38px)] font-light leading-[1.1] md:text-[clamp(34px,3.4vw,48px)]">
              {p.heading}
            </h2>
            <p className="reveal m-0 text-ink-150 font-serif text-[19px] italic leading-[1.45] md:text-[21px]">{p.lead}</p>
            <p className="reveal m-0 text-ink-400 font-light">{p.body1}</p>
            <p className="reveal m-0 text-ink-400 font-light">{p.body2}</p>
            <div className="reveal flex flex-col gap-3">
              <a
                className="btn-fill py-0 px-[34px] gap-3 no-underline items-center self-start bg-ink-50 text-ink-950 inline-flex text-[12px] font-semibold tracking-[0.24em] min-h-[52px] uppercase"
                href={mailto}
              >
                {p.cta}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                  <path d="M4 6h16v12H4z" />
                  <path d="M4 7l8 6 8-6" />
                </svg>
              </a>
              <span className="text-ink-400 text-[13px] font-light">{p.note}</span>
            </div>
          </div>
        </div>
        <ul aria-label={p.pillarsLabel} className="m-0 grid list-none grid-cols-1 gap-4 p-0 md:grid-cols-2 md:gap-5 lg:grid-cols-4">
          {pillars.map((pillar) => (
            <li key={pillar.title} className="reveal flex flex-col gap-3 border border-ink-800 px-5 py-7 md:px-6">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="stroke-ink-250" strokeWidth="1.2" aria-hidden="true">
                {pillar.icon}
              </svg>
              <h3 className="m-0 text-white font-display text-[13px] font-normal leading-[1.5] tracking-[0.18em] uppercase">{pillar.title}</h3>
              <p className="m-0 text-ink-400 text-[14px] font-light leading-[1.6]">{pillar.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
