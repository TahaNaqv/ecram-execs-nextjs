import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import type { DriverApplication, QuoteRequest } from "@/lib/db/schema";
import { colourLabel, makeLabel } from "@/lib/partners/criteria";
import { serviceLabel } from "@/lib/quotes/constants";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { interpolate } from "@/lib/i18n/interpolate";
import { localizedPath } from "@/lib/i18n/pathnames";
import { vehicleByKey } from "@/lib/fleet/vehicles";
import { amsterdamNow } from "@/lib/quotes/validation";
import { stopsWithWaits } from "@/lib/quotes/stops";
import { siteConfig } from "@/lib/site-config";

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Emails the team about a new quote request. No-op (logged) when no mail provider is configured. */
export async function notifyNewQuote(q: QuoteRequest) {
  const { EMAIL_FROM, NOTIFY_EMAIL_TO } = process.env;
  if (!provider() || !EMAIL_FROM || !NOTIFY_EMAIL_TO) {
    console.info(`[quote] ${q.reference} saved; email alert skipped (no RESEND_API_KEY or SMTP_*, or EMAIL_FROM / NOTIFY_EMAIL_TO not set)`);
    return;
  }
  const site = process.env.SITE_URL ?? "";
  // Internal alert — deliberately always English (D7); only the service key needs a label.
  const { services, bespokeSection: bespokeLabels } = await getDictionary("en");
  const bespoke = q.service === "bespoke";
  const rows: [string, string | number | null][] = [
    ["Reference", q.reference],
    ["Service", serviceLabel(q.service, services)],
    ["Collection", q.collection],
    ["Destination", q.destination],
    [
      "Additional stops",
      q.destinations && q.destinations.length > 0
        ? stopsWithWaits(q.destinations, q.destinationWaits)
            .map((s) => (s.wait > 0 ? `${s.place} (waits ${s.wait} min)` : s.place))
            .join(" → ")
        : null,
    ],
    ["Date & time (NL)", q.pickupAt && q.pickupAt.slice(0, 16).replace("T", " ")],
    ["Corporate entity / account", q.entity],
    [bespoke ? "Delegation size" : "Passengers", q.passengers],
    ["Vehicle class", q.vehicleClass && (bespokeLabels.vehicleClasses as Record<string, string>)[q.vehicleClass]],
    ["Vehicle", q.vehicle && (vehicleByKey(q.vehicle)?.name ?? (q.vehicle === "advise" ? "Advise me" : q.vehicle))],
    ["Itinerary & instructions", q.itinerary],
    ["Preferred contact", q.contactPreference && ({ whatsapp: "WhatsApp", email: "Email" }[q.contactPreference] ?? "Phone")],
    ["Name", q.name],
    ["Email", q.email],
    ["Phone", q.phone],
    ["Notes", q.notes],
    ["Source", q.corporateContactId ? "Verified Corporate Partner" : null],
    ["KvK / company number", q.entityKvk],
  ];
  const html = teamAlert(`New ${bespoke ? "bespoke inquiry" : "quote request"} <strong>${esc(q.reference)}</strong>`, rows, site && `${site}/admin/requests/${q.id}`);

  await send("quote", q.reference, "team alert", {
    from: EMAIL_FROM,
    to: NOTIFY_EMAIL_TO.split(",").map((s) => s.trim()),
    reply_to: q.email,
    subject: `New ${bespoke ? "bespoke inquiry" : "quote request"} ${q.reference} — ${serviceLabel(q.service, services)}${q.pickupAt ? `, ${q.pickupAt.slice(0, 10)}` : ""}`,
    html,
  });
}

