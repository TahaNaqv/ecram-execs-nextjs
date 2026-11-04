import { redirect } from "next/navigation";
import { currentLocale } from "@/lib/i18n/get-dictionary";
import { localizedPath } from "@/lib/i18n/pathnames";

/** Company and signatory are collected at sign-up. This address now opens the bookings list. */
export default async function IntroductionPage() {
  const locale = await currentLocale();
  redirect(localizedPath("/corporate-partner/account", locale));
}
