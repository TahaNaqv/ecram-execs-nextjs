import { Suspense } from "react";
import { companyLookupEnabled } from "@/lib/companies/provider";
import { listIntroductions } from "@/lib/corporate/access";
import { formatDay } from "@/lib/corporate/format";
import { requirePartner } from "@/lib/corporate/portal";
import { getDict } from "@/lib/i18n/get-dictionary";
import { interpolate } from "@/lib/i18n/interpolate";
import { localizedPath } from "@/lib/i18n/pathnames";
import { IntroductionPanel } from "../../../_components/corporate-introduction-panel";
import { OnboardingForm } from "../../../_components/corporate-onboarding-form";
import { corporateMetadata, PanelSkeleton } from "../../../_components/corporate-shell";
import { PortalPage } from "../../../_components/portal-shell";

/** The company introduction (the short KYB form), and the ones already sent. */
async function Introduction() {
  const { locale, contact } = await requirePartner("/corporate-partner/account/introduction");
  const d = await getDict();
  const t = d.corporatePartner;
  const introductions = await listIntroductions(contact.id);

  const form = (
    <OnboardingForm
      locale={locale}
      copy={t}
      booker={{ name: contact.name, email: contact.email }}
      lookup={{ enabled: companyLookupEnabled(), copy: d.companySearch }}
      loginHref={localizedPath("/corporate-partner/login", locale)}
    />
  );

  return (
    <div className="flex flex-col gap-10">
      {/* Fixed slots, so the form keeps its place (and its confirmation) when the first introduction makes the list appear */}
      {introductions.length > 0 && (
        <section className="flex flex-col gap-4" aria-labelledby="c-introductions">
          <h2 id="c-introductions" className="m-0 font-serif text-[28px] font-normal leading-[1.1] text-ink-950 md:text-[32px]">
            {t.introductionsHeading}
          </h2>
          <p className="m-0 text-[15px] text-ink-700">{t.introductionsNote}</p>
          <ul className="m-0 flex list-none flex-col gap-px border border-ink-225 bg-ink-225 p-0">
            {introductions.map((i) => (
              <li key={i.reference} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 bg-white px-5 py-4 text-[14px]">
                <span>
                  <strong className="font-semibold tracking-[0.08em]">{i.reference}</strong>
                  {i.company ? <span className="text-ink-700"> · {i.company}</span> : null}
                </span>
                <span className="text-ink-600">{interpolate(t.introductionOn, { date: formatDay(i.createdAt, locale) })}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <IntroductionPanel collapsible={introductions.length > 0} summary={t.newIntroduction}>
        {form}
      </IntroductionPanel>
    </div>
  );
}

export default async function IntroductionPage() {
  const p = (await getDict()).portal;
  return (
    <PortalPage route="/corporate-partner/account/introduction" current="introduction" heading={p.headingIntro}>
      <Suspense fallback={<PanelSkeleton />}>
        <Introduction />
      </Suspense>
    </PortalPage>
  );
}

export async function generateMetadata() {
  const d = await getDict();
  return corporateMetadata("/corporate-partner/account/introduction", d.portal.metaTitleIntro, d.corporatePartner.metaDescription, false);
}
