import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import type { DriverApplication, QuoteRequest } from "@/lib/db/schema";
import { colourLabel, makeLabel } from "@/lib/partners/criteria";
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
  const rows: [string, string | number | null][] = [
    ["Reference", q.reference],
    ["Service", q.service],
    ["Collection", q.collection],
    ["Destination", q.destination],
    ["Date & time (NL)", q.pickupAt.slice(0, 16).replace("T", " ")],
    ["Passengers", q.passengers],
    ["Name", q.name],
    ["Email", q.email],
    ["Phone", q.phone],
    ["Notes", q.notes],
  ];
  const html = teamAlert(`New quote request <strong>${esc(q.reference)}</strong>`, rows, site && `${site}/admin/requests/${q.id}`);

  await send("quote", q.reference, "team alert", {
    from: EMAIL_FROM,
    to: NOTIFY_EMAIL_TO.split(",").map((s) => s.trim()),
    reply_to: q.email,
    subject: `New quote request ${q.reference} — ${q.service}, ${q.pickupAt.slice(0, 10)}`,
    html,
  });
}

/** Confirms receipt to the client. No-op when no mail provider is configured. */
export async function confirmToClient(q: QuoteRequest) {
  const { EMAIL_FROM } = process.env;
  if (!provider() || !EMAIL_FROM) return;
  const first = q.name.split(" ")[0];
  const { phone, email } = siteConfig.contact;
  const html = `
    <div style="font-family:Georgia,serif;font-size:15px;line-height:1.6;color:#0a0a0b;max-width:560px">
      <p style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:3px;color:#71717a">ECRAM EXECS · THE ART OF EXECUTIVE HOSPITALITY</p>
      <p>Dear ${esc(first)},</p>
      <p>Thank you for your request. A member of our team is preparing your tailored quotation and will be in touch shortly — usually within the hour.</p>
      <table cellpadding="4" style="font-family:Arial,sans-serif;font-size:13px;border-collapse:collapse;margin:16px 0">
        <tr><td style="color:#71717a">Reference</td><td>${esc(q.reference)}</td></tr>
        <tr><td style="color:#71717a">Service</td><td>${esc(q.service)}</td></tr>
        <tr><td style="color:#71717a">Collection</td><td>${esc(q.collection)}</td></tr>
        <tr><td style="color:#71717a">Destination</td><td>${esc(q.destination)}</td></tr>
        <tr><td style="color:#71717a">Date &amp; time</td><td>${esc(q.pickupAt.slice(0, 16).replace("T", " "))}</td></tr>
      </table>
      <p>If anything changes, simply reply to this email${phone ? ` or call us on ${esc(phone)}` : ""}.</p>
      <p>Kind regards,<br>Ecram Execs</p>
    </div>`;
  await send("quote", q.reference, "client confirmation", {
    from: EMAIL_FROM,
    to: [q.email],
    ...(email || process.env.NOTIFY_EMAIL_TO ? { reply_to: email || process.env.NOTIFY_EMAIL_TO!.split(",")[0].trim() } : {}),
    subject: `Your Ecram Execs request ${q.reference}`,
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
    ["Colour", a.colour && colourLabel(a.colour)],
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
  const html = `
    <div style="font-family:Georgia,serif;font-size:15px;line-height:1.6;color:#0a0a0b;max-width:560px">
      <p style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:3px;color:#71717a">ECRAM EXECS · THE ART OF EXECUTIVE HOSPITALITY</p>
      <p>Dear ${esc(first)},</p>
      <p>Thank you for applying to drive with Ecram Execs. Our team will review your application and contact you to arrange a short introduction and an inspection of your car.</p>
      <table cellpadding="4" style="font-family:Arial,sans-serif;font-size:13px;border-collapse:collapse;margin:16px 0">
        <tr><td style="color:#71717a">Reference</td><td>${esc(a.reference)}</td></tr>
        <tr><td style="color:#71717a">Licence plate</td><td>${esc(a.plate)}</td></tr>
        ${a.make ? `<tr><td style="color:#71717a">Vehicle</td><td>${esc(`${makeLabel(a.make)} ${a.model ?? ""}`)}</td></tr>` : ""}
      </table>
      <p>Please bring the originals of your documents and your Kiwa licence to the introduction. If you have any questions, simply reply to this email.</p>
      <p>Kind regards,<br>Ecram Execs</p>
    </div>`;
  await send("application", a.reference, "applicant confirmation", {
    from: EMAIL_FROM,
    to: [a.email],
    ...(email || process.env.NOTIFY_EMAIL_TO ? { reply_to: email || process.env.NOTIFY_EMAIL_TO!.split(",")[0].trim() } : {}),
    subject: `Your Ecram Execs driver application ${a.reference}`,
    html,
  });
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

async function send(tag: string, reference: string, kind: string, payload: Payload) {
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
      return;
    }
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) console.error(`[${tag}] ${reference} ${kind} failed: ${res.status} ${await res.text()}`);
  } catch (err) {
    console.error(`[${tag}] ${reference} ${kind} failed`, err);
  }
}
