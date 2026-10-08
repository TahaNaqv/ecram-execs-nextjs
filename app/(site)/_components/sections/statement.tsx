export function Statement() {
  return (
    <section style={{ borderBottom: "1px solid #1f1f23" }}>
      <div className="sx-padding-140px-24px" style={{ maxWidth: "1080px", margin: "0 auto", padding: "140px 24px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "32px" }}>
        <span className="reveal sx-letter-spacing-0-42em" style={{ fontFamily: "var(--font-cinzel), serif", fontSize: "12px", letterSpacing: "0.42em", color: "#8e8e96" }}>
          THE ART OF EXECUTIVE HOSPITALITY
        </span>
        <p className="reveal" style={{ margin: "0", fontFamily: "var(--font-cormorant), serif", fontWeight: "300", fontSize: "clamp(30px, 3.6vw, 50px)", lineHeight: "1.22", color: "#f4f4f5" }}>
          We are not in the business of getting you from one place to another. We are in the business of{" "}
          <em className="chrome" style={{ fontStyle: "italic" }}>
            how that journey feels
          </em>
          {" "}— calm, comfortable and entirely on your terms.
        </p>
        <div style={{ width: "64px", height: "1px", background: "#8e8e96" }}></div>
      </div>
    </section>
  );
}
