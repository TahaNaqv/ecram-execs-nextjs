import { currentLocale, getDict } from "@/lib/i18n/get-dictionary";
import { QuoteForm } from "../quote-form";

export async function Enquiry() {
  const [locale, d] = await Promise.all([currentLocale(), getDict()]);
  return (
    <section className="bg-ink-50 text-ink-950" id="enquire">
      <div className="py-10 px-5 my-0 mx-auto gap-6 flex flex-col max-w-[1280px] md:py-12 md:px-6 2xl:max-w-[1440px]">
        <div className="gap-3 items-baseline flex flex-wrap justify-between">
          <h2 className="m-0 font-serif text-[30px] font-normal leading-[1.1] md:text-[34px]">
            {d.enquiry.heading}
          </h2>
          <p className="m-0 text-ink-600 text-[14px]">
            {d.enquiry.note}
          </p>
        </div>
        <QuoteForm locale={locale} serviceLabels={d.services} copy={d.quoteForm} />
      </div>
    </section>
  );
}
