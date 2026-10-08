import Image from "next/image";

export function Hero() {
  return (
    <section className="hero" id="top" style={{ position: "relative", minHeight: "860px", display: "flex", flexDirection: "column", justifyContent: "center", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: "0", background: "#0b0b0c", overflow: "hidden" }}>
        <Image src="/assets/3b00bbaea002c5bc3c19878670191ab0.jpg" className="hero-img" alt="Ecram Execs electric Mercedes van on a Dutch polder road at blue hour" fill priority sizes="100vw" />
        <div style={{ position: "absolute", inset: "0", background: "radial-gradient( ellipse at 50% 45%, rgba(10, 10, 11, 0.55) 0%, rgba(10, 10, 11, 0.85) 70%, #0a0a0b 100% )" }}></div>
      </div>
      <div className="hero-inner wrap-xl" style={{ position: "relative", maxWidth: "1280px", width: "100%", margin: "0 auto", padding: "80px 24px 96px", boxSizing: "border-box", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "28px" }}>
        <div className="emblem">
          <Image src="/assets/ecram-execs-logo-transparent.webp" alt="Ecram Execs luxury chrome emblem with QR code" style={{ width: "100%", height: "auto", display: "block" }} width={1040} height={416} priority sizes="(max-width: 760px) 82vw, 520px" />
        </div>
        <h1 className="rise d2" style={{ margin: "8px 0 0", fontFamily: "var(--font-cormorant), serif", fontWeight: "300", fontSize: "clamp(40px, 5.4vw, 76px)", lineHeight: "1.05", color: "#ffffff", letterSpacing: "-0.01em" }}>
          Every journey is part{" "}
          <br />
          <em className="chrome-live" style={{ fontStyle: "italic", fontWeight: "300" }}>
            of the experience.
          </em>
        </h1>
        <p className="rise d3" style={{ margin: "0", maxWidth: "620px", fontSize: "17px", color: "#b4b4bb", fontWeight: "300" }}>
          Private executive chauffeurs across the Netherlands, in a fully electric fleet. Calm, discreet and effortless — from the moment you are collected to the moment you arrive.
        </p>
        <div className="rise d4 cta-row" style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "16px", marginTop: "8px" }}>
          <a className="btn-fill" href="#enquire" style={{ display: "inline-flex", alignItems: "center", minHeight: "52px", padding: "0 34px", background: "#f4f4f5", color: "#0a0a0b", textDecoration: "none", fontSize: "12px", letterSpacing: "0.24em", textTransform: "uppercase", fontWeight: "600" }}>
            Request a quotation
          </a>
          {" "}
          <a className="btn-line" href="#experience" style={{ display: "inline-flex", alignItems: "center", gap: "12px", minHeight: "52px", padding: "0 30px", border: "1px solid #3a3a40", color: "#ffffff", textDecoration: "none", fontSize: "12px", letterSpacing: "0.24em", textTransform: "uppercase" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M7 4l13 8-13 8z"></path>
            </svg>
            Watch the arrival
          </a>
        </div>
      </div>
      <div className="rise d4 scroll-cue" style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", paddingBottom: "28px" }}>
        <span style={{ fontSize: "10px", letterSpacing: "0.3em", color: "#8e8e96" }}>
          SCROLL
        </span>
        <span className="cue" aria-hidden="true"></span>
      </div>
      <div style={{ position: "relative", borderTop: "1px solid #1f1f23" }}>
        <div className="hero-strip wrap-xl" style={{ maxWidth: "1280px", margin: "0 auto", padding: "22px 24px", display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "16px", fontFamily: "var(--font-cinzel), serif", fontSize: "12px", letterSpacing: "0.38em", color: "#8e8e96" }}>
          <span>
            QUIET · REFINED · ELECTRIC
          </span>
          {" "}
          <span>
            SERVING THE WHOLE OF THE NETHERLANDS
          </span>
          {" "}
          <span>
            AVAILABLE 24 / 7
          </span>
        </div>
      </div>
    </section>
  );
}
