import { Suspense } from "react";
import { cookies } from "next/headers";
import { CODE_MINUTES, CHALLENGE_COOKIE, FLOW_EPOCH_COOKIE } from "@/lib/corporate/otp";
import { currentLocale, getDict } from "@/lib/i18n/get-dictionary";
import { interpolate } from "@/lib/i18n/interpolate";
import { localizedPath } from "@/lib/i18n/pathnames";
import { AccountFlow } from "../../_components/corporate-account-flow";
import { CorporateShell, PanelSkeleton, corporateMetadata } from "../../_components/corporate-shell";

/** Every visit starts at an empty form. An unfinished sign-up is not restored from the challenge cookie. */
async function Flow() {
  const [locale, d, jar] = await Promise.all([currentLocale(), getDict(), cookies()]);
  // A finished registration stamps a new value, which remounts the form instead of replaying the last action.
  const epoch = jar.get(FLOW_EPOCH_COOKIE)?.value ?? "0";
  const staleChallengeId = jar.get(CHALLENGE_COOKIE)?.value ?? "";

  return (
    <div className="mx-auto flex w-full max-w-[460px] flex-col gap-6">
      <AccountFlow
        key={epoch}
        mode="signup"
        locale={locale}
        initial={{ step: "request" }}
        staleChallengeId={staleChallengeId}
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