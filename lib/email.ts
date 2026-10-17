import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import type { DriverApplication, QuoteRequest } from "@/lib/db/schema";
import { colourLabel, makeLabel } from "@/lib/partners/criteria";
import { serviceLabel } from "@/lib/quotes/constants";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { interpolate } from "@/lib/i18n/interpolate";
import { vehicleByKey } from "@/lib/fleet/vehicles";
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
    ["Additional stops", q.destinations && q.destinations.length > 0 ? q.destinations.join(" → ") : null],
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
}: {
  email: string;
  name: string;
  code: string;
  locale: QuoteRequest["locale"];
  minutes: number;
}): Promise<boolean> {
  const { EMAIL_FROM } = process.env;
  if (!provider() || !EMAIL_FROM) {
    console.warn("[corporate] verification code not sent: no RESEND_API_KEY or SMTP_*, or EMAIL_FROM not set");
    return false;
  }
  const { email: t } = await getDictionary(locale);
  const html = `
    <div style="font-family:Georgia,serif;font-size:15px;line-height:1.6;color:#0a0a0b;max-width:560px">
      <p style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:3px;color:#71717a">${esc(t.tagline)}</p>
      <p>${esc(interpolate(t.greeting, { name: name.split(" ")[0] }))}</p>
      <p>${esc(t.codeIntro)}</p>
      <p style="font-family:Arial,sans-serif;font-size:32px;letter-spacing:10px;font-weight:bold;margin:20px 0">${esc(code)}</p>
      <p style="color:#52525b">${esc(interpolate(t.codeExpiry, { minutes: String(minutes) }))}</p>
      <p>${esc(t.signoff)}<br>Ecram Execs</p>
    </div>`;
  return send("corporate", email, "verification code", { from: EMAIL_FROM, to: [email], subject: t.codeSubject, html });
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

/** Resend when RESEND_API_KEY is set (production, needs a verified domain); otherwise SMTP, e.g. Gmail for demos. */
function provider(): "resend" | "smtp" | null {
  const { RESEND_API_KEY, SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env;
  if (RESEND_API_KEY) return "resend";
  if (SMTP_HOST && SMTP_USER && SMTP_PASS) return "smtp";
  return null;
}

let smtp: Transporter | undefined;

type Payload = { from: string; to: string[]; reply_to?: string; subject: string; html: string };

/** Resolves true only when the provider accepted the message, so a caller that must not leave someone waiting can tell. */
async function send(tag: string, reference: string, kind: string, payload: Payload): Promise<boolean> {
  try {
    if (provider() === "smtp") {
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
    }
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error(`[${tag}] ${reference} ${kind} failed: ${res.status} ${await res.text()}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[${tag}] ${reference} ${kind} failed`, err);
    return false;
  }
}
