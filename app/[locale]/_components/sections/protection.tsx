import Image from "next/image";
import { getDict } from "@/lib/i18n/get-dictionary";
import { siteConfig } from "@/lib/site-config";

/**
 * V — Security & Close Protection, between the services and the statement (the client, 9 Nov 2026; their text). It is
 * offered on request, so the button writes to the enquiries address rather than opening the booking form. After the client's
 * feedback of 10 Nov 2026 the title sits above, styled like the services section, and the photo (AI-generated, showing a
 * close protection officer rather than a driver) sits beside the text. The photo became a daylight scene on an
 * Amsterdam canal with the fleet's Cadillac Escalade IQ on a Dutch plate (the client's reference, 10 Nov 2026).
 */
const IMAGE_WIDTH = 1600;
const IMAGE_HEIGHT = 1600;
export async function Protection() {
  const d = await getDict();
  const p = d.protectionSection;
  const mailto = `mailto:${siteConfig.contact.email}?subject=${encodeURIComponent(p.mailSubject)}`;
  const pillars = [
    { title: p.pillar1Title, icon: <path d="M5 16l1.5-5h11L19 16M4 16h16v3H4zM7 19v1M17 19v1M8.5 13.5h.01M15.5 13.5h.01" /> },
    { title: p.pillar2Title, icon: <path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6zM9 12l2 2 4-4" /> },
    { title: p.pillar3Title, icon: <path d="M9 4L3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4zM9 4v13M15 6.5v13" /> },
    { title: p.pillar4Title, icon: <path d="M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3M12 15v2" /> },
  ];
  return (
    <section className="border-b border-b-ink-850" id="protection">
      <div className="mx-auto my-0 flex max-w-[1280px] flex-col gap-10 px-4 py-12 sm:px-6 md:gap-12 md:px-8 md:py-14 lg:py-16 2xl:max-w-[1440px]">
        {/* The title block matches the services section's: centred eyebrow and heading, then the lead (the client, 10 Nov 2026) */}
        <div className="flex flex-col items-center text-center">
          <div className="gap-4 flex flex-col max-w-[760px]">
            <span className="reveal text-white/80 font-display text-[12px] tracking-[0.3em] md:tracking-[0.42em]">{p.eyebrow}</span>
            <h2 className="reveal m-0 text-white font-serif text-[clamp(32px,8.6vw,40px)] font-light leading-[1.08] md:text-[clamp(36px,4vw,56px)]">
              {p.heading}
            </h2>
            <p className="reveal m-0 text-ink-150 font-serif text-[19px] italic leading-[1.45] md:text-[21px]">{p.lead}</p>
          </div>
        </div>
        {/* Text on the left, its top level with the photo's, then the four services as short bullets and the button under
            them, so the column ends with the photo (the client, 10 Nov 2026). On lg the photo is absolutely placed so the text alone
            sets the row height and the photo fills it. On a phone the photo comes first, under the title. */}
        <div className="grid grid-cols-1 gap-8 md:gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="reveal relative min-w-0 overflow-hidden lg:order-2 lg:min-h-[420px]">
            <Image
              src="/assets/protection-v3.jpg"
              alt={p.imageAlt}
              width={IMAGE_WIDTH}
              height={IMAGE_HEIGHT}
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="block aspect-[4/3] h-auto w-full object-cover object-[50%_70%] lg:absolute lg:inset-0 lg:h-full lg:w-full lg:object-[40%_50%]"
            />
          </div>
          <div className="flex min-w-0 flex-col gap-6 lg:order-1">
            <p className="reveal m-0 text-ink-400 font-light">{p.body1}</p>
            <p className="reveal m-0 text-ink-400 font-light">{p.body2}</p>
            <ul role="list" aria-label={p.pillarsLabel} className="reveal m-0 flex list-none flex-col gap-3 p-0">
              {pillars.map((pillar) => (
                <li key={pillar.title} className="flex items-center gap-3">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="shrink-0 stroke-ink-250" strokeWidth="1.3" aria-hidden="true">
                    {pillar.icon}
                  </svg>
                  <span className="text-white font-display text-[12px] leading-[1.5] tracking-[0.18em] uppercase">{pillar.title}</span>
                </li>
              ))}
            </ul>
            <div className="reveal flex flex-col gap-3 pt-2">
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
      </div>
    </section>
  );
}
