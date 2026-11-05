"use client";

import React, { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { QuoteRequest } from "@/lib/db/schema";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { interpolate } from "@/lib/i18n/interpolate";

type PricingCopy = Dictionary["admin"]["pricing"];
type StatusCopy = Dictionary["admin"]["statuses"];
const STATUSES = ["new", "confirmed", "completed", "cancelled"] as const;
type StatusChoice = (typeof STATUSES)[number];

const asStatus = (value: string): StatusChoice => ((STATUSES as readonly string[]).includes(value) ? (value as StatusChoice) : "new");

function esc(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}

/** The total the visitor confirmed: the stored rate-card total, or the amount already on the row. Never a new calculation. */
function lockedTotal(request: QuoteRequest): number | null {
  const snap = storedQuoteEuros(request.priceEstimate);
  if (snap != null) return Number(snap);
  if (request.quotedAmount == null || request.quotedAmount === "") return null;
  const amount = Number(request.quotedAmount);
  return Number.isFinite(amount) ? amount : null;
}

/** The stored rate-card lines, in euros. Empty when the booking has no snapshot. */
function fareRows(price: Price | null, copy: PricingCopy): { label: string; amount: number }[] {
  if (!price || typeof price.total !== "number") return [];
  const rows = [
    { label: copy.baseFare, amount: price.rides / 100 },
    { label: copy.btw9, amount: price.vat / 100 },
    { label: copy.serviceFee, amount: price.fee / 100 },
  ];
  if (price.feeVat) rows.push({ label: copy.serviceFeeVat, amount: price.feeVat / 100 });
  return rows;
}
import { formatEuro, formatTimestamp, pickupParts } from "@/lib/admin/format";
import { storedQuoteEuros, type Price } from "@/lib/pricing/rates";
import { convoyTitle, vehicleByKey } from "@/lib/fleet/vehicles";
import { 
  ShieldIcon,
  CheckIcon,
  XIcon,
  CalendarIcon,
  ClockIcon,
  UsersIcon,
  BriefcaseIcon,
  MailIcon,
  ChatIcon
} from "./icons";

/** The booking's route as Google's map knows it (see lib/fleet/map.ts), with the words around it */
export type RouteMapProps = { embed: string | null; open: string; openLabel: string; noKey: string; frameTitle: string };

export function AutoPricingGateway({
  request,
  copy,
  statuses,
  routeMap,
  addOns,
  children,
}: {
  request: QuoteRequest;
  copy: PricingCopy;
  statuses: StatusCopy;
  routeMap?: RouteMapProps | null;
  /** The add-ons to have ready in the car, as one line ("1 × Luxury Floral Arrangement"), or nothing */
  addOns?: string | null;
  /** Sits above Authorisation in the left column, usually the rate-card price */
  children?: React.ReactNode;
}) {
  const router = useRouter();
  // Confirmed status stored from the request/backend
  const [status, setStatus] = useState<StatusChoice>(asStatus(request.status));
  // Temporary dropdown choice before confirmation button is clicked
  const [selectedStatus, setSelectedStatus] = useState<StatusChoice>(asStatus(request.status));
  
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);

  const fare = fareRows(request.priceEstimate, copy);
  const grandTotal = lockedTotal(request);

  // Real data extracted from request
  const collection = request.collection ?? "—";
  const destination = request.destination ?? (request.durationHours ? interpolate(copy.hoursAsDirected, { hours: request.durationHours }) : "—");
  const stopovers = request.destinations ?? [];
  const stopWaits = request.destinationWaits ?? [];
  const pickup = request.pickupAt ? pickupParts(request.pickupAt) : null;

  // Notify Client Button: Commits the selected status and dispatches email (including on cancel).
  // The amount is not sent: the server keeps the total stored when the booking was submitted.
  async function handleSend() {
    setLoading(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
    try {
      const res = await fetch(`/api/admin/requests/${request.id}/authorise`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status: selectedStatus,
          sendMail: true,
          ...(selectedStatus === "cancelled" ? { sendCancellationEmail: true } : {}),
        })
      });
      const data = await res.json().catch(() => ({}));
      console.log("Resend Mail Response:", data);

      // Refused (e.g. the car is already booked at that time): nothing was saved, so the status stays as it was
      if (!res.ok) {
        setSelectedStatus(status);
        setToast(typeof data.error === "string" ? data.error : "Could not save the change.");
        return;
      }

      setStatus(selectedStatus); // Commit status change
      if (data.warning || data.error) {
        setToast(`Sent with note: Check terminal for Resend logs.`);
      } else {
        setToast(selectedStatus === "cancelled" ? "Cancellation email dispatched!" : "Email Dispatched!");
      }
      router.refresh();
    } catch (err) {
      console.error("Resend Mail Dispatch Error:", err);
      setToast("Error sending email. Check server terminal logs.");
    } finally {
      setLoading(false);
      setTimeout(() => setToast(null), 4000);
    }
  }

  function printQuote() {
    const vehicleName = convoyTitle(request) ?? (request.vehicle ? (vehicleByKey(request.vehicle)?.name ?? request.vehicle) : "—");
    const when = [pickup?.date, pickup?.time].filter(Boolean).join(" · ") || "—";
    const issued = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Amsterdam",
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date());
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Ecram Execs booking ${esc(request.reference)}</title>
<style>
  @page { size: A4 portrait; margin: 18mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: #fff; color: #111; font-family: "Segoe UI", Helvetica, Arial, sans-serif; }
  body { padding: 0; }
  .brand { margin: 0; font-size: 12px; font-weight: 700; letter-spacing: 0.34em; text-transform: uppercase; color: #065f46; }
  h1 { margin: 14px 0 0; font-size: 22px; line-height: 1.2; }
  .ref { margin: 8px 0 0; font-family: ui-monospace, Consolas, monospace; font-size: 12px; color: #3f3f46; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; margin-top: 28px; padding: 18px 0; border-top: 1px solid #d4d4d8; border-bottom: 1px solid #d4d4d8; }
  .k { margin: 0; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #71717a; }
  .v { margin: 6px 0 0; font-size: 14px; font-weight: 600; }
  p { margin: 2px 0 0; font-size: 13px; }
  table { width: 100%; margin-top: 22px; border-collapse: collapse; }
  td { padding: 10px 0; border-bottom: 1px solid #e4e4e7; font-size: 14px; vertical-align: top; }
  td.amt { text-align: right; font-family: ui-monospace, Consolas, monospace; font-weight: 600; white-space: nowrap; }
  tr.total td { border-bottom: 0; border-top: 2px solid #111; padding-top: 14px; font-size: 16px; font-weight: 700; }
  tr.total td.amt { color: #065f46; }
  footer { margin-top: 48px; padding-top: 14px; border-top: 1px solid #e4e4e7; text-align: center; font-size: 11px; color: #71717a; }
</style>
</head>
<body>
  <p class="brand">Ecram Execs</p>
  <h1>${esc(copy.quoteHeading)}</h1>
  <p class="ref">${esc(copy.reference)} ${esc(request.reference)} · ${esc(issued)}</p>
  <div class="meta">
    <div>
      <p class="k">Client</p>
      <p class="v">${esc(request.name)}</p>
      <p>${esc(request.email)}</p>
      <p>${esc(request.phone)}</p>
    </div>
    <div>
      <p class="k">${esc(copy.itinerary)}</p>
      <p class="v">${esc(collection)} → ${esc(destination)}</p>
      <p>${esc(when)}</p>
      <p>${esc(vehicleName)}${request.passengers != null ? ` · ${esc(String(request.passengers))}` : ""}${request.luggage != null ? ` · ${esc(String(request.luggage))} large` : ""}${request.handLuggage ? ` · ${esc(String(request.handLuggage))} small` : ""}</p>
    </div>
  </div>
  <table>
    ${fare.map((row) => `<tr><td>${esc(row.label)}</td><td class="amt">${esc(formatEuro(row.amount))}</td></tr>`).join("")}
    <tr class="total"><td>${esc(copy.finalAmount)}</td><td class="amt">${esc(formatEuro(grandTotal))}</td></tr>
  </table>
  <footer>Ecram Execs Chauffeur Services · Amsterdam, Netherlands</footer>
</body>
</html>`;

    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = "position:fixed;inset:0;width:100%;height:100%;border:0;z-index:2147483647;background:#fff;";
    document.body.appendChild(frame);
    const win = frame.contentWindow;
    const doc = frame.contentDocument;
    if (!win || !doc) {
      frame.remove();
      return;
    }
    const previousTitle = document.title;
    document.title = `Ecram Execs booking ${request.reference}`;
    doc.open();
    doc.write(html);
    doc.close();
    let closed = false;
    const finish = () => {
      if (closed) return;
      closed = true;
      document.title = previousTitle;
      frame.remove();
    };
    win.onafterprint = finish;
    setTimeout(() => {
      win.focus();
      win.print();
    }, 50);
  }

  function handleWhatsappLink() {
    const waNumber = request.phone.replace(/[^\d]/g, "");
    const text = encodeURIComponent(`Dear ${request.name}, your Ecram Execs booking (${request.reference}) of ${formatEuro(grandTotal)} is ready. Secure payment link via Mollie: https://ecramexecs.com/pay/${request.reference}`);
    if (waNumber.length >= 8) {
      window.open(`https://wa.me/${waNumber}?text=${text}`, "_blank");
    } else {
      alert(interpolate(copy.whatsappCopied, { name: request.name, phone: request.phone }));
    }
  }

  return (
    <>
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-900 text-white px-4 py-2 rounded-lg shadow-lg text-xs flex items-center gap-2 animate-bounce">
          <CheckIcon size={14} /> {toast}
        </div>
      )}

      {/* Audit Trail Modal */}
      {showAuditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 backdrop-blur-xs p-4">
          <div className="bg-white border border-zinc-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <button onClick={() => setShowAuditModal(false)} className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-900 p-1 cursor-pointer">
              <XIcon size={18} />
            </button>
            <h3 className="text-base font-semibold text-zinc-950 mb-1 flex items-center gap-2">
              <ShieldIcon size={18} className="text-emerald-600" />
              {copy.auditTitle}
            </h3>
            <p className="text-xs text-zinc-500 mb-4">{copy.reference} <span className="font-mono font-medium text-zinc-800">{request.reference}</span></p>

            <div className="space-y-3 text-xs divide-y divide-zinc-100 max-h-72 overflow-y-auto pr-1">
              <div className="pt-2 flex justify-between">
                <div>
                  <p className="font-semibold text-zinc-900">{copy.requestCreated}</p>
                  <p className="text-zinc-500">{copy.requestCreatedNote}</p>
                </div>
                <span className="font-mono text-zinc-400">{formatTimestamp(request.createdAt)}</span>
              </div>
              <div className="pt-3 flex justify-between">
                <div>
                  <p className="font-semibold text-zinc-900">{copy.aiCalc}</p>
                  <p className="text-zinc-500">{copy.aiCalcNote}</p>
                </div>
                <span className="font-mono text-emerald-700 font-semibold">{formatEuro(grandTotal)}</span>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-zinc-100 flex justify-end">
              <button onClick={() => setShowAuditModal(false)} className="bg-zinc-900 hover:bg-zinc-800 text-white px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer">
                {copy.closeAudit}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Branded quote modal */}
      {showPdfModal &&
        createPortal(
          <div id="official-quote">
            <button
              type="button"
              aria-label={copy.close}
              className="quote-chrome fixed inset-0 z-[80] cursor-pointer bg-zinc-950/70"
              onClick={() => setShowPdfModal(false)}
            />
            <div className="quote-sheet-frame pointer-events-none fixed inset-0 z-[81] overflow-y-auto p-4 sm:p-8">
              <article className="quote-sheet pointer-events-auto relative mx-auto my-4 w-full max-w-[720px] bg-white px-8 py-10 text-zinc-950 shadow-2xl sm:px-12">
                <button
                  type="button"
                  onClick={() => setShowPdfModal(false)}
                  className="quote-chrome absolute top-4 right-4 cursor-pointer p-1 text-zinc-400 hover:text-zinc-950"
                >
                  <XIcon size={18} />
                </button>

                <header className="border-b border-zinc-300 pb-6 text-center">
                  <p className="font-display text-xs font-bold tracking-[0.4em] text-emerald-800 uppercase">Ecram Execs</p>
                  <h2 className="mt-3 text-xl font-bold tracking-tight text-zinc-950">{copy.quoteHeading}</h2>
                  <p className="mt-2 font-mono text-xs text-zinc-600">
                    {copy.reference} {request.reference}
                  </p>
                </header>

                <div className="grid grid-cols-1 gap-6 border-b border-zinc-200 py-6 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">Client</p>
                    <p className="mt-1 font-semibold text-zinc-950">{request.name}</p>
                    <p className="text-zinc-700">{request.email}</p>
                    <p className="text-zinc-700">{request.phone}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">{copy.itinerary}</p>
                    <p className="mt-1 font-semibold text-zinc-950">
                      {collection} → {destination}
                    </p>
                    <p className="text-zinc-700">
                      {[pickup?.date, pickup?.time].filter(Boolean).join(" · ") || "—"}
                    </p>
                    <p className="text-zinc-700">
                      {convoyTitle(request) ?? (request.vehicle ? (vehicleByKey(request.vehicle)?.name ?? request.vehicle) : "—")}
                      {request.passengers != null ? ` · ${request.passengers}` : ""}
                      {request.luggage != null ? ` · ${request.luggage} large` : ""}
                      {request.handLuggage ? ` · ${request.handLuggage} small` : ""}
                    </p>
                  </div>
                </div>

                <div className="mt-6 text-sm">
                  {fare.map((row) => (
                    <div key={row.label} className="flex justify-between gap-6 border-b border-zinc-200 py-2.5">
                      <span className="text-zinc-800">{row.label}</span>
                      <span className="font-mono font-semibold text-zinc-950">{formatEuro(row.amount)}</span>
                    </div>
                  ))}
                  <div className="mt-4 flex justify-between gap-6 border-t-2 border-zinc-950 pt-4 text-base font-bold">
                    <span>{copy.finalAmount}</span>
                    <span className="font-mono text-emerald-800">{formatEuro(grandTotal)}</span>
                  </div>
                </div>

                <p className="mt-12 border-t border-zinc-200 pt-4 text-center text-[11px] text-zinc-500">
                  Ecram Execs Chauffeur Services · Amsterdam, Netherlands
                </p>

                <div className="quote-chrome mt-6 flex justify-end gap-3 border-t border-zinc-200 pt-4">
                  <button
                    type="button"
                    onClick={printQuote}
                    className="cursor-pointer rounded-lg bg-zinc-950 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
                  >
                    {copy.printPdf}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPdfModal(false)}
                    className="cursor-pointer rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
                  >
                    {copy.close}
                  </button>
                </div>
              </article>
            </div>
          </div>,
          document.body,
        )}

      <div className="grid h-fit w-full grid-cols-1 items-start gap-6 lg:grid-cols-2" style={{ alignItems: "start" }}>
        <div className="box-border h-fit w-full min-w-0 self-start overflow-hidden rounded-xl border border-zinc-200/80 bg-white shadow-card" style={{ alignSelf: "start", height: "fit-content" }}>
          {children}
          {/* Authorisation & Dispatch — same box as the rate card */}
          <div className={children ? "border-t border-zinc-100 px-5 py-5" : "px-5 py-5"}>
            <h3 className="text-sm font-semibold text-zinc-900 uppercase tracking-wider mb-2.5">{copy.authTitle}</h3>
            
            {/* Status Dropdown Selector */}
            <div className="bg-white border border-zinc-200 rounded-lg p-3 mb-3 space-y-1 shadow-2xs">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as typeof selectedStatus)}
                disabled={loading}
                className="w-full bg-amber-50 border border-amber-200 text-amber-900 font-bold text-xs uppercase tracking-wide rounded-lg px-3 py-1.5 focus:outline-none cursor-pointer disabled:opacity-50 mt-2"
              >
                {STATUSES.map((value) => (
                  <option key={value} value={value}>{statuses[value]}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                disabled={loading}
                onClick={handleSend}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 px-4 rounded-xl text-xs shadow-sm transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                 {loading ? copy.saving : copy.notifyClient}
              </button>
              
              <button
                type="button"
                onClick={() => setShowAuditModal(true)}
                className="w-full bg-white hover:bg-zinc-50 text-zinc-800 font-semibold py-2 px-3 rounded-xl text-xs transition border border-zinc-200 shadow-2xs cursor-pointer"
              >
                {copy.viewAudit}
              </button>
            </div>

            {/* Client Notification Previews */}
            <div className="mt-3 pt-3 border-t border-zinc-200">
              <span className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block mb-2">{copy.notifyPreview}</span>
              <div className="grid grid-cols-2 gap-2">
                <div
                  onClick={() => setShowPdfModal(true)}
                  className="bg-white hover:bg-zinc-50 border border-zinc-200 rounded-xl p-2.5 text-center shadow-2xs cursor-pointer transition group flex flex-col items-center justify-center gap-1.5"
                >
                  <div className="size-7 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-700 group-hover:bg-zinc-900 group-hover:text-white transition-colors">
                    <MailIcon size={12} />
                  </div>
                  <span className="text-[11px] text-zinc-800 font-semibold">{copy.pdfQuote}</span>
                </div>

                <div
                  onClick={handleWhatsappLink}
                  className="bg-white hover:bg-zinc-50 border border-emerald-200 rounded-xl p-2.5 text-center shadow-2xs cursor-pointer transition group flex flex-col items-center justify-center gap-1.5"
                >
                  <div className="size-7 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                    <ChatIcon size={12} />
                  </div>
                  <span className="text-[11px] text-zinc-800 font-semibold">{copy.whatsappPay}</span>
                </div>
              </div>
            </div>
          </div>

        </div>

        <div className="box-border flex h-fit w-full min-w-0 flex-col gap-6 self-start rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-5" style={{ alignSelf: "start", height: "fit-content" }}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight text-zinc-950">
                <span className="inline-block size-2 animate-pulse rounded-full bg-emerald-600" />
                {copy.heading}
              </h2>
              <p className="mt-1 text-xs font-semibold tracking-wider text-zinc-500 uppercase">{copy.itinerary}</p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <div className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 font-mono text-xs text-zinc-600 shadow-2xs">
                {formatTimestamp(request.createdAt)}
              </div>
              {routeMap ? (
                <a
                  href={routeMap.open}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs bg-white border border-zinc-200 text-zinc-700 px-2.5 py-1 rounded font-mono hover:bg-zinc-100"
                >
                  {routeMap.openLabel}
                </a>
              ) : (
                <span className="text-xs bg-white border border-zinc-200 text-zinc-600 px-2.5 py-1 rounded font-mono">{copy.googleMap}</span>
              )}
            </div>
          </div>

          {routeMap &&
            (routeMap.embed ? (
              <iframe
                title={routeMap.frameTitle}
                src={routeMap.embed}
                loading="lazy"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                className="block h-56 w-full rounded-lg border border-zinc-200 bg-zinc-100"
              />
            ) : (
              <p className="rounded-lg border border-dashed border-zinc-300 bg-white px-3 py-4 text-xs text-zinc-500">{routeMap.noKey}</p>
            ))}

          <div>
            <label className="text-xs font-medium text-zinc-500 block mb-2">{copy.waypoints}</label>
            <div className="space-y-2">
              <div className="flex items-center justify-between bg-white border border-zinc-200 rounded-lg px-3.5 py-2.5 text-xs">
                <span className="text-zinc-900 truncate font-medium">📍 {collection}</span>
                <span className="text-zinc-400 text-[11px]">{copy.collection}</span>
              </div>
              
              {stopovers.map((stop: string, idx: number) => {
                const waitMins = stopWaits[idx] ?? 0;
                return (
                  <div key={idx} className="flex items-center justify-between bg-white border border-zinc-200 rounded-lg px-3.5 py-2.5 text-xs">
                    <span className="text-zinc-900 truncate font-medium">📍 {stop}</span>
                    <div className="flex items-center gap-2">
                      {waitMins > 0 && (
                        <span className="text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded font-mono text-[10px]">
                          ⏱ {waitMins} min wait
                        </span>
                      )}
                      <span className="text-zinc-400 text-[11px]">{interpolate(copy.stop, { number: idx + 1 })}</span>
                    </div>
                  </div>
                );
              })}

              <div className="flex items-center justify-between bg-white border border-zinc-200 rounded-lg px-3.5 py-2.5 text-xs">
                <span className="text-zinc-900 truncate font-medium">📍 {destination}</span>
                <span className="text-zinc-400 text-[11px]">{copy.destination}</span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded-xl p-4 grid grid-cols-2 gap-3 text-xs shadow-2xs">
            <div>
              <p className="text-[10px] uppercase font-semibold text-zinc-400 flex items-center gap-1">
                <CalendarIcon size={12} /> {copy.pickupDate}
              </p>
              <p className="font-semibold text-zinc-900 mt-0.5">{pickup?.date ?? "—"}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-semibold text-zinc-400 flex items-center gap-1">
                <ClockIcon size={12} /> {copy.pickupTime}
              </p>
              <p className="font-semibold text-zinc-900 mt-0.5">{pickup?.time ?? "—"}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-semibold text-zinc-400 flex items-center gap-1">
                <UsersIcon size={12} /> {copy.passengers}
              </p>
              <p className="font-semibold text-zinc-900 mt-0.5">{request.passengers ?? "—"}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-semibold text-zinc-400 flex items-center gap-1">
                🧳 Luggage
              </p>
              <p className="font-semibold text-zinc-900 mt-0.5">{[request.luggage != null ? `${request.luggage} large` : null, request.handLuggage ? `${request.handLuggage} small` : null].filter(Boolean).join(", ") || "—"}</p>
            </div>
            <div className="col-span-2 pt-2 border-t border-zinc-100">
              <p className="text-[10px] uppercase font-semibold text-zinc-400 flex items-center gap-1">
                <BriefcaseIcon size={12} /> {copy.vehicle}
              </p>
              <p className="mt-0.5 font-semibold whitespace-normal text-zinc-900">
                {convoyTitle(request) ?? (request.vehicle && request.vehicle !== "advise" ? (vehicleByKey(request.vehicle)?.name ?? request.vehicle) : "—")}
              </p>
              {(request.vehicleCount ?? 1) > 1 && request.internalNotes?.trim() ? (
                <p className="mt-0.5 text-xs font-medium whitespace-pre-wrap text-zinc-700">{request.internalNotes.trim()}</p>
              ) : null}
            </div>
            {addOns ? (
              <div className="col-span-2 pt-2 border-t border-zinc-100">
                <p className="text-[10px] uppercase font-semibold text-zinc-400">{copy.addOns}</p>
                <p className="mt-0.5 font-medium whitespace-normal text-zinc-900">{addOns}</p>
              </div>
            ) : null}
            {request.notes?.trim() ? (
              <div className="col-span-2 pt-2 border-t border-zinc-100">
                <p className="text-[10px] uppercase font-semibold text-zinc-400">{copy.note}</p>
                <p className="mt-0.5 font-medium whitespace-pre-wrap text-zinc-900">{request.notes.trim()}</p>
              </div>
            ) : null}
          </div>
        </div>

      </div>
    </>
  );
}