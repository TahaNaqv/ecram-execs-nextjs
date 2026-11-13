import { Suspense } from "react";
import { billingDetails } from "@/lib/corporate/billing";
import { requirePartner } from "@/lib/corporate/portal";
import { getDict } from "@/lib/i18n/get-dictionary";
import { corporateMetadata, PanelSkeleton } from "../../../_components/corporate-shell";
import { BillingForm } from "../../../_components/portal-billing-form";
import { PortalPage } from "../../../_components/portal-shell";

/** The partner's billing details: the address their invoices carry (Moneybird), a VAT number, and where invoices go. */
async function Billing() {
  const { locale, contact } = await requirePartner("/corporate-partner/account/billing");
  const [d, details] = await Promise.all([getDict(), billingDetails(contact.id)]);
  const t = d.portal.billing;
  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col items-center gap-6 text-center">
      <p className="m-0 text-[15px] text-ink-700">{details?.complete ? t.intro : t.introMissing}</p>
      <BillingForm
        locale={locale}
        initial={details ?? { street: "", postcode: "", city: "", country: "NL", vatNumber: "", invoiceEmail: "", complete: false }}
        phone={contact.phone}
        loginEmail={contact.email}
        copy={t}
      />
    </div>
  );
}

export default async function BillingPage() {
  const p = (await getDict()).portal;
  return (
    <PortalPage route="/corporate-partner/account/billing" current="billing" heading={p.billing.heading} centered>
      <Suspense fallback={<PanelSkeleton />}>
        <Billing />
      </Suspense>
    </PortalPage>
  );
}

export async function generateMetadata() {
  const d = await getDict();
  return corporateMetadata("/corporate-partner/account/billing", d.portal.billing.metaTitle, d.corporatePartner.metaDescription, false);
}
