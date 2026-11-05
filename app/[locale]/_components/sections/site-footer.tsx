import Image from "next/image";
import { cacheLife } from "next/cache";
import { currentLocale } from "@/lib/i18n/get-dictionary";
import { localizedPath } from "@/lib/i18n/pathnames";
import { getDict } from "@/lib/i18n/get-dictionary";
import Link from "next/link";
import { siteConfig, socialLinks, telHref } from "@/lib/site-config";
import { CookieSettingsButton } from "../cookie-settings-button";
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
    <footer className="keep-navy border-t border-t-ink-850 bg-ink-975">
      <div className="mx-auto flex max-w-[1280px] flex-col px-4 pt-10 pb-8 sm:px-6 md:px-8 md:pt-12 lg:pt-16 2xl:max-w-[1440px]">
        <div className="grid grid-cols-1 items-start gap-8 md:grid-cols-[minmax(0,220px)_minmax(0,1fr)] md:gap-8 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)] lg:gap-12">
          <div className="mx-auto flex max-w-[260px] flex-col items-center gap-2.5 text-center md:mx-0 md:items-start md:text-left">
            <Image className="h-auto w-full max-w-[220px] lg:max-w-[240px]" src="/assets/logo.png" alt={d.footer.logoAlt} width={1584} height={865} sizes="240px" />
            <p className="m-0 mt-2 text-center text-[14px] font-light text-ink-450 md:text-left">
              {d.footer.blurb}
            </p>
          </div>
          <div className="grid grid-cols-2 items-start gap-x-6 gap-y-6 md:grid-cols-3 md:gap-x-8">
            <nav className="gap-[10px] flex flex-col items-start text-[14px]" aria-label={d.footer.servicesLabel}>
              <span className="text-ink-450 text-[11px] tracking-[0.24em]">
                {d.footer.servicesLabel}
              </span>
              <Link className="navlink no-underline" href={`${home}#service-airport`}>
                {d.footer.linkAirport}
              </Link>
              <Link className="navlink no-underline" href={`${home}#service-business`}>
                {d.footer.linkBusiness}
              </Link>
              <Link className="navlink no-underline" href={`${home}#corporate`}>
                {d.footer.linkCorporate}
              </Link>
              <Link className="navlink no-underline" href={`${home}#service-private`}>
                {d.footer.linkPrivate}
              </Link>
              <Link className="navlink no-underline" href={`${home}#service-bespoke`}>
                {d.footer.linkBespoke}
              </Link>
              {siteConfig.contact.address && <span>{`${siteConfig.contact.address}, Netherlands`}</span>}
              <Link className="navlink self-start no-underline" href={`${home}#enquire`}>
                {d.common.requestQuote}
              </Link>
            </nav>
            <nav className="gap-[10px] flex flex-col items-start text-[14px]" aria-label={d.footer.companyLabel}>
              <span className="text-ink-450 text-[11px] tracking-[0.24em]">
                {d.footer.companyLabel}
              </span>
              <Link className="navlink no-underline" href={`${home}#experience`}>
                {d.footer.linkExperience}
              </Link>
              <Link className="navlink no-underline" href={`${home}#netherlands`}>
                {d.footer.linkDestinations}
              </Link>
              
              <Link className="navlink no-underline" href={localizedPath("/drive-with-us", locale)}>
                {d.footer.linkDriveWithUs}
              </Link>
              
            </nav>
            <div className="col-span-2 flex flex-col items-start gap-[10px] text-[14px] text-ink-250 md:col-span-1">
              <span className="text-ink-450 text-[11px] tracking-[0.24em]">
                {d.footer.contactLabel}
              </span>
              {siteConfig.contact.phone && (
                <a className="navlink self-start no-underline" href={telHref(siteConfig.contact.phone)}>
                  {siteConfig.contact.phone}
                </a>
              )}
              {siteConfig.contact.email && (
                <a className="navlink self-start no-underline" href={`mailto:${siteConfig.contact.email}`}>
                  {siteConfig.contact.email}
                </a>
              )}
              
            </div>
          </div>
        </div>
      </div>
      <div className="light-surface bg-white text-ink-600">
        {/* From md the copyright and icons share one row. From lg the icons sit in the middle. */}
        <div className="mx-auto grid max-w-[1280px] gap-4 px-4 pt-5 pb-16 text-[12px] sm:px-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:px-8 md:py-5 lg:grid-cols-[1fr_auto_1fr] 2xl:max-w-[1440px]">
          <span>
            © <CopyrightYear /> Ecram Execs{siteConfig.kvk && ` · KvK ${siteConfig.kvk}`} ·{" "}
            <Link className="text-inherit" href={localizedPath("/privacy", locale)}>
              {d.footer.privacy}
            </Link>{" "}
            ·{" "}
            <CookieSettingsButton label={d.cookieConsent.settingsLink} className="cursor-pointer border-none bg-transparent p-0 font-[inherit] text-[length:inherit] text-inherit underline underline-offset-2" />
          </span>
          <nav className="flex flex-wrap items-center justify-center gap-3 justify-self-center md:justify-self-end md:gap-4 lg:justify-self-center" aria-label={d.footer.socialLabel}>
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