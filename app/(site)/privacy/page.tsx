import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { siteConfig } from "@/lib/site-config";

// NOTE: Describes how this website actually handles data (see lib/quotes, lib/email).
// Have it reviewed before launch, and update it whenever a new processor or feature is added.
export const metadata: Metadata = {
  title: "Privacy policy — Ecram Execs",
  description: "How Ecram Execs collects, uses and protects your personal data.",
  alternates: { canonical: "/privacy" },
};

const LAST_UPDATED = "8 October 2026";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <h2 style={{ margin: 0, fontFamily: "var(--font-cormorant), serif", fontWeight: 400, fontSize: "28px", color: "#ffffff" }}>{title}</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px", color: "#b4b4bb", fontWeight: 300 }}>{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  const { email, address } = siteConfig.contact;
  const contactLine = email ? (
    <a href={`mailto:${email}`}>{email}</a>
  ) : (
    <Link href="/#enquire">our contact form</Link>
  );

  return (
    <div style={{ minHeight: "100svh", background: "#0a0a0b", color: "#e4e4e7", fontFamily: "var(--font-manrope), sans-serif", lineHeight: 1.7 }}>
      <header style={{ borderBottom: "1px solid #1f1f23" }}>
        <div style={{ maxWidth: "820px", margin: "0 auto", padding: "22px 20px" }}>
          <Link href="/" className="chrome" style={{ fontFamily: "var(--font-cinzel), serif", fontSize: "20px", letterSpacing: "0.32em", textDecoration: "none" }}>
            ECRAM EXECS
          </Link>
        </div>
      </header>
      <main id="main" style={{ maxWidth: "820px", margin: "0 auto", padding: "64px 20px 96px", display: "flex", flexDirection: "column", gap: "40px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <span style={{ fontFamily: "var(--font-cinzel), serif", fontSize: "12px", letterSpacing: "0.42em", color: "#8e8e96" }}>PRIVACY</span>
          <h1 style={{ margin: 0, fontFamily: "var(--font-cormorant), serif", fontWeight: 300, fontSize: "clamp(36px, 6vw, 56px)", lineHeight: 1.08, color: "#ffffff" }}>
            Privacy policy
          </h1>
          <p style={{ margin: 0, color: "#8e8e96", fontSize: "14px" }}>Last updated: {LAST_UPDATED}</p>
        </div>

        <Section title="Who we are">
          <p style={{ margin: 0 }}>
            {siteConfig.name} provides executive chauffeur services in the Netherlands and is the controller of the personal data described
            here{address ? <>, registered at {address}, Netherlands</> : null}
            {siteConfig.kvk ? <> (KvK {siteConfig.kvk})</> : null}. Questions about this policy can be sent to {contactLine}.
          </p>
        </Section>

        <Section title="What we collect and why">
          <p style={{ margin: 0 }}>
            When you request a quotation we collect your name, email address, phone number, the collection point, destination, date and time
            of your journey, the service and number of passengers you select, and any notes you add. We use this only to prepare and send your
            quotation, arrange your journey and contact you about it. The legal basis is taking steps at your request before entering into a
            contract (Article 6(1)(b) GDPR).
          </p>
          <p style={{ margin: 0 }}>
            To protect the form against abuse we also store a one-way, salted hash of your IP address and your browser&apos;s user-agent
            string. The hash cannot be turned back into your IP address. The legal basis is our legitimate interest in keeping the service
            secure (Article 6(1)(f) GDPR).
          </p>
        </Section>

        <Section title="Cookies">
          <p style={{ margin: 0 }}>
            The public website does not use tracking or advertising cookies. A strictly necessary session cookie is used only when our staff
            sign in to the internal reservations system.
          </p>
        </Section>

        <Section title="Who processes your data">
          <p style={{ margin: 0 }}>We use carefully selected service providers who process data on our behalf under data processing agreements:</p>
          <ul style={{ margin: 0, paddingLeft: "20px" }}>
            <li>Vercel — website hosting</li>
            <li>Supabase — database hosting, in the European Union</li>
            <li>Resend — delivery of email notifications about your request</li>
          </ul>
          <p style={{ margin: 0 }}>We do not sell your data or share it with third parties for marketing.</p>
        </Section>

        <Section title="How long we keep it">
          <p style={{ margin: 0 }}>
            Quotation requests are kept for up to 24 months after our last contact with you, so we can handle follow-up questions and repeat
            bookings. Information that forms part of our financial records is kept for seven years, as Dutch tax law requires. You can ask us
            to delete your request at any time.
          </p>
        </Section>

        <Section title="Your rights">
          <p style={{ margin: 0 }}>
            You have the right to access, correct or delete your personal data, to restrict or object to its processing, and to receive it in
            a portable format. Contact us at {contactLine} and we will respond within one month. You also have the right to lodge a complaint
            with the Dutch Data Protection Authority (
            <a href="https://autoriteitpersoonsgegevens.nl" target="_blank" rel="noopener noreferrer">
              Autoriteit Persoonsgegevens
            </a>
            ).
          </p>
        </Section>

        <Section title="Security">
          <p style={{ margin: 0 }}>
            Your data is transmitted over encrypted connections and stored in access-controlled systems. Only authorised staff can view
            quotation requests.
          </p>
        </Section>

        <Link href="/" style={{ fontSize: "12px", letterSpacing: "0.24em", textTransform: "uppercase" }}>
          ← Back to the homepage
        </Link>
      </main>
    </div>
  );
}
