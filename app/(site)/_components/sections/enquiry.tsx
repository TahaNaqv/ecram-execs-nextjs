import { QuoteForm } from "../quote-form";

export function Enquiry() {
  return (
    <section id="enquire" style={{ background: "#f4f4f5", color: "#0a0a0b" }}>
      <div className="sx-padding-48px-24px wrap-xl" style={{ maxWidth: "1280px", margin: "0 auto", padding: "48px 24px", display: "flex", flexDirection: "column", gap: "24px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: "12px" }}>
          <h2 style={{ margin: "0", fontFamily: "var(--font-cormorant), serif", fontWeight: "400", fontSize: "34px", lineHeight: "1.1" }}>
            Plan your journey
          </h2>
          <p style={{ margin: "0", fontSize: "14px", color: "#52525b" }}>
            Every journey is quoted personally — usually within the hour.
          </p>
        </div>
        <QuoteForm />
      </div>
    </section>
  );
}
