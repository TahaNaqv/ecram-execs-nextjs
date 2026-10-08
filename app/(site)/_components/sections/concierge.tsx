import { ConciergeInput } from "../concierge-input";

export function Concierge() {
  return (
    <section style={{ borderBottom: "1px solid #1f1f23" }}>
      <div className="sx-padding-120px-24px sx-gap-80px wrap-xl concierge-row" style={{ maxWidth: "1280px", margin: "0 auto", padding: "120px 24px", display: "flex", flexWrap: "wrap", gap: "80px", alignItems: "center" }}>
        <div style={{ flex: "1 1 380px", minWidth: "0", display: "flex", flexDirection: "column", gap: "24px" }}>
          <span className="reveal sx-letter-spacing-0-42em" style={{ fontFamily: "var(--font-cinzel), serif", fontSize: "12px", letterSpacing: "0.42em", color: "#8e8e96" }}>
            VII — ECRAM CONCIERGE
          </span>
          <h2 className="reveal" style={{ margin: "0", fontFamily: "var(--font-cormorant), serif", fontWeight: "300", fontSize: "clamp(36px, 4vw, 52px)", lineHeight: "1.08", color: "#ffffff" }}>
            Immediate answers.{" "}
            <br />
            <em className="chrome" style={{ fontStyle: "italic" }}>
              A personal touch, always.
            </em>
          </h2>
          <p style={{ margin: "0", color: "#a6a6ad", fontWeight: "300" }}>
            Our digital concierge answers questions, explains our services and begins your quotation at any hour. When a request deserves a personal conversation, it hands you to a member of our team — seamlessly.
          </p>
        </div>
        <div className="sx-flex-1-1-440px" style={{ flex: "1 1 440px", minWidth: "0", maxWidth: "520px", border: "1px solid #2e2e33", background: "#111113", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: "1px solid #26262a" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontFamily: "var(--font-cinzel), serif", fontSize: "13px", letterSpacing: "0.3em", color: "#ffffff" }}>
                ECRAM CONCIERGE
              </span>
              <span style={{ fontSize: "12px", color: "#8e8e96" }}>
                Replies instantly · Team on hand 24/7
              </span>
            </div>
            <span className="live" style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#e4e4e7" }}></span>
          </div>
          <div className="sx-padding-24px-22px" style={{ padding: "24px 22px", display: "flex", flexDirection: "column", gap: "14px", fontSize: "14px" }}>
            <div style={{ alignSelf: "flex-end", maxWidth: "80%", background: "#e4e4e7", color: "#0a0a0b", padding: "12px 16px" }}>
              I land at Schiphol on Thursday at 07:40 and need to be in Eindhoven by 10:00.
            </div>
            <div style={{ alignSelf: "flex-start", maxWidth: "85%", border: "1px solid #2e2e33", color: "#e4e4e7", padding: "12px 16px" }}>
              Certainly. Your chauffeur will track your flight and meet you in arrivals. May I ask how many passengers, and roughly how much luggage?
            </div>
            <div style={{ alignSelf: "flex-end", maxWidth: "80%", background: "#e4e4e7", color: "#0a0a0b", padding: "12px 16px" }}>
              Two of us, two cases. Can the car wait and bring us back in the evening?
            </div>
            <div style={{ alignSelf: "flex-start", maxWidth: "85%", border: "1px solid #2e2e33", color: "#e4e4e7", padding: "12px 16px" }}>
              Of course. For a return with waiting time, I&apos;ll pass you to our reservations team for a tailored quotation — they&apos;ll reply shortly.
            </div>
            <div style={{ alignSelf: "center", fontSize: "11px", letterSpacing: "0.2em", textTransform: "uppercase", color: "#8e8e96", paddingTop: "4px" }}>
              — Connecting you with our team —
            </div>
            <div style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: "12px", border: "1px solid #2e2e33", padding: "12px 16px", fontSize: "12px", color: "#8e8e96" }}>
              Sophie, reservations{" "}
              <span className="typing" aria-label="is typing" style={{ display: "inline-flex", gap: "4px" }}>
                <span></span>
                <span></span>
                <span></span>
              </span>
            </div>
          </div>
          <ConciergeInput />
        </div>
      </div>
    </section>
  );
}
