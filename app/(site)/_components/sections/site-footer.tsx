import { cacheLife } from "next/cache";
import { siteConfig, socialLinks, telHref } from "@/lib/site-config";

async function CopyrightYear() {
  "use cache";
  cacheLife("days");
  return new Date().getFullYear();
}

export function SiteFooter() {
  return (
    <footer className="border-t border-t-ink-850 bg-ink-975">
      <div className="px-5 pt-14 pb-8 my-0 mx-auto gap-10 flex flex-col max-w-[1280px] md:px-6 md:pt-18 md:pb-10 md:gap-14 2xl:max-w-[1440px]">
        <div className="gap-12 flex flex-wrap justify-between">
          <div className="gap-[10px] flex flex-col max-w-[360px]">
            <span className="chrome font-display text-[22px] font-medium tracking-[0.32em] md:text-[26px]">
              ECRAM EXECS
            </span>
            {" "}
            <span className="text-ink-450 font-display text-[10px] tracking-[0.3em] md:tracking-[0.42em]">
              THE ART OF EXECUTIVE HOSPITALITY
            </span>
            <p className="mx-0 mt-3 mb-0 text-ink-450 text-[14px] font-light">
              Executive chauffeur services throughout the Netherlands, in a fully electric fleet.
            </p>
          </div>
          <div className="flex-[0_1_100%] gap-x-5 grid grid-cols-[1fr_1fr] gap-y-8 md:gap-10 md:flex-[0_1_640px] md:grid-cols-[repeat(auto-fit,minmax(160px,1fr))]">
            <nav className="gap-[10px] flex flex-col text-[14px]" aria-label="Services">
              <span className="text-ink-450 text-[11px] tracking-[0.24em]">
                SERVICES
              </span>
              <a className="navlink" href="#services">
                Airport transfers
              </a>
              <a className="navlink" href="#services">
                Business travel
              </a>
              <a className="navlink" href="#corporate">
                Corporate accounts
              </a>
              <a className="navlink" href="#services">
                Private occasions
              </a>
            </nav>
            <nav className="gap-[10px] flex flex-col text-[14px]" aria-label="Company">
              <span className="text-ink-450 text-[11px] tracking-[0.24em]">
                COMPANY
              </span>
              <a className="navlink" href="#experience">
                The experience
              </a>
              <a className="navlink" href="#fleet">
                Electric fleet
              </a>
              <a className="navlink" href="#netherlands">
                Destinations
              </a>
              <a className="navlink" href="#enquire">
                Contact
              </a>
            </nav>
            <div className="gap-[10px] col-[1/-1] text-ink-250 flex flex-col text-[14px] md:col-auto">
              <span className="text-ink-450 text-[11px] tracking-[0.24em]">
                CONTACT
              </span>
              {siteConfig.contact.phone && (
                <a className="navlink self-start" href={telHref(siteConfig.contact.phone)}>
                  {siteConfig.contact.phone}
                </a>
              )}
              {siteConfig.contact.email && (
                <a className="navlink self-start" href={`mailto:${siteConfig.contact.email}`}>
                  {siteConfig.contact.email}
                </a>
              )}
              <span>{siteConfig.contact.address ? `${siteConfig.contact.address}, Netherlands` : "Serving the whole of the Netherlands"}</span>
              <a className="navlink self-start" href="#enquire">
                Request a quotation
              </a>
            </div>
          </div>
        </div>
        <div className="pt-7 gap-5 border-t border-t-ink-850 items-start text-ink-500 flex flex-col flex-wrap text-[12px] justify-between md:items-center md:flex-row">
          <span>
            © <CopyrightYear /> Ecram Execs{siteConfig.kvk && ` · KvK ${siteConfig.kvk}`} ·{" "}
            <a className="text-inherit" href="/privacy">
              Privacy
            </a>
          </span>
          <nav className="gap-6 flex flex-wrap text-[11px] tracking-[0.24em] uppercase" aria-label="Social">
            {socialLinks.map(([label, url]) => (
              <a className="navlink" key={label} href={url} {...(url.startsWith("http") && { target: "_blank", rel: "noopener noreferrer" })}>
                {label}
              </a>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