/** Confirms receipt to the client. No-op when no mail provider is configured. */
export async function confirmToClient(q: QuoteRequest) {
  const { EMAIL_FROM } = process.env;
  if (!provider() || !EMAIL_FROM) return;
  const first = q.name.split(" ")[0];
  const { phone, email } = siteConfig.contact;
  // The confirmation goes out in the language the visitor filled the form in (stored on the row).
  const { email: t, services } = await getDictionary(q.locale);
  const row = (label: string, value: string) =>
    `<tr><td style="color:#71717a">${esc(label)}</td><td>${esc(value)}</td></tr>`;
  const bespoke = q.service === "bespoke";
  const channel = q.contactPreference === "whatsapp" ? t.channelWhatsapp : q.contactPreference === "email" ? t.channelEmail : t.channelPhone;
  const details = bespoke
    ? [row(t.fieldReference, q.reference), row(t.fieldService, serviceLabel(q.service, services)), q.entity ? row(t.fieldEntity, q.entity) : ""]
    : [
        row(t.fieldReference, q.reference),
        row(t.fieldService, serviceLabel(q.service, services)),
        row(t.fieldCollection, q.collection ?? ""),
        row(t.fieldDestination, q.destination ?? ""),
        row(t.fieldDateTime, (q.pickupAt ?? "").slice(0, 16).replace("T", " ")),
      ];
  const html = `
    <div style="font-family:Georgia,serif;font-size:15px;line-height:1.6;color:#0a0a0b;max-width:560px">
      <p style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:3px;color:#71717a">${esc(t.tagline)}</p>
      <p>${esc(interpolate(t.greeting, { name: first }))}</p>
      <p>${esc(bespoke ? interpolate(t.bespokeIntro, { channel }) : t.quoteIntro)}</p>
      <table cellpadding="4" style="font-family:Arial,sans-serif;font-size:13px;border-collapse:collapse;margin:16px 0">
        ${details.join("")}
      </table>
      <p>${esc(phone ? interpolate(t.quoteReplyPhone, { phone }) : t.quoteReply)}</p>
      <p>${esc(t.signoff)}<br>Ecram Execs</p>
    </div>`;
  await send("quote", q.reference, "client confirmation", {
    from: EMAIL_FROM,
    to: [q.email],
    ...(email || process.env.NOTIFY_EMAIL_TO ? { reply_to: email || process.env.NOTIFY_EMAIL_TO!.split(",")[0].trim() } : {}),
    subject: interpolate(bespoke ? t.bespokeSubject : t.quoteSubject, { reference: q.reference }),
    html,
  });
}

/** Emails the team about a new driver application. No-op (logged) when no mail provider is configured. */
export async function notifyNewApplication(a: DriverApplication) {
  const { EMAIL_FROM, NOTIFY_EMAIL_TO } = process.env;
  if (!provider() || !EMAIL_FROM || !NOTIFY_EMAIL_TO) {
    console.info(`[application] ${a.reference} saved; email alert skipped (no RESEND_API_KEY or SMTP_*, or EMAIL_FROM / NOTIFY_EMAIL_TO not set)`);
    return;
  }
  const site = process.env.SITE_URL ?? "";
  // Internal alert — deliberately always English (D7).
  const { criteria } = await getDictionary("en");
  const vehicle = a.make ? `${makeLabel(a.make)} ${a.model ?? ""}`.trim() : null;
  const rows: [string, string | number | null][] = [
    ["Reference", a.reference],
    ["Name", a.name],
    ["Email", a.email],
    ["Phone", a.phone],
    ["KvK", a.kvk],
    ["Experience", `${a.experienceYears} years`],
    ["Licence plate", a.plate],
    ["Vehicle", vehicle ?? "Not verified — the RDW could not be reached, please check the plate by hand"],
    ["Colour", a.colour && colourLabel(a.colour, criteria.colours)],
    ["First registered", a.firstRegistered],
    ["Documents", a.documents ? `${a.documents.length} uploaded — open them from the application in the admin` : null],
    ["Notes", a.notes],
  ];
  const html = teamAlert(`New driver application <strong>${esc(a.reference)}</strong>`, rows, site && `${site}/admin/drivers/applications/${a.id}`);
  await send("application", a.reference, "team alert", {
    from: EMAIL_FROM,
    to: NOTIFY_EMAIL_TO.split(",").map((s) => s.trim()),
    reply_to: a.email,
    subject: `New driver application ${a.reference} — ${vehicle ?? a.plate}`,
    html,
  });
}

