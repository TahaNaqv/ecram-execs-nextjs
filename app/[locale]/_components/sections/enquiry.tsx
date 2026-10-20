import { Suspense } from "react";
import { currentLocale, getDict } from "@/lib/i18n/get-dictionary";
import { db } from "@/lib/db";
import { vehicles as vehiclesTable } from "@/lib/db/schema";
import { QuoteForm } from "../quote-form";
import type { Locale } from "@/lib/i18n/config";
import type { DateTimeCopy } from "@/components/date-time-field";

async function VehicleQuoteLoader({ localeOverride }: { localeOverride?: Locale }) {
  const [currentLoc, d] = await Promise.all([currentLocale(), getDict()]);
  const locale = localeOverride ?? currentLoc;

  let dbVehicles: { id: string; name: string; status: string }[] = [];
  try {
    dbVehicles = await db.select().from(vehiclesTable);
  } catch (error) {
    console.error("Failed to fetch vehicles from database:", error);
  }

  const vehiclesForForm = dbVehicles.length > 0 
    ? dbVehicles.map(({ id, name, status }) => ({ key: id, name, status }))
    : [
        { key: "mercedes_vle_300", name: "Mercedes-Benz VLE 300", status: "available" },
        { key: "audi", name: "Audi", status: "available" },
        { key: "cadillac_escalade", name: "Cadillac Escalade", status: "available" },
        { key: "range_rover", name: "Range Rover", status: "available" },
        { key: "hongqi_e_hs9", name: "Hongqi E-HS9", status: "available" },
      ];

  return (
    <QuoteForm 
      locale={locale} 
      serviceLabels={d.services} 
      vehicles={vehiclesForForm} 
      copy={d.quoteForm} 
      dateTimeCopy={d.dateTimePicker}
    />
  );
}

export async function Enquiry({
  locale,
}: {
  locale?: Locale;
  dateTimeCopy?: DateTimeCopy;
  searchParams?: Promise<{ vehicle?: string }>;
} = {}) {
  const d = await getDict();

  return (
    <section className="light-surface bg-ink-50 text-ink-950" id="enquire">
      <div className="py-10 px-5 my-0 mx-auto gap-6 flex flex-col max-w-[1280px] md:py-12 md:px-6 2xl:max-w-[1440px]">
        <h2 className="m-0 font-serif text-[30px] font-normal leading-[1.1] md:text-[34px]">
          {d.enquiry.heading}
        </h2>
        <Suspense fallback={<div className="h-40 bg-white/50 animate-pulse rounded-lg" />}>
          <VehicleQuoteLoader localeOverride={locale} />
        </Suspense>
      </div>
    </section>
  );
}
