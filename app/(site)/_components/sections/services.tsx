export function Services() {
  return (
    <section id="services" style={{ borderBottom: "1px solid #1f1f23" }}>
      <div className="sx-padding-120px-24px sx-gap-56px wrap-xl" style={{ maxWidth: "1280px", margin: "0 auto", padding: "120px 24px", display: "flex", flexDirection: "column", gap: "56px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: "24px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", maxWidth: "640px" }}>
            <span className="reveal sx-letter-spacing-0-42em" style={{ fontFamily: "var(--font-cinzel), serif", fontSize: "12px", letterSpacing: "0.42em", color: "#8e8e96" }}>
              I — SERVICES
            </span>
            <h2 className="reveal" style={{ margin: "0", fontFamily: "var(--font-cormorant), serif", fontWeight: "300", fontSize: "clamp(36px, 4vw, 56px)", lineHeight: "1.08", color: "#ffffff" }}>
              Executive chauffeur services, end to end.
            </h2>
          </div>
          <p style={{ margin: "0", maxWidth: "420px", color: "#a6a6ad", fontWeight: "300" }}>
            Professionalism, punctuality, discretion and attention to detail — whether you are travelling for business or for leisure.
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1px", background: "#232327", border: "1px solid #232327" }}>
          <article className="card reveal" style={{ background: "#0a0a0b", padding: "40px 36px", display: "flex", flexDirection: "column", gap: "16px", minHeight: "280px" }}>
            <span className="chrome" style={{ fontFamily: "var(--font-cinzel), serif", fontSize: "22px" }}>
              I
            </span>
            <h3 style={{ margin: "0", fontFamily: "var(--font-cormorant), serif", fontWeight: "400", fontSize: "30px", color: "#ffffff" }}>
              Airport transfers
            </h3>
            <p style={{ margin: "0", color: "#a6a6ad", fontWeight: "300", fontSize: "15px" }}>
              Flight-tracked collections at Schiphol, Rotterdam The Hague and Eindhoven. Met in arrivals, luggage handled, straight to the cabin.
            </p>
          </article>
          <article className="card reveal" style={{ background: "#0a0a0b", padding: "40px 36px", display: "flex", flexDirection: "column", gap: "16px", minHeight: "280px" }}>
            <span className="chrome" style={{ fontFamily: "var(--font-cinzel), serif", fontSize: "22px" }}>
              II
            </span>
            <h3 style={{ margin: "0", fontFamily: "var(--font-cormorant), serif", fontWeight: "400", fontSize: "30px", color: "#ffffff" }}>
              Business travel
            </h3>
            <p style={{ margin: "0", color: "#a6a6ad", fontWeight: "300", fontSize: "15px" }}>
              Meetings, roadshows and site visits, with a chauffeur who waits as directed. A quiet cabin in which to prepare, call or rest.
            </p>
          </article>
          <article className="card reveal" style={{ background: "#0a0a0b", padding: "40px 36px", display: "flex", flexDirection: "column", gap: "16px", minHeight: "280px" }}>
            <span className="chrome" style={{ fontFamily: "var(--font-cinzel), serif", fontSize: "22px" }}>
              III
            </span>
            <h3 style={{ margin: "0", fontFamily: "var(--font-cormorant), serif", fontWeight: "400", fontSize: "30px", color: "#ffffff" }}>
              Corporate accounts
            </h3>
            <p style={{ margin: "0", color: "#a6a6ad", fontWeight: "300", fontSize: "15px" }}>
              A single point of contact for your organisation, consolidated invoicing and dependable cover for executives and guests.
            </p>
          </article>
          <article className="card reveal" style={{ background: "#0a0a0b", padding: "40px 36px", display: "flex", flexDirection: "column", gap: "16px", minHeight: "280px" }}>
            <span className="chrome" style={{ fontFamily: "var(--font-cinzel), serif", fontSize: "22px" }}>
              IV
            </span>
            <h3 style={{ margin: "0", fontFamily: "var(--font-cormorant), serif", fontWeight: "400", fontSize: "30px", color: "#ffffff" }}>
              Private occasions
            </h3>
            <p style={{ margin: "0", color: "#a6a6ad", fontWeight: "300", fontSize: "15px" }}>
              Weddings, celebrations and evenings out, attended to with the same composure as a board meeting.
            </p>
          </article>
          <article className="card reveal" style={{ background: "#0a0a0b", padding: "40px 36px", display: "flex", flexDirection: "column", gap: "16px", minHeight: "280px" }}>
            <span className="chrome" style={{ fontFamily: "var(--font-cinzel), serif", fontSize: "22px" }}>
              V
            </span>
            <h3 style={{ margin: "0", fontFamily: "var(--font-cormorant), serif", fontWeight: "400", fontSize: "30px", color: "#ffffff" }}>
              Hotels &amp; concierge
            </h3>
            <p style={{ margin: "0", color: "#a6a6ad", fontWeight: "300", fontSize: "15px" }}>
              A trusted partner for hotels and concierge desks welcoming international guests to the Netherlands.
            </p>
          </article>
          <article className="card reveal" style={{ background: "#0a0a0b", padding: "40px 36px", display: "flex", flexDirection: "column", gap: "16px", minHeight: "280px" }}>
            <span className="chrome" style={{ fontFamily: "var(--font-cinzel), serif", fontSize: "22px" }}>
              VI
            </span>
            <h3 style={{ margin: "0", fontFamily: "var(--font-cormorant), serif", fontWeight: "400", fontSize: "30px", color: "#ffffff" }}>
              Bespoke programmes
            </h3>
            <p style={{ margin: "0", color: "#a6a6ad", fontWeight: "300", fontSize: "15px" }}>
              Multi-day delegations, events and itineraries planned around your requirements, not ours.
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}
