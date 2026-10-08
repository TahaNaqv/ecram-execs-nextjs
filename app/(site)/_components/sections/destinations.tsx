import Image from "next/image";

export function Destinations() {
  return (
    <section id="netherlands" style={{ borderBottom: "1px solid #1f1f23" }}>
      <div className="sx-padding-120px-24px sx-gap-56px wrap-xl" style={{ maxWidth: "1280px", margin: "0 auto", padding: "120px 24px", display: "flex", flexDirection: "column", gap: "56px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: "24px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", maxWidth: "640px" }}>
            <span className="reveal sx-letter-spacing-0-42em" style={{ fontFamily: "var(--font-cinzel), serif", fontSize: "12px", letterSpacing: "0.42em", color: "#8e8e96" }}>
              V — ACROSS THE NETHERLANDS
            </span>
            <h2 className="reveal" style={{ margin: "0", fontFamily: "var(--font-cormorant), serif", fontWeight: "300", fontSize: "clamp(36px, 4vw, 56px)", lineHeight: "1.08", color: "#ffffff" }}>
              Wherever you need to be.
            </h2>
          </div>
          <p style={{ margin: "0", maxWidth: "420px", color: "#a6a6ad", fontWeight: "300" }}>
            From the boardrooms of Zuidas to the windmills of Kinderdijk — one standard of service, from province to province.
          </p>
        </div>
        <div className="dest-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" }}>
          <figure className="dest reveal dest-tall" style={{ margin: "0", display: "flex", flexDirection: "column", gap: "14px", gridRow: "span 2" }}>
            <div className="shot shot-tall" style={{ flex: "1", minHeight: "560px" }}>
              <Image src="/assets/74497cf7361df1d7830d0f8ebc1d8e7a.jpg" alt="Windmills at Kinderdijk" style={{ objectPosition: "28% 50%" }} fill sizes="(max-width: 760px) 50vw, 40vw" />
            </div>
            <figcaption style={{ fontFamily: "var(--font-cinzel), serif", fontSize: "12px", letterSpacing: "0.34em", color: "#c9c9cf" }}>
              KINDERDIJK
            </figcaption>
          </figure>
          <figure className="dest reveal" style={{ margin: "0", display: "flex", flexDirection: "column", gap: "14px" }}>
            <div className="shot" style={{ height: "240px" }}>
              <Image src="/assets/c01091ac467f57c8ccacd1d28b8caa6f.jpg" alt="Erasmus Bridge, Rotterdam" style={{ objectPosition: "60% 62%" }} fill sizes="(max-width: 760px) 50vw, 40vw" />
            </div>
            <figcaption style={{ fontFamily: "var(--font-cinzel), serif", fontSize: "12px", letterSpacing: "0.34em", color: "#c9c9cf" }}>
              ROTTERDAM
            </figcaption>
          </figure>
          <figure className="dest reveal" style={{ margin: "0", display: "flex", flexDirection: "column", gap: "14px" }}>
            <div className="shot" style={{ height: "240px" }}>
              <Image src="/assets/3f6c76e3791d854e6974e39f5db1d665.jpg" alt="The Binnenhof and Hofvijver, The Hague" style={{ objectPosition: "60% 60%" }} fill sizes="(max-width: 760px) 50vw, 40vw" />
            </div>
            <figcaption style={{ fontFamily: "var(--font-cinzel), serif", fontSize: "12px", letterSpacing: "0.34em", color: "#c9c9cf" }}>
              THE HAGUE
            </figcaption>
          </figure>
          <figure className="dest reveal" style={{ margin: "0", display: "flex", flexDirection: "column", gap: "14px" }}>
            <div className="shot" style={{ height: "240px" }}>
              <Image src="/assets/d38555c6a11a07329e901cbb09fa90bb.jpg" alt="The Oudegracht canal in Utrecht at dusk" style={{ objectPosition: "50% 60%" }} fill sizes="(max-width: 760px) 50vw, 40vw" />
            </div>
            <figcaption style={{ fontFamily: "var(--font-cinzel), serif", fontSize: "12px", letterSpacing: "0.34em", color: "#c9c9cf" }}>
              UTRECHT
            </figcaption>
          </figure>
          <figure className="dest reveal" style={{ margin: "0", display: "flex", flexDirection: "column", gap: "14px" }}>
            <div className="shot" style={{ height: "240px" }}>
              <Image src="/assets/015c3f4881474d5c1c3690861a6d2221.jpg" alt="The Maas riverfront in Maastricht" style={{ objectPosition: "40% 62%" }} fill sizes="(max-width: 760px) 50vw, 40vw" />
            </div>
            <figcaption style={{ fontFamily: "var(--font-cinzel), serif", fontSize: "12px", letterSpacing: "0.34em", color: "#c9c9cf" }}>
              MAASTRICHT
            </figcaption>
          </figure>
          <figure className="dest reveal dest-wide" style={{ margin: "0", display: "flex", flexDirection: "column", gap: "14px", gridColumn: "span 2" }}>
            <div className="shot" style={{ height: "240px" }}>
              <Image src="/assets/9ba09fb8d24f8c76d2d91a2b893186bf.jpg" alt="Tulip fields in the Dutch bulb region" style={{ objectPosition: "50% 55%", filter: "saturate(0.4) contrast(1.05) brightness(0.7)" }} fill sizes="(max-width: 760px) 50vw, 40vw" />
            </div>
            <figcaption style={{ fontFamily: "var(--font-cinzel), serif", fontSize: "12px", letterSpacing: "0.34em", color: "#c9c9cf" }}>
              THE BULB REGION
            </figcaption>
          </figure>
          <figure className="dest reveal" style={{ margin: "0", display: "flex", flexDirection: "column", gap: "14px" }}>
            <div className="shot" style={{ height: "240px" }}>
              <Image src="/assets/52de87fce1028743a6cc606de596dd57.jpg" alt="An Amsterdam canal lined with trees" style={{ objectPosition: "50% 55%" }} fill sizes="(max-width: 760px) 50vw, 40vw" />
            </div>
            <figcaption style={{ fontFamily: "var(--font-cinzel), serif", fontSize: "12px", letterSpacing: "0.34em", color: "#c9c9cf" }}>
              AMSTERDAM
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
