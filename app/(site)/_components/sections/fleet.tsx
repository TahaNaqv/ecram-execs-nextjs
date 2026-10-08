import { siteConfig } from "@/lib/site-config";
import Image from "next/image";

export function Fleet() {
  return (
    <section id="fleet" style={{ borderBottom: "1px solid #1f1f23" }}>
      <div className="sx-padding-120px-24px sx-gap-64px wrap-xl" style={{ maxWidth: "1280px", margin: "0 auto", padding: "120px 24px", display: "flex", flexWrap: "wrap", gap: "64px", alignItems: "center" }}>
        <div className="fleet-media" style={{ flex: "999 1 560px", minWidth: "0", aspectRatio: "4 / 3", padding: "24px", boxSizing: "border-box", background: "#f4f4f5", border: "1px solid #26262a", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Image src="/assets/mercedes-vle-300-electric.jpg" alt="Mercedes-Benz VLE 300 Electric in obsidian black, three-quarter front" style={{ width: "100%", height: "100%", objectFit: "contain", mixBlendMode: "multiply", display: "block" }} width={1600} height={900} sizes="(max-width: 760px) 100vw, 60vw" />
        </div>
        <div style={{ flex: "1 1 380px", minWidth: "0", display: "flex", flexDirection: "column", gap: "24px" }}>
          <span className="reveal sx-letter-spacing-0-42em" style={{ fontFamily: "var(--font-cinzel), serif", fontSize: "12px", letterSpacing: "0.42em", color: "#8e8e96" }}>
            III — THE FLEET
          </span>
          <h2 className="reveal" style={{ margin: "0", fontFamily: "var(--font-cormorant), serif", fontWeight: "300", fontSize: "clamp(36px, 4vw, 56px)", lineHeight: "1.05", color: "#ffffff" }}>
            Mercedes-Benz{" "}
            <br />
            <span className="chrome" style={{ fontStyle: "italic" }}>
              VLE 300 Electric
            </span>
          </h2>
          <p style={{ margin: "0", color: "#a6a6ad", fontWeight: "300" }}>
            Selected for comfort, technology and refinement. A sophisticated, near-silent environment in which to relax, work or simply enjoy a peaceful journey.
          </p>
          <ul style={{ listStyle: "none", margin: "0", padding: "0", display: "flex", flexDirection: "column", borderBottom: "1px solid #26262a" }}>
            <li style={{ display: "flex", justifyContent: "space-between", gap: "16px", padding: "16px 0", borderTop: "1px solid #26262a", fontSize: "14px" }}>
              <span style={{ color: "#8e8e96", letterSpacing: "0.18em", textTransform: "uppercase", fontSize: "11px" }}>
                Cabin
              </span>
              <span style={{ color: "#e4e4e7" }}>
                Lounge-style executive seating
              </span>
            </li>
            <li style={{ display: "flex", justifyContent: "space-between", gap: "16px", padding: "16px 0", borderTop: "1px solid #26262a", fontSize: "14px" }}>
              <span style={{ color: "#8e8e96", letterSpacing: "0.18em", textTransform: "uppercase", fontSize: "11px" }}>
                Drive
              </span>
              <span style={{ color: "#e4e4e7" }}>
                Fully electric, near-silent
              </span>
            </li>
            {siteConfig.fleet.passengers && (
              <li style={{ display: "flex", justifyContent: "space-between", gap: "16px", padding: "16px 0", borderTop: "1px solid #26262a", fontSize: "14px" }}>
                <span style={{ color: "#8e8e96", letterSpacing: "0.18em", textTransform: "uppercase", fontSize: "11px" }}>
                  Passengers
                </span>
                <span style={{ color: "#e4e4e7" }}>
                  {siteConfig.fleet.passengers}
                </span>
              </li>
            )}
            {siteConfig.fleet.amenities && (
              <li style={{ display: "flex", justifyContent: "space-between", gap: "16px", padding: "16px 0", borderTop: "1px solid #26262a", fontSize: "14px" }}>
                <span style={{ color: "#8e8e96", letterSpacing: "0.18em", textTransform: "uppercase", fontSize: "11px" }}>
                  Amenities
                </span>
                <span style={{ color: "#e4e4e7" }}>
                  {siteConfig.fleet.amenities}
                </span>
              </li>
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}
