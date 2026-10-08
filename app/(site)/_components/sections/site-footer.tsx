import { cacheLife } from "next/cache";
import { siteConfig, socialLinks, telHref } from "@/lib/site-config";

async function CopyrightYear() {
  "use cache";
  cacheLife("days");
  return new Date().getFullYear();
}

export function SiteFooter() {
  return (
    <footer style={{ borderTop: "1px solid #1f1f23", background: "#070708" }}>
      <div className="sx-padding-72px-24px-40px sx-gap-56px wrap-xl" style={{ maxWidth: "1280px", margin: "0 auto", padding: "72px 24px 40px", display: "flex", flexDirection: "column", gap: "56px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "48px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxWidth: "360px" }}>
            <span className="chrome sx-font-size-26px" style={{ fontFamily: "var(--font-cinzel), serif", fontSize: "26px", letterSpacing: "0.32em", fontWeight: "500" }}>
              ECRAM EXECS
            </span>
            {" "}
            <span className="sx-letter-spacing-0-42em" style={{ fontFamily: "var(--font-cinzel), serif", fontSize: "10px", letterSpacing: "0.42em", color: "#8e8e96" }}>
              THE ART OF EXECUTIVE HOSPITALITY
            </span>
            <p style={{ margin: "12px 0 0", fontSize: "14px", color: "#8e8e96", fontWeight: "300" }}>
              Executive chauffeur services throughout the Netherlands, in a fully electric fleet.
            </p>
          </div>
          <div className="sx-minmax-160px" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "40px", flex: "0 1 640px" }}>
            <nav aria-label="Services" style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "14px" }}>
              <span style={{ fontSize: "11px", letterSpacing: "0.24em", color: "#8e8e96" }}>
                SERVICES
              </span>
              <a className="navlink" href="#services">
                Airport transfers
              </a>
              <a className="navlink" href="#services">
                Business travel
              </a>
              <a className="navlink" href="#corporate">
                Corporate accounts
              </a>
              <a className="navlink" href="#services">
                Private occasions
              </a>
            </nav>
            <nav aria-label="Company" style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "14px" }}>
              <span style={{ fontSize: "11px", letterSpacing: "0.24em", color: "#8e8e96" }}>
                COMPANY
              </span>
              <a className="navlink" href="#experience">
                The experience
              </a>
              <a className="navlink" href="#fleet">
                Electric fleet
              </a>
              <a className="navlink" href="#netherlands">
                Destinations
              </a>
              <a className="navlink" href="#enquire">
                Contact
              </a>
            </nav>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "14px", color: "#c9c9cf" }}>
              <span style={{ fontSize: "11px", letterSpacing: "0.24em", color: "#8e8e96" }}>
                CONTACT
              </span>
              {siteConfig.contact.phone && (
                <a className="navlink" href={telHref(siteConfig.contact.phone)} style={{ alignSelf: "flex-start" }}>
                  {siteConfig.contact.phone}
                </a>
              )}
              {siteConfig.contact.email && (
                <a className="navlink" href={`mailto:${siteConfig.contact.email}`} style={{ alignSelf: "flex-start" }}>
                  {siteConfig.contact.email}
                </a>
              )}
              <span>{siteConfig.contact.address ? `${siteConfig.contact.address}, Netherlands` : "Serving the whole of the Netherlands"}</span>
              <a className="navlink" href="#enquire" style={{ alignSelf: "flex-start" }}>
                Request a quotation
              </a>
            </div>
          </div>
        </div>
        <div className="sx-justify-content-space-between-align-items-center" style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "20px", paddingTop: "28px", borderTop: "1px solid #1f1f23", fontSize: "12px", color: "#6b6b73" }}>
          <span>
            © <CopyrightYear /> Ecram Execs{siteConfig.kvk && ` · KvK ${siteConfig.kvk}`} ·{" "}
            <a href="/privacy" style={{ color: "inherit" }}>
              Privacy
            </a>
          </span>
          <nav aria-label="Social" style={{ display: "flex", flexWrap: "wrap", gap: "24px", fontSize: "11px", letterSpacing: "0.24em", textTransform: "uppercase" }}>
            {socialLinks.map(([label, url]) => (
              <a key={label} className="navlink" href={url} target="_blank" rel="noopener noreferrer">
                {label}
              </a>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
