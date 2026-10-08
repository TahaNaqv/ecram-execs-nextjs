export function Experience() {
  return (
    <section id="experience" style={{ borderBottom: "1px solid #1f1f23" }}>
      <div className="sx-padding-120px-24px sx-gap-56px wrap-xl" style={{ maxWidth: "1280px", margin: "0 auto", padding: "120px 24px", display: "flex", flexDirection: "column", gap: "56px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", alignItems: "center", textAlign: "center" }}>
          <span className="reveal sx-letter-spacing-0-42em" style={{ fontFamily: "var(--font-cinzel), serif", fontSize: "12px", letterSpacing: "0.42em", color: "#8e8e96" }}>
            II — THE EXPERIENCE
          </span>
          <h2 className="reveal" style={{ margin: "0", fontFamily: "var(--font-cormorant), serif", fontWeight: "300", fontSize: "clamp(36px, 4vw, 56px)", lineHeight: "1.08", color: "#ffffff" }}>
            The arrival, as you will see it.
          </h2>
        </div>
        <div className="ph film" style={{ position: "relative", aspectRatio: "21 / 9", width: "100%", padding: "28px", justifyContent: "space-between", alignItems: "flex-end" }}>
          <span className="film-cap" style={{ fontSize: "11px", letterSpacing: "0.24em", color: "#5a5a62", textTransform: "uppercase" }}>
            Brand film — guest collected by a VLE 300 Electric, shot from the client&apos;s perspective
          </span>
          <button className="film-play" type="button" disabled aria-label="Brand film coming soon" title="Brand film coming soon" style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", width: "96px", height: "96px", borderRadius: "50%", border: "1px solid #c9c9cf", background: "transparent", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "default" }}>
            <span className="ring" aria-hidden="true"></span>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
              <path d="M8 5l11 7-11 7z"></path>
            </svg>
          </button>
          <span style={{ fontFamily: "var(--font-cinzel), serif", fontSize: "11px", letterSpacing: "0.32em", color: "#8e8e96" }}>
            02:10
          </span>
        </div>
        <ol className="steps" style={{ listStyle: "none", margin: "0", padding: "0", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "32px" }}>
          <li className="reveal" style={{ display: "flex", flexDirection: "column", gap: "10px", borderTop: "1px solid #3a3a40", paddingTop: "20px" }}>
            <span style={{ fontFamily: "var(--font-cinzel), serif", fontSize: "12px", letterSpacing: "0.3em", color: "#8e8e96" }}>
              01
            </span>
            <span style={{ fontFamily: "var(--font-cormorant), serif", fontSize: "24px", color: "#ffffff" }}>
              The arrival
            </span>
            <span style={{ fontSize: "14px", color: "#a6a6ad", fontWeight: "300" }}>
              Your vehicle is in place before you are, without fuss.
            </span>
          </li>
          <li className="reveal" style={{ display: "flex", flexDirection: "column", gap: "10px", borderTop: "1px solid #3a3a40", paddingTop: "20px" }}>
            <span style={{ fontFamily: "var(--font-cinzel), serif", fontSize: "12px", letterSpacing: "0.3em", color: "#8e8e96" }}>
              02
            </span>
            <span style={{ fontFamily: "var(--font-cormorant), serif", fontSize: "24px", color: "#ffffff" }}>
              The greeting
            </span>
            <span style={{ fontSize: "14px", color: "#a6a6ad", fontWeight: "300" }}>
              A personal welcome from a chauffeur who knows your name and your plans.
            </span>
          </li>
          <li className="reveal" style={{ display: "flex", flexDirection: "column", gap: "10px", borderTop: "1px solid #3a3a40", paddingTop: "20px" }}>
            <span style={{ fontFamily: "var(--font-cinzel), serif", fontSize: "12px", letterSpacing: "0.3em", color: "#8e8e96" }}>
              03
            </span>
            <span style={{ fontFamily: "var(--font-cormorant), serif", fontSize: "24px", color: "#ffffff" }}>
              Your luggage
            </span>
            <span style={{ fontSize: "14px", color: "#a6a6ad", fontWeight: "300" }}>
              Taken care of, from the kerb to the boot and back again.
            </span>
          </li>
          <li className="reveal" style={{ display: "flex", flexDirection: "column", gap: "10px", borderTop: "1px solid #3a3a40", paddingTop: "20px" }}>
            <span style={{ fontFamily: "var(--font-cinzel), serif", fontSize: "12px", letterSpacing: "0.3em", color: "#8e8e96" }}>
              04
            </span>
            <span style={{ fontFamily: "var(--font-cormorant), serif", fontSize: "24px", color: "#ffffff" }}>
              The cabin
            </span>
            <span style={{ fontSize: "14px", color: "#a6a6ad", fontWeight: "300" }}>
              Settle into a silent, lounge-like interior prepared for you.
            </span>
          </li>
          <li className="reveal" style={{ display: "flex", flexDirection: "column", gap: "10px", borderTop: "1px solid #3a3a40", paddingTop: "20px" }}>
            <span style={{ fontFamily: "var(--font-cinzel), serif", fontSize: "12px", letterSpacing: "0.3em", color: "#8e8e96" }}>
              05
            </span>
            <span style={{ fontFamily: "var(--font-cormorant), serif", fontSize: "24px", color: "#ffffff" }}>
              The journey
            </span>
            <span style={{ fontSize: "14px", color: "#a6a6ad", fontWeight: "300" }}>
              Work, talk or simply rest. We take care of everything else.
            </span>
          </li>
        </ol>
      </div>
    </section>
  );
}
