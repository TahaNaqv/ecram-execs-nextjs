import { Suspense } from "react";
import { currentLocale, getDict } from "@/lib/i18n/get-dictionary";
import { db } from "@/lib/db";
import { vehicles as vehiclesTable } from "@/lib/db/schema";
import { QuoteForm } from "../quote-form";

async function VehicleQuoteLoader() {
  const [locale, d] = await Promise.all([currentLocale(), getDict()]);

  let dbVehicles: { id: string; name: string; status: string }[] = [];
  try {
    dbVehicles = await db.select().from(vehiclesTable);
  } catch (error) {
    console.error("Failed to fetch vehicles from database:", error);
  }

  const vehiclesForForm = dbVehicles.length > 0 
    ? dbVehicles.map(({ id, name, status }) => ({ key: id, name, status }))
    : [
        { key: "mercedes-benz-vle-300", name: "Mercedes-Benz VLE 300", status: "available" },
        { key: "audi", name: "Audi", status: "available" },
        { key: "cadillac-escalade", name: "Cadillac Escalade", status: "available" },
        { key: "range-rover", name: "Range Rover", status: "available" },
        { key: "hongqi-ehs9", name: "Hongqi E-HS9", status: "available" },
      ];

  return (
    <QuoteForm 
      locale={locale} 
      serviceLabels={d.services} 
      vehicles={vehiclesForForm} 
      copy={d.quoteForm} 
    />
  );
}

export async function Enquiry() {
  const d = await getDict();

  return (
    <section className="bg-ink-50 text-ink-950" id="enquire">
      <div className="py-10 px-5 my-0 mx-auto gap-6 flex flex-col max-w-[1280px] md:py-12 md:px-6 2xl:max-w-[1440px]">
        <h2 className="m-0 font-serif text-[30px] font-normal leading-[1.1] md:text-[34px]">
          {d.enquiry.heading}
        </h2>
        <Suspense fallback={<div className="h-40 bg-white/50 animate-pulse rounded-lg" />}>
          <VehicleQuoteLoader />
        </Suspense>
      </div>
    </section>
  );
}