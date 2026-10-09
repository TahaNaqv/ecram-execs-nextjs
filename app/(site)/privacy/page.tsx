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

const LAST_UPDATED = "9 October 2026";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="m-0 font-serif text-[28px] font-normal text-white">{title}</h2>
      <div className="flex flex-col gap-3 font-light text-ink-300">{children}</div>
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
    <div className="min-h-svh bg-ink-950 font-sans leading-[1.7] text-ink-150">
      <header className="border-b border-ink-850">
        <div className="mx-auto max-w-[820px] px-5 py-[22px]">
          <Link href="/" className="chrome font-display text-[20px] tracking-[0.32em] no-underline">
            ECRAM EXECS
          </Link>
        </div>
      </header>
      <main id="main" className="mx-auto flex max-w-[820px] flex-col gap-10 px-5 pt-16 pb-24">
        <div className="flex flex-col gap-3">
          <span className="font-display text-[12px] tracking-[0.42em] text-ink-450">PRIVACY</span>
          <h1 className="m-0 font-serif text-[clamp(36px,6vw,56px)] leading-[1.08] font-light text-white">
            Privacy policy
          </h1>
          <p className="m-0 text-[14px] text-ink-450">Last updated: {LAST_UPDATED}</p>
        </div>

        <Section title="Who we are">
          <p className="m-0">
            {siteConfig.name} provides executive chauffeur services in the Netherlands and is the controller of the personal data described
            here{address ? <>, registered at {address}, Netherlands</> : null}
            {siteConfig.kvk ? <> (KvK {siteConfig.kvk})</> : null}. Questions about this policy can be sent to {contactLine}.
          </p>
        </Section>

        <Section title="What we collect and why">
          <p className="m-0">
            When you request a quotation we collect your name, email address, phone number, the collection point, destination, date and time
            of your journey, the service and number of passengers you select, and any notes you add. We use this only to prepare and send your
            quotation, arrange your journey and contact you about it. The legal basis is taking steps at your request before entering into a
            contract (Article 6(1)(b) GDPR).
          </p>
          <p className="m-0">
            When you apply to drive with us we collect your name, email address, phone number, KvK number, years of driving experience, your
            car&apos;s licence plate and any notes you add. We look the plate up in the public register of the RDW (the Dutch vehicle
            authority) to check the car against our criteria, and store the make, model, colour, seating, registration dates and taxi
            registration it returns. We use this only to assess your application and, if it is approved, to work with you. The legal basis
            is taking steps at your request before entering into a contract (Article 6(1)(b) GDPR).
          </p>
          <p className="m-0">
            To protect the forms against abuse we also store a one-way, salted hash of your IP address and your browser&apos;s user-agent
            string. The hash cannot be turned back into your IP address. The legal basis is our legitimate interest in keeping the service
            secure (Article 6(1)(f) GDPR).
          </p>
        </Section>

        <Section title="Cookies">
          <p className="m-0">
            The public website does not use tracking or advertising cookies. A strictly necessary session cookie is used only when our staff
            sign in to the internal reservations system.
          </p>
        </Section>

        <Section title="Who processes your data">
          <p className="m-0">We use carefully selected service providers who process data on our behalf under data processing agreements:</p>
          <ul className="m-0 list-disc pl-5">
            <li>Vercel — website hosting</li>
            <li>Supabase — database hosting, in the European Union</li>
            <li>Resend — delivery of email notifications about your request</li>
          </ul>
          <p className="m-0">We do not sell your data or share it with third parties for marketing.</p>
        </Section>

        <Section title="How long we keep it">
          <p className="m-0">
            Quotation requests are kept for up to 24 months after our last contact with you, so we can handle follow-up questions and repeat
            bookings. Driver applications that do not lead to a partnership are kept for up to 12 months. Information that forms part of our financial records is kept for seven years, as Dutch tax law requires. You can ask us
            to delete your request at any time.
          </p>
        </Section>

        <Section title="Your rights">
          <p className="m-0">
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
          <p className="m-0">
            Your data is transmitted over encrypted connections and stored in access-controlled systems. Only authorised staff can view
            quotation requests and driver applications.
          </p>
        </Section>

        <Link href="/" className="text-[12px] tracking-[0.24em] uppercase">
          ← Back to the homepage
        </Link>
      </main>
    </div>
  );
}
