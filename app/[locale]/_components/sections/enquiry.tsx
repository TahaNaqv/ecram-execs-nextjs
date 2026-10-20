import { FLEET } from "@/lib/fleet/vehicles";
import { currentLocale, getDict } from "@/lib/i18n/get-dictionary";
import { QuoteForm } from "../quote-form";

/**
 * The form is part of the static page: every vehicle is offered, and the form itself asks /api/vehicles/unavailable
 * which ones the team has switched off and hides those. (Reading the table while rendering made the form stream in
 * after the rest of the page, which moved everything below it and sent anchor links to the wrong place.)
 */
const FLEET_OFFER = FLEET.map(({ key, name }) => ({ key, name, status: "available" }));

export async function Enquiry() {
  const [locale, d] = await Promise.all([currentLocale(), getDict()]);

  return (
    <section className="light-surface bg-ink-50 text-ink-950" id="enquire">
      <div className="py-10 px-5 my-0 mx-auto gap-6 flex flex-col max-w-[1280px] md:py-12 md:px-6 2xl:max-w-[1440px]">
        <h2 className="m-0 font-serif text-[30px] font-normal leading-[1.1] md:text-[34px]">{d.enquiry.heading}</h2>
        <QuoteForm locale={locale} serviceLabels={d.services} vehicles={FLEET_OFFER} copy={d.quoteForm} dateTimeCopy={d.dateTimePicker} />
      </div>
    </section>
  );
}