/** Confirms receipt to the applicant. No-op when no mail provider is configured. */
export async function confirmApplication(a: DriverApplication) {
  const { EMAIL_FROM } = process.env;
  if (!provider() || !EMAIL_FROM) return;
  const first = a.name.split(" ")[0];
  const { email } = siteConfig.contact;
  const { email: t } = await getDictionary(a.locale);
  const row = (label: string, value: string) =>
    `<tr><td style="color:#71717a">${esc(label)}</td><td>${esc(value)}</td></tr>`;
  const html = `
    <div style="font-family:Georgia,serif;font-size:15px;line-height:1.6;color:#0a0a0b;max-width:560px">
      <p style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:3px;color:#71717a">${esc(t.tagline)}</p>
      <p>${esc(interpolate(t.greeting, { name: first }))}</p>
      <p>${esc(t.applicationIntro)}</p>
      <table cellpadding="4" style="font-family:Arial,sans-serif;font-size:13px;border-collapse:collapse;margin:16px 0">
        ${row(t.fieldReference, a.reference)}
        ${row(t.fieldPlate, a.plate)}
        ${a.make ? row(t.fieldVehicle, `${makeLabel(a.make)} ${a.model ?? ""}`.trim()) : ""}
      </table>
      <p>${esc(t.applicationBring)}</p>
      <p>${esc(t.signoff)}<br>Ecram Execs</p>
    </div>`;
  await send("application", a.reference, "applicant confirmation", {
    from: EMAIL_FROM,
    to: [a.email],
    ...(email || process.env.NOTIFY_EMAIL_TO ? { reply_to: email || process.env.NOTIFY_EMAIL_TO!.split(",")[0].trim() } : {}),
    subject: interpolate(t.applicationSubject, { reference: a.reference }),
    html,
  });
}

/**
 * Sends the six-digit code for the Corporate Partner area, in the visitor's language. Unlike the
 * alerts above this reports whether it worked: someone is waiting on the other end for the code,
 * so a failed send has to be shown to them rather than swallowed.
 */
export async function sendVerificationCode({
  email,
  name,
  code,
  locale,
  minutes,
  purpose,
}: {
  email: string;
  name: string;
  code: string;
  locale: QuoteRequest["locale"];
  minutes: number;
  /** "signup" creates an account (or sets a new password for an address that has one); "reset" is a forgotten password. */
  purpose: "signup" | "reset";
}): Promise<boolean> {
  const isDev = process.env.NODE_ENV !== "production";
  if (isDev) {
    console.info(`\n==================================================\n[corporate] [DEV MODE] Verification Code for ${email}: ${code} (purpose: ${purpose})\n==================================================\n`);
  }

  const { EMAIL_FROM } = process.env;
  if (!provider() || !EMAIL_FROM) {
    console.warn("[corporate] verification code not sent: no RESEND_API_KEY or SMTP_*, or EMAIL_FROM not set");
    return isDev;
  }
  const { email: t } = await getDictionary(locale);
  const html = `
    <div style="font-family:Georgia,serif;font-size:15px;line-height:1.6;color:#0a0a0b;max-width:560px">
      <p style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:3px;color:#71717a">${esc(t.tagline)}</p>
      <p>${esc(interpolate(t.greeting, { name: name.split(" ")[0] }))}</p>
      <p>${esc(purpose === "reset" ? t.resetIntro : t.codeIntro)}</p>
      <p style="font-family:Arial,sans-serif;font-size:32px;letter-spacing:10px;font-weight:bold;margin:20px 0">${esc(code)}</p>
      <p style="color:#52525b">${esc(interpolate(t.codeExpiry, { minutes: String(minutes) }))}</p>
      <p>${esc(t.signoff)}<br>Ecram Execs</p>
    </div>`;
  const sent = await send("corporate", email, "verification code", {
    from: EMAIL_FROM,
    to: [email],
    subject: purpose === "reset" ? t.resetSubject : t.codeSubject,
    html,
  });

  if (!sent && isDev) {
    console.warn(`[corporate] [DEV MODE] Email dispatch failed (e.g. Resend restrictions or timeout). Bypassing failure in local dev; use code: ${code}`);
    return true;
  }
  return sent;
}

/**
 * Tells the owner of an address that the password of their Corporate Partner account was just replaced, with the way
 * back in if it wasn't them. Best-effort: the change has already happened, so a failure is logged, not shown.
 */
export async function sendPasswordChanged({ email, name, locale }: { email: string; name: string; locale: QuoteRequest["locale"] }) {
  const { EMAIL_FROM, SITE_URL } = process.env;
  if (!provider() || !EMAIL_FROM) return false;
  const { email: t } = await getDictionary(locale);
  const link = `${SITE_URL ?? ""}${localizedPath("/corporate-partner/forgot-password", locale)}`;
  const html = `
    <div style="font-family:Georgia,serif;font-size:15px;line-height:1.6;color:#0a0a0b;max-width:560px">
      <p style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:3px;color:#71717a">${esc(t.tagline)}</p>
      <p>${esc(interpolate(t.greeting, { name: name.split(" ")[0] }))}</p>
      <p>${esc(t.passwordChangedBody)}</p>
      <p><a href="${esc(link)}">${esc(t.passwordChangedLink)}</a></p>
      <p>${esc(t.signoff)}<br>Ecram Execs</p>
    </div>`;
  return send("corporate", email, "password changed", { from: EMAIL_FROM, to: [email], subject: t.passwordChangedSubject, html });
}

export type PartnerActivity = "accepted" | "declined" | "message" | "change" | "cancel";

const PARTNER_ACTIVITY_LABEL: Record<PartnerActivity, string> = {
  accepted: "Quote accepted",
  declined: "Quote declined",
  message: "New message",
  change: "Change requested",
  cancel: "Cancellation requested",
};

/**
 * Tells the team what a partner did on one of their bookings. Internal, so always English like the other team
 * alerts; whatever the partner wrote is escaped by the table renderer. A change or cancellation of a trip that is
 * less than a day away is flagged in the subject, because someone has to act on it today.
 */
export async function notifyTeamPartnerActivity({
  request: q,
  partner,
  kind,
  body,
}: {
  request: QuoteRequest;
  partner: { name: string; email: string };
  kind: PartnerActivity;
  /** The message, or the reason given when declining */
  body?: string | null;
}) {
  const { EMAIL_FROM, NOTIFY_EMAIL_TO } = process.env;
  if (!provider() || !EMAIL_FROM || !NOTIFY_EMAIL_TO) {
    console.info(`[portal] ${q.reference} ${kind}: email alert skipped (no mail provider, or EMAIL_FROM / NOTIFY_EMAIL_TO not set)`);
    return;
  }
  const site = process.env.SITE_URL ?? "";
  // Within the next day, or started in the last few hours: a cancellation of a trip already underway is the most urgent
  const soon = (kind === "change" || kind === "cancel") && !!q.pickupAt && q.pickupAt >= amsterdamNow(-6 * 60) && q.pickupAt <= amsterdamNow(24 * 60);
  const label = PARTNER_ACTIVITY_LABEL[kind];
  const rows: [string, string | number | null][] = [
    ["Reference", q.reference],
    ["Partner", partner.name],
    ["Company", q.entity],
    ["Email", partner.email],
    ["Date & time (NL)", q.pickupAt && q.pickupAt.slice(0, 16).replace("T", " ")],
    ["Pick-up within 24 hours", soon ? "Yes — please act today" : null],
    ["Quoted amount", q.quotedAmount && `€ ${q.quotedAmount}`],
    [kind === "declined" ? "Reason" : "Message", body ?? null],
  ];
  await send("portal", q.reference, `team alert (${kind})`, {
    from: EMAIL_FROM,
    to: NOTIFY_EMAIL_TO.split(",").map((e) => e.trim()),
    reply_to: partner.email,
    subject: `[Partner] ${label} ${q.reference} — ${partner.name}${soon ? " (pick-up within 24h)" : ""}`,
    html: teamAlert(`${esc(label)} on <strong>${esc(q.reference)}</strong>`, rows, site && `${site}/admin/requests/${q.id}`),
  });
}

export type PartnerEmailKind = "quoted" | "confirmed" | "completed" | "cancelled" | "reply" | "invoice";

const euro = (amount: string | null, locale: QuoteRequest["locale"]) =>
  amount === null ? "" : new Intl.NumberFormat(locale === "nl" ? "nl-NL" : "en-GB", { style: "currency", currency: "EUR" }).format(Number(amount));

/**
 * Emails the partner about one of their bookings, in their language, with a link straight to it. Best-effort: the
 * change has already happened, so a failed send is logged, not shown.
 */
export async function emailPartnerBooking({
  request: q,
  to,
  kind,
  message,
}: {
  request: QuoteRequest;
  to: { email: string; name: string; locale: QuoteRequest["locale"] };
  kind: PartnerEmailKind;
  /** The team's reply, for `reply` */
  message?: string | null;
}) {
  const { EMAIL_FROM, SITE_URL } = process.env;
  if (!provider() || !EMAIL_FROM) return false;
  const { email: t } = await getDictionary(to.locale);
  const copy: Record<PartnerEmailKind, [string, string]> = {
    quoted: [t.bookingSubjectQuoted, t.bookingIntroQuoted],
    confirmed: [t.bookingSubjectConfirmed, t.bookingIntroConfirmed],
    completed: [t.bookingSubjectCompleted, t.bookingIntroCompleted],
    cancelled: [t.bookingSubjectCancelled, t.bookingIntroCancelled],
    reply: [t.bookingSubjectReply, t.bookingIntroReply],
    invoice: [t.bookingSubjectInvoice, t.bookingIntroInvoice],
  };
  const values = { reference: q.reference, amount: euro(q.quotedAmount, to.locale) };
  const [subject, intro] = copy[kind];
  const link = `${SITE_URL ?? ""}${localizedPath("/corporate-partner/account/booking", to.locale)}?ref=${encodeURIComponent(q.reference)}`;
  const html = `
    <div style="font-family:Georgia,serif;font-size:15px;line-height:1.6;color:#0a0a0b;max-width:560px">
      <p style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:3px;color:#71717a">${esc(t.tagline)}</p>
      <p>${esc(interpolate(t.greeting, { name: to.name.split(" ")[0] }))}</p>
      <p>${esc(interpolate(intro, values))}</p>
      ${kind === "reply" && message ? `<blockquote style="margin:16px 0;padding:0 0 0 14px;border-left:3px solid #d4d4d8;color:#27272a">${esc(message).replace(/\n/g, "<br>")}</blockquote>` : ""}
      <p><a href="${esc(link)}">${esc(t.bookingOpenLink)}</a></p>
      <p>${esc(t.signoff)}<br>Ecram Execs</p>
    </div>`;
  return send("portal", q.reference, `partner email (${kind})`, { from: EMAIL_FROM, to: [to.email], subject: interpolate(subject, values), html });
}

function teamAlert(heading: string, rows: [string, string | number | null][], adminUrl: string) {
  return `
    <div style="font-family:Arial,sans-serif;font-size:14px;color:#0a0a0b">
      <p style="font-size:16px">${heading}</p>
      <table cellpadding="6" style="border-collapse:collapse">
        ${rows
          .filter(([, v]) => v !== null && v !== "")
          .map(
            ([k, v]) =>
              `<tr><td style="color:#52525b;vertical-align:top">${k}</td><td>${esc(String(v)).replace(/\n/g, "<br>")}</td></tr>`,
          )
          .join("")}
      </table>
      ${adminUrl ? `<p><a href="${esc(adminUrl)}">Open in admin</a></p>` : ""}
    </div>`;
}

/** Resend when RESEND_API_KEY is set (production, needs a verified domain); otherwise SMTP, e.g. Gmail or custom mail server. */
function provider(): "resend" | "smtp" | null {
  const { RESEND_API_KEY, SMTP_HOST, SMTP_USER, SMTP_PASS, EMAIL_PROVIDER } = process.env;
  if (EMAIL_PROVIDER === "smtp" && SMTP_HOST && SMTP_USER && SMTP_PASS) return "smtp";
  if (RESEND_API_KEY) return "resend";
  if (SMTP_HOST && SMTP_USER && SMTP_PASS) return "smtp";
  return null;
}

let smtp: Transporter | undefined;

type Payload = { from: string; to: string[]; reply_to?: string; subject: string; html: string };

async function sendSmtp(tag: string, reference: string, kind: string, payload: Payload): Promise<boolean> {
  try {
    const port = Number(process.env.SMTP_PORT ?? 465);
    smtp ??= nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      connectionTimeout: 10_000,
    });
    const { reply_to, ...rest } = payload;
    await smtp.sendMail({ ...rest, replyTo: reply_to });
    return true;
  } catch (err) {
    console.error(`[${tag}] ${reference} ${kind} via SMTP failed:`, err);
    return false;
  }
}

/** Resolves true only when the provider accepted the message, so a caller that must not leave someone waiting can tell. */
async function send(tag: string, reference: string, kind: string, payload: Payload): Promise<boolean> {
  const hasSmtp = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
  const activeProvider = provider();

  if (activeProvider === "smtp") {
    return sendSmtp(tag, reference, kind, payload);
  }

  if (activeProvider === "resend") {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error(`[${tag}] ${reference} ${kind} failed: ${res.status} ${errorText}`);
        if (errorText.includes("domain is not verified")) {
          console.warn(`[email] To send real emails from '${payload.from}', verify the domain at https://resend.com/domains by adding the required DNS records.`);
        }
        if (hasSmtp) {
          console.info(`[${tag}] Falling back to SMTP dispatch...`);
          return sendSmtp(tag, reference, kind, payload);
        }
        return false;
      }
      return true;
    } catch (err) {
      console.error(`[${tag}] ${reference} ${kind} failed`, err);
      if (hasSmtp) {
        console.info(`[${tag}] Falling back to SMTP dispatch...`);
        return sendSmtp(tag, reference, kind, payload);
      }
      return false;
    }
  }

  return false;
}
