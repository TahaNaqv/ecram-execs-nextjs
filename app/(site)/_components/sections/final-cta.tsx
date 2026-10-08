import { siteConfig, telHref } from "@/lib/site-config";

export function FinalCta() {
  return (
    <section style={{ position: "relative" }}>
      <div className="sx-padding-160px-24px" style={{ maxWidth: "1080px", margin: "0 auto", padding: "160px 24px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "28px" }}>
        <span className="reveal sx-letter-spacing-0-42em" style={{ fontFamily: "var(--font-cinzel), serif", fontSize: "12px", letterSpacing: "0.42em", color: "#8e8e96" }}>
          TAILORED TO YOUR JOURNEY
        </span>
        <h2 style={{ margin: "0", fontFamily: "var(--font-cormorant), serif", fontWeight: "300", fontSize: "clamp(40px, 5vw, 72px)", lineHeight: "1.05", color: "#ffffff" }}>
          Allow us to take care{" "}
          <br />
          <em className="chrome" style={{ fontStyle: "italic" }}>
            of the rest.
          </em>
        </h2>
        <p style={{ margin: "0", maxWidth: "540px", color: "#a6a6ad", fontWeight: "300" }}>
          Every journey is different, so every quotation is personal. Tell us where, when and how — we will respond promptly.
        </p>
        <div className="cta-row" style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "16px" }}>
          <a className="btn-fill" href="#enquire" style={{ display: "inline-flex", alignItems: "center", minHeight: "52px", padding: "0 34px", background: "#f4f4f5", color: "#0a0a0b", textDecoration: "none", fontSize: "12px", letterSpacing: "0.24em", textTransform: "uppercase", fontWeight: "600" }}>
            Request a quotation
          </a>
          {siteConfig.contact.phone && (
          <a className="btn-line" href={telHref(siteConfig.contact.phone)} style={{ display: "inline-flex", alignItems: "center", minHeight: "52px", padding: "0 30px", border: "1px solid #3a3a40", color: "#ffffff", textDecoration: "none", fontSize: "12px", letterSpacing: "0.24em", textTransform: "uppercase" }}>
            Call {siteConfig.contact.phone}
          </a>
          )}
        </div>
      </div>
    </section>
  );
}
