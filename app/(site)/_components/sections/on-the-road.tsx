export function OnTheRoad() {
  return (
    <section style={{ borderBottom: "1px solid #1f1f23" }}>
      <div className="qr-row sx-padding-100px-24px" style={{ maxWidth: "1080px", margin: "0 auto", padding: "100px 24px", display: "flex", flexWrap: "wrap", gap: "48px", alignItems: "center", justifyContent: "center", textAlign: "left" }}>
        <div style={{ position: "relative", width: "160px", height: "160px", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
          <span className="orbit" aria-hidden="true"></span>
          <div style={{ width: "112px", height: "112px", borderRadius: "50%", border: "1px solid #3a3a40", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#C9C9CF" strokeWidth="1.1" aria-hidden="true">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
              <path d="M14 14h3v3h-3zM18 18h3v3h-3zM14 20h2M20 14v2"></path>
            </svg>
          </div>
        </div>
        <div style={{ flex: "1 1 420px", minWidth: "0", display: "flex", flexDirection: "column", gap: "14px" }}>
          <span className="reveal sx-letter-spacing-0-42em" style={{ fontFamily: "var(--font-cinzel), serif", fontSize: "12px", letterSpacing: "0.42em", color: "#8e8e96" }}>
            SEEN US ON THE ROAD?
          </span>
          <p className="qr-text" style={{ margin: "0", fontFamily: "var(--font-cormorant), serif", fontWeight: "300", fontSize: "32px", lineHeight: "1.2", color: "#ffffff" }}>
            Welcome. You found us through the emblem at the heart of our wings — every Ecram vehicle carries one.
          </p>
        </div>
      </div>
    </section>
  );
}
