import { Suspense } from "react";
import Link from "next/link";
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
  const pending = await getPendingChallenge("signup");
  
  return (
    <div className="mx-auto flex w-full max-w-[460px] flex-col gap-6">
      <AccountFlow
        mode="signup"
        locale={locale}
        initial={pending ? { step: pending.verified ? "password" : "code", email: pending.email } : { step: "request" }}
        copy={d.corporatePartner}
        minutes={CODE_MINUTES}
        privacyHref={localizedPath("/privacy", locale)}
        loginHref={localizedPath("/corporate-partner/login", locale)}
      />
    </div>
  );
}

export default async function SignupPage() {
  const t = (await getDict()).corporatePartner;
  return (
    <CorporateShell route="/corporate-partner/signup" heading={t.signupHeading} intro={interpolate(t.signupIntro, { minutes: CODE_MINUTES })}>
      <Suspense fallback={<PanelSkeleton />}>
        <Flow />
      </Suspense>
    </CorporateShell>
  );
}

export async function generateMetadata() {
  const t = (await getDict()).corporatePartner;
  return corporateMetadata("/corporate-partner/signup", t.signupMetaTitle, t.metaDescription, false);
}