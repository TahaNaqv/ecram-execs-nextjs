export const instant = false;
import type { Metadata } from "next";
import { Suspense } from "react";
import { adminDictionary } from "@/lib/i18n/get-dictionary";
import { PageBody, PageHeader } from "../../_components/ui";
import { CorporateDirectoryHub } from "./corporate-directory";
import { getCorporatePartners, listIntroducers } from "@/lib/admin/live-queries";

export async function generateMetadata(): Promise<Metadata> {
  const { admin } = await adminDictionary();
  return { title: admin.corporate.hub.title };
}

async function Heading() {
  const { admin } = await adminDictionary();
  return admin.corporate.hub.title;
}

async function CorporateContent() {
  const [{ admin }, partners, introducers] = await Promise.all([adminDictionary(), getCorporatePartners(), listIntroducers()]);
  return <CorporateDirectoryHub initialPartners={partners} copy={admin.corporate.hub} statuses={admin.statuses} introducers={introducers} />;
}

export default function CorporatePage() {
  return (
    <PageBody>
      <PageHeader
        title={
          <Suspense fallback={<span className="inline-block h-[1em] w-40 animate-pulse rounded bg-zinc-100 align-middle" />}>
            <Heading />
          </Suspense>
        }
      />

      {/* Corporate Partner Directory & Engagement Hub */}
      <div className="mt-6">
        <Suspense fallback={<div className="h-96 w-full animate-pulse rounded-2xl bg-zinc-100" />}>
          <CorporateContent />
        </Suspense>
      </div>
    </PageBody>
  );
}