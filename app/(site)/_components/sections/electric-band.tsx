export function ElectricBand() {
  return (
    <section style={{ background: "#f4f4f5", color: "#0a0a0b" }}>
      <div className="sx-padding-120px-24px sx-gap-64px wrap-xl" style={{ maxWidth: "1280px", margin: "0 auto", padding: "120px 24px", display: "grid", gridTemplateColumns: "repeat( auto-fit, minmax(min(320px, 100%), 1fr) )", gap: "64px", alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <span className="sx-letter-spacing-0-42em" style={{ fontFamily: "var(--font-cinzel), serif", fontSize: "12px", letterSpacing: "0.42em", color: "#52525b" }}>
            IV — ELECTRIC EXECUTIVE FLEET
          </span>
          <h2 className="reveal" style={{ margin: "0", fontFamily: "var(--font-cormorant), serif", fontWeight: "300", fontSize: "clamp(36px, 4vw, 56px)", lineHeight: "1.08" }}>
            Sustainability and luxury need not be separate.
          </h2>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <p style={{ margin: "0", fontSize: "17px", color: "#3f3f46", fontWeight: "300" }}>
            As a Netherlands-based company we are building a modern, fully electric executive fleet — contributing, where we can, to the Dutch transition towards cleaner, future-focused mobility. Electric drive brings a quieter, smoother journey: precisely the calm our service is built on.
          </p>
          <p className="sx-letter-spacing-0-42em" style={{ margin: "0", fontFamily: "var(--font-cinzel), serif", fontSize: "14px", letterSpacing: "0.42em", color: "#0a0a0b" }}>
            QUIET. REFINED. ELECTRIC.
          </p>
        </div>
      </div>
    </section>
  );
}
