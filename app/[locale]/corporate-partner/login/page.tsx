import { Suspense } from "react";
import Link from "next/link";
import { currentLocale, getDict } from "@/lib/i18n/get-dictionary";
import { localizedPath } from "@/lib/i18n/pathnames";
import { LoginForm } from "../../_components/corporate-login-form";
import { CorporateShell, SignedInNotice, corporateMetadata } from "../../_components/corporate-shell";

/** The form, with the page the visitor came from (read from the address, so it sits behind <Suspense>). */
async function Form({ searchParams }: Pick<PageProps<"/[locale]/corporate-partner/login">, "searchParams">) {
  const [locale, d, { next }] = await Promise.all([currentLocale(), getDict(), searchParams]);

  return (
    <div className="mx-auto flex w-full max-w-[460px] flex-col gap-4">
      {/* Shows the signed-in notice if a session exists, but always displays the form below it */}
      <Suspense fallback={null}>
        <SignedInNotice />
      </Suspense>
      <LoginForm
        locale={locale}
        copy={d.corporatePartner}
        forgotHref={localizedPath("/corporate-partner/forgot-password", locale)}
        signupHref={localizedPath("/corporate-partner/signup", locale)}
        next={typeof next === "string" ? next : undefined}
      />
    </div>
  );
}

export default async function LoginPage({ searchParams }: PageProps<"/[locale]/corporate-partner/login">) {
  const t = (await getDict()).corporatePartner;
  return (
    <CorporateShell route="/corporate-partner/login" heading={t.loginHeading} intro={t.loginIntro}>
      <Suspense fallback={null}>
        <Form searchParams={searchParams} />
      </Suspense>
    </CorporateShell>
  );
}

export async function generateMetadata() {
  const t = (await getDict()).corporatePartner;
  return corporateMetadata("/corporate-partner/login", t.loginMetaTitle, t.metaDescription, false);
}