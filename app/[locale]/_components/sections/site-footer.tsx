import { cacheLife } from "next/cache";
import { currentLocale } from "@/lib/i18n/get-dictionary";
import { localizedPath } from "@/lib/i18n/pathnames";
import { getDict } from "@/lib/i18n/get-dictionary";
import Link from "next/link";
import { siteConfig, socialLinks, telHref } from "@/lib/site-config";

async function CopyrightYear() {
  "use cache";
  cacheLife("days");
  return new Date().getFullYear();
}

export async function SiteFooter() {
  const [locale, d] = await Promise.all([currentLocale(), getDict()]);
  // Anchors have to carry the locale prefix, or `/` would redirect the visitor out of it.
  const home = localizedPath("/", locale);
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
              {d.nav.tagline}
            </span>
            <p className="mx-0 mt-3 mb-0 text-ink-450 text-[14px] font-light">
              {d.footer.blurb}
            </p>
          </div>
          <div className="flex-[0_1_100%] gap-x-5 grid grid-cols-[1fr_1fr] gap-y-8 md:gap-10 md:flex-[0_1_640px] md:grid-cols-[repeat(auto-fit,minmax(160px,1fr))]">
            <nav className="gap-[10px] flex flex-col text-[14px]" aria-label={d.footer.servicesLabel}>
              <span className="text-ink-450 text-[11px] tracking-[0.24em]">
                {d.footer.servicesLabel}
              </span>
              <Link className="navlink" href={`${home}#services`}>
                {d.footer.linkAirport}
              </Link>
              <Link className="navlink" href={`${home}#services`}>
                {d.footer.linkBusiness}
              </Link>
              <Link className="navlink" href={`${home}#corporate`}>
                {d.footer.linkCorporate}
              </Link>
              <Link className="navlink" href={`${home}#services`}>
                {d.footer.linkPrivate}
              </Link>
              <Link className="navlink" href={`${home}#bespoke`}>
                {d.footer.linkBespoke}
              </Link>
            </nav>
            <nav className="gap-[10px] flex flex-col text-[14px]" aria-label={d.footer.companyLabel}>
              <span className="text-ink-450 text-[11px] tracking-[0.24em]">
                {d.footer.companyLabel}
              </span>
              <Link className="navlink" href={`${home}#experience`}>
                {d.footer.linkExperience}
              </Link>
              <Link className="navlink" href={`${home}#fleet`}>
                {d.footer.linkElectricFleet}
              </Link>
              <Link className="navlink" href={`${home}#netherlands`}>
                {d.footer.linkDestinations}
              </Link>
              <Link className="navlink" href={`${home}#enquire`}>
                {d.footer.linkContact}
              </Link>
              <Link className="navlink" href={localizedPath("/drive-with-us", locale)}>
                {d.footer.linkDriveWithUs}
              </Link>
            </nav>
            <div className="gap-[10px] col-[1/-1] text-ink-250 flex flex-col text-[14px] md:col-auto">
              <span className="text-ink-450 text-[11px] tracking-[0.24em]">
                {d.footer.contactLabel}
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
              <span>{siteConfig.contact.address ? `${siteConfig.contact.address}, Netherlands` : d.footer.serving}</span>
              <Link className="navlink self-start" href={`${home}#enquire`}>
                {d.common.requestQuote}
              </Link>
            </div>
          </div>
        </div>
        <div className="pt-7 gap-5 border-t border-t-ink-850 items-start text-ink-500 flex flex-col flex-wrap text-[12px] justify-between md:items-center md:flex-row">
          <span>
            © <CopyrightYear /> Ecram Execs{siteConfig.kvk && ` · KvK ${siteConfig.kvk}`} ·{" "}
            <Link className="text-inherit" href={localizedPath("/privacy", locale)}>
              {d.footer.privacy}
            </Link>
          </span>
          <nav className="gap-6 flex flex-wrap text-[11px] tracking-[0.24em] uppercase" aria-label={d.footer.socialLabel}>
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
