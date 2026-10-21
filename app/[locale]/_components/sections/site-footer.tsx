import Image from "next/image";
import { cacheLife } from "next/cache";
import { currentLocale } from "@/lib/i18n/get-dictionary";
import { localizedPath } from "@/lib/i18n/pathnames";
import { getDict } from "@/lib/i18n/get-dictionary";
import Link from "next/link";
import { siteConfig, socialLinks, telHref } from "@/lib/site-config";
import { SocialIcon } from "../social-icons";

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
      <div className="px-5 pt-14 pb-10 my-0 mx-auto gap-10 flex flex-col max-w-[1280px] md:px-6 md:pt-18 md:pb-10 md:gap-14 2xl:max-w-[1440px]">
        <div className="gap-12 flex flex-wrap justify-between">
          <div className="gap-[10px] items-center flex flex-col max-w-[360px] text-center">
            <Image className="h-auto w-full max-w-[300px]" src="/assets/logo.png" alt={d.footer.logoAlt} width={1584} height={865} sizes="300px" />
            <p className="mx-0 mt-3 mb-0 text-ink-450 text-[14px] font-light text-center">
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
              <Link className="navlink" href={`${home}#enquire`}>
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
              {siteConfig.contact.address && <span>{`${siteConfig.contact.address}, Netherlands`}</span>}
              <Link className="navlink self-start" href={`${home}#enquire`}>
                {d.common.requestQuote}
              </Link>
            </div>
          </div>
        </div>
      </div>
      <div className="light-surface bg-white text-ink-600">
        <div className="px-5 pt-6 pb-20 my-0 mx-auto gap-5 items-start flex flex-col flex-wrap text-[12px] justify-between max-w-[1280px] md:px-6 md:items-center md:flex-row md:py-6 2xl:max-w-[1440px]">
          <span>
            © <CopyrightYear /> Ecram Execs{siteConfig.kvk && ` · KvK ${siteConfig.kvk}`} ·{" "}
            <Link className="text-inherit" href={localizedPath("/privacy", locale)}>
              {d.footer.privacy}
            </Link>
          </span>
          <nav className="gap-4 items-center flex flex-wrap" aria-label={d.footer.socialLabel}>
            {socialLinks.map(([label, url]) => (
              <a className="inline-flex h-9 w-9 items-center justify-center transition-opacity hover:opacity-70" key={label} href={url} aria-label={label} title={label} {...(url.startsWith("http") && { target: "_blank", rel: "noopener noreferrer" })}>
                <SocialIcon label={label} />
              </a>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
