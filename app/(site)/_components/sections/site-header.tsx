export function SiteHeader() {
  return (
    <header style={{ position: "relative", zIndex: "2", borderBottom: "1px solid #1f1f23" }}>
      <div className="nav-wrap wrap-xl" style={{ maxWidth: "1280px", margin: "0 auto", padding: "22px 24px", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "20px" }}>
        <input className="nav-toggle" type="checkbox" id="nav-toggle" aria-label="Menu" aria-controls="primary-nav" />
        {" "}
        <a className="brand" href="#top" style={{ textDecoration: "none", display: "flex", flexDirection: "column", gap: "2px" }}>
          <span className="chrome" style={{ fontFamily: "var(--font-cinzel), serif", fontSize: "22px", letterSpacing: "0.32em", fontWeight: "500" }}>
            ECRAM EXECS
          </span>
          {" "}
          <span className="sx-letter-spacing-0-42em" style={{ fontFamily: "var(--font-cinzel), serif", fontSize: "9px", letterSpacing: "0.42em", color: "#8e8e96" }}>
            THE ART OF EXECUTIVE HOSPITALITY
          </span>
        </a>
        <label className="nav-burger" htmlFor="nav-toggle" aria-label="Open menu">
          <span></span>
          <span></span>
          <span></span>
        </label>
        <nav id="primary-nav" className="primary-nav" aria-label="Primary" style={{ display: "flex", flexWrap: "wrap", gap: "32px", fontSize: "12px", letterSpacing: "0.22em", textTransform: "uppercase" }}>
          <a className="navlink" href="#services">
            Services
          </a>
          <a className="navlink" href="#experience">
            The Experience
          </a>
          <a className="navlink" href="#fleet">
            Fleet
          </a>
          <a className="navlink" href="#netherlands">
            Destinations
          </a>
          <a className="navlink" href="#corporate">
            Corporate
          </a>
        </nav>
        <div className="nav-actions" style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <span style={{ fontSize: "12px", letterSpacing: "0.2em", color: "#8e8e96" }}>
            EN{" "}
            <span style={{ color: "#3a3a40" }}>
              |
            </span>
            {" "}NL
          </span>
          {" "}
          <a href="#enquire" style={{ display: "inline-flex", alignItems: "center", minHeight: "44px", padding: "0 22px", border: "1px solid #c9c9cf", color: "#ffffff", textDecoration: "none", fontSize: "11px", letterSpacing: "0.24em", textTransform: "uppercase" }}>
            Request a quotation
          </a>
        </div>
      </div>
    </header>
  );
}
