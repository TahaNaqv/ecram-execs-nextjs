import { currentLocale, getDict } from "@/lib/i18n/get-dictionary";
import { FLEET } from "@/lib/fleet/vehicles";
import { QuoteForm } from "../quote-form";

export async function Enquiry() {
  const [locale, d] = await Promise.all([currentLocale(), getDict()]);
  return (
    <section className="bg-ink-50 text-ink-950" id="enquire">
      <div className="py-10 px-5 my-0 mx-auto gap-6 flex flex-col max-w-[1280px] md:py-12 md:px-6 2xl:max-w-[1440px]">
        <h2 className="m-0 font-serif text-[30px] font-normal leading-[1.1] md:text-[34px]">
          {d.enquiry.heading}
        </h2>
        <QuoteForm locale={locale} serviceLabels={d.services} vehicles={FLEET.map(({ key, name }) => ({ key, name }))} copy={d.quoteForm} />
      </div>
    </section>
  );
}
