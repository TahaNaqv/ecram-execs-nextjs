import { Suspense } from "react";
import { getPendingChallenge } from "@/lib/corporate/access";
import { CODE_MINUTES } from "@/lib/corporate/otp";
import { currentLocale, getDict } from "@/lib/i18n/get-dictionary";
import { interpolate } from "@/lib/i18n/interpolate";
import { localizedPath } from "@/lib/i18n/pathnames";
import { AccountFlow } from "../../_components/corporate-account-flow";
import { CorporateShell, PanelSkeleton, corporateMetadata } from "../../_components/corporate-shell";

/** Where the visitor is in the flow comes from the database, never from the cookie alone; a reload resumes at the code step. */
async function Flow() {
  const [locale, d] = await Promise.all([currentLocale(), getDict()]);
  // Signed-in visitors may still reset their password, so unlike sign-up there is no notice here
  const pending = await getPendingChallenge("reset");
  return (
    <AccountFlow
      mode="reset"
      locale={locale}
      initial={pending ? { step: pending.verified ? "password" : "code", email: pending.email } : { step: "request" }}
      copy={d.corporatePartner}
      minutes={CODE_MINUTES}
      privacyHref={localizedPath("/privacy", locale)}
      loginHref={localizedPath("/corporate-partner/login", locale)}
    />
  );
}

export default async function ForgotPasswordPage() {
  const t = (await getDict()).corporatePartner;
  return (
    <CorporateShell route="/corporate-partner/forgot-password" heading={t.resetHeading} intro={interpolate(t.resetIntro, { minutes: CODE_MINUTES })}>
      <Suspense fallback={<PanelSkeleton />}>
        <Flow />
      </Suspense>
    </CorporateShell>
  );
}

export async function generateMetadata() {
  const t = (await getDict()).corporatePartner;
  return corporateMetadata("/corporate-partner/forgot-password", t.resetMetaTitle, t.metaDescription, false);
}
