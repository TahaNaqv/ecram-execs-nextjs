import { Suspense } from "react";
import { currentLocale, getDict } from "@/lib/i18n/get-dictionary";
import { localizedPath } from "@/lib/i18n/pathnames";
import { LoginForm } from "../../_components/corporate-login-form";
import { CorporateShell, SignedInNotice, corporateMetadata } from "../../_components/corporate-shell";

export default async function LoginPage() {
  const [locale, d] = await Promise.all([currentLocale(), getDict()]);
  const t = d.corporatePartner;
  return (
    <CorporateShell route="/corporate-partner/login" heading={t.loginHeading} intro={t.loginIntro}>
      {/* The form is static; only "you are already signed in" needs the visitor's cookie */}
      <Suspense fallback={null}>
        <SignedInNotice />
      </Suspense>
      <LoginForm
        locale={locale}
        copy={t}
        forgotHref={localizedPath("/corporate-partner/forgot-password", locale)}
        signupHref={localizedPath("/corporate-partner/signup", locale)}
      />
    </CorporateShell>
  );
}

export async function generateMetadata() {
  const t = (await getDict()).corporatePartner;
  return corporateMetadata("/corporate-partner/login", t.loginMetaTitle, t.metaDescription, false);
}
