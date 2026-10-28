"use client";

import React, { useState } from "react";
import type { QuoteRequest } from "@/lib/db/schema";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { interpolate } from "@/lib/i18n/interpolate";

type PricingCopy = Dictionary["admin"]["pricing"];
type StatusCopy = Dictionary["admin"]["statuses"];
const STATUSES = ["new", "contacted", "quoted", "confirmed", "completed", "cancelled"] as const;
import { formatEuro, formatTimestamp, pickupInstant, pickupParts } from "@/lib/admin/format";
import { vehicleByKey } from "@/lib/fleet/vehicles";
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

export function AutoPricingGateway({ request, copy, statuses }: { request: QuoteRequest; copy: PricingCopy; statuses: StatusCopy }) {
  const [status, setStatus] = useState<"new" | "contacted" | "quoted" | "confirmed" | "completed" | "cancelled">(
    request.status as any
  );
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);
  
  // Inline editing state for fare, tax rates, and tax descriptions
  const [isEditing, setIsEditing] = useState(false);
  const [editedAmount, setEditedAmount] = useState(request.quotedAmount ? Number(request.quotedAmount) : 0);
  const [btw9Rate, setBtw9Rate] = useState(9);
  const [btw21Rate, setBtw21Rate] = useState(21);
  const [btw9Label, setBtw9Label] = useState("Passenger Transport");
  const [btw21Label, setBtw21Label] = useState("Ancillary / Fees");

  // Real data extracted from request
  const collection = request.collection ?? "—";
  const destination = request.destination ?? (request.durationHours ? interpolate(copy.hoursAsDirected, { hours: request.durationHours }) : "—");
  const stopovers = request.destinations ?? [];
  const pickup = request.pickupAt ? pickupParts(request.pickupAt) : null;
  const pickupAt = request.pickupAt ? pickupInstant(request.pickupAt) : null;

  // Fare calculations
  const subtotal = Number(editedAmount);
  const durationHours = request.durationHours ?? 0;
  const hourlyRate = 50;
  const timeCost = durationHours * hourlyRate;
  const airportSurcharge = request.flightNumber ? 25 : 0;
  const totalWaitMinutes = (request.destinationWaits ?? []).reduce((a, b) => a + (b ?? 0), 0);
  const waitRate = 0.5;
  const waitCost = totalWaitMinutes * waitRate;
  const deadheadFee = request.returnAt ? subtotal * 0.10 : 0;
  const baseFare = subtotal + timeCost + airportSurcharge + waitCost + deadheadFee;
  
  // Dynamic BTW Tax Splits
  const btw9 = baseFare * (btw9Rate / 100);
  const btw21 = baseFare * (btw21Rate / 100);
  const totalTax = btw9 + btw21;
  const grandTotal = baseFare + totalTax;

  // 1. Send Button: Explicitly triggers mail & dispatch with terminal console feedback
  async function handleSend() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/requests/${request.id}/authorise`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "quoted", amount: grandTotal, sendMail: true })
      });
      const data = await res.json();
      console.log("Resend Mail Response:", data);
      if (data.warning || data.error) {
        setToast(`Sent with note: Check terminal for Resend logs.`);
      } else {
        setToast("Quote successfully sent to client via email!");
      }
    } catch (err) {
      console.error("Resend Mail Dispatch Error:", err);
      setToast("Error sending email. Check server terminal logs.");
    } finally {
      setLoading(false);
      setTimeout(() => setToast(null), 4000);
    }
  }

  // 2. Status Dropdown: Updates status locally & in DB without sending mail
  async function handleStatusChange(newStatus: typeof status) {
    setStatus(newStatus);
    setLoading(true);
    try {
      await fetch(`/api/admin/requests/${request.id}/authorise`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: newStatus, amount: grandTotal, sendMail: false })
      });
      setToast(interpolate(copy.statusUpdated, { status: statuses[newStatus] }));
    } catch {
      setToast(interpolate(copy.statusUpdatedShort, { status: statuses[newStatus] }));
    } finally {
      setLoading(false);
      setTimeout(() => setToast(null), 3000);
    }
  }

// 3. Save Fare: Updates fare amount, sets status to "quoted", and saves to DB without sending mail
  async function handleSaveFare() {
    setIsEditing(false);
    setStatus("quoted"); // Automatically update local status state to quoted
    setLoading(true);
    setToast("Fare updated and status set to quoted (No email sent).");
    try {
      await fetch(`/api/admin/requests/${request.id}/authorise`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "quoted", amount: grandTotal, sendMail: false }),
      });
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setTimeout(() => setToast(null), 3000);
    }
  }

  function handleWhatsappLink() {
    const waNumber = request.phone.replace(/[^\d]/g, "");
    const text = encodeURIComponent(`Dear ${request.name}, your Ecram Execs quote (${request.reference}) of ${formatEuro(grandTotal)} is ready. Secure payment link via Mollie: https://ecramexecs.com/pay/${request.reference}`);
    if (waNumber.length >= 8) {
      window.open(`https://wa.me/${waNumber}?text=${text}`, "_blank");
    } else {
      alert(interpolate(copy.whatsappCopied, { name: request.name, phone: request.phone }));
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white text-zinc-900 shadow-sm overflow-hidden relative">
      {toast && (
        <div className="absolute top-4 right-4 z-50 bg-emerald-900 text-white px-4 py-2 rounded-lg shadow-lg text-xs flex items-center gap-2 animate-bounce">
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
                <span className="font-mono text-emerald-700 font-semibold">{formatEuro(baseFare)}</span>
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

      {/* Branded PDF Quote Preview Modal */}
      {showPdfModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-zinc-900 text-zinc-100 border border-zinc-800 rounded-2xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative my-auto">
            <button onClick={() => setShowPdfModal(false)} className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 cursor-pointer">
              <XIcon size={18} />
            </button>
            <div className="text-center border-b border-zinc-800 pb-5 mb-5">
              <span className="font-display text-xs tracking-[0.4em] uppercase text-emerald-400">ECRAM EXECS</span>
              <h2 className="text-lg font-bold text-white mt-1">{copy.quoteHeading}</h2>
              <p className="text-xs text-zinc-400 mt-1 font-mono">{copy.reference} {request.reference}</p>
            </div>
            <div className="space-y-4 text-xs font-mono">
              <div className="flex justify-between py-1"><span className="text-zinc-300">{copy.totalBase}</span><span className="text-white">{formatEuro(baseFare)}</span></div>
              <div className="flex justify-between py-1"><span className="text-cyan-400">{btw9Rate}% BTW ({btw9Label})</span><span className="text-cyan-400">{formatEuro(btw9)}</span></div>
              <div className="flex justify-between py-1"><span className="text-blue-400">{btw21Rate}% BTW ({btw21Label})</span><span className="text-blue-400">{formatEuro(btw21)}</span></div>
              <div className="flex justify-between pt-3 border-t border-zinc-800 text-sm font-bold"><span className="text-white">{copy.total}</span><span className="text-emerald-400 text-base">{formatEuro(grandTotal)}</span></div>
            </div>
            <div className="mt-5 pt-4 border-t border-zinc-800 flex justify-end gap-3">
              <button onClick={() => window.print()} className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer">{copy.printPdf}</button>
              <button onClick={() => setShowPdfModal(false)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer">{copy.close}</button>
            </div>
          </div>
        </div>
      )}

      {/* Header bar */}
      <div className="border-b border-zinc-100 bg-zinc-50/80 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-zinc-950 flex items-center gap-2">
            <span className="inline-block size-2 rounded-full bg-emerald-600 animate-pulse" />
            {copy.heading}
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">{copy.headingNote}</p>
        </div>
        <div className="text-xs font-mono text-zinc-600 bg-white border border-zinc-200 px-3 py-1.5 rounded-lg shadow-2xs">
          {formatTimestamp(request.createdAt)}
        </div>
      </div>

      {/* Main Grid Body */}
      <div className="p-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3 items-start">
        
        {/* Column 1: Itinerary, Distance & Journey Timing Info */}
        <div className="flex flex-col gap-5 bg-zinc-50/60 border border-zinc-200/80 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-900 uppercase tracking-wider">{copy.itinerary}</h3>
            <span className="text-xs bg-white border border-zinc-200 text-zinc-600 px-2.5 py-1 rounded font-mono">{copy.googleMap}</span>
          </div>

          <div className="relative h-48 rounded-lg overflow-hidden border border-zinc-200 bg-zinc-950 flex flex-col items-center justify-center">
            <svg className="absolute inset-0 w-full h-full opacity-60" xmlns="http://www.w3.org/2000/svg">
              <path d="M 30,120 Q 90,40 160,80 T 280,60" fill="none" stroke="#3b82f6" strokeWidth="4" strokeLinecap="round" />
              <circle cx="30" cy="120" r="5" fill="#10b981" />
              <circle cx="160" cy="80" r="5" fill="#3b82f6" />
              <circle cx="280" cy="60" r="5" fill="#ef4444" />
            </svg>
            <div className="absolute bottom-2 left-2 right-2 bg-white/95 backdrop-blur-xs px-3 py-1.5 rounded border border-zinc-200 text-xs text-zinc-900 truncate font-medium text-center">
              {collection} → {destination}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-500 block mb-2">{copy.waypoints}</label>
            <div className="space-y-2">
              <div className="flex items-center justify-between bg-white border border-zinc-200 rounded-lg px-3.5 py-2.5 text-xs">
                <span className="text-zinc-900 truncate font-medium">📍 {collection}</span>
                <span className="text-zinc-400 text-[11px]">{copy.collection}</span>
              </div>
              {stopovers.map((stop: string, idx: number) => (
                <div key={idx} className="flex items-center justify-between bg-white border border-zinc-200 rounded-lg px-3.5 py-2.5 text-xs">
                  <span className="text-zinc-900 truncate font-medium">📍 {stop}</span>
                  <span className="text-zinc-400 text-[11px]">{interpolate(copy.stop, { number: idx + 1 })}</span>
                </div>
              ))}
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
                <BriefcaseIcon size={12} /> {copy.vehicle}
              </p>
              <p className="font-semibold text-zinc-900 mt-0.5 truncate">
                {request.vehicle ? (vehicleByKey(request.vehicle)?.name ?? request.vehicle) : "—"}
              </p>
            </div>
          </div>
        </div>

        {/* Column 2 & 3 Combined: Single Flow Without Gaps */}
        <div className="flex flex-col gap-4 md:col-span-1 xl:col-span-2">
          
          {/* Fare Breakdown Engine with Fully Editable Tax Percentages & Descriptions */}
          <div className="bg-zinc-50/60 border border-zinc-200/80 rounded-xl p-5 flex flex-col gap-4">
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <h3 className="text-sm font-semibold text-zinc-900 uppercase tracking-wider">{copy.fareTitle}</h3>
                {isEditing ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleSaveFare}
                      className="text-xs font-semibold text-white bg-black hover:bg-zinc-800 px-3 py-1.5 rounded-lg transition cursor-pointer"
                    >
                      {copy.save}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="text-xs font-semibold text-zinc-700 bg-zinc-200 hover:bg-zinc-300 px-3 py-1.5 rounded-lg transition cursor-pointer"
                    >
                      {copy.cancel}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 px-3 py-1.5 rounded-lg transition cursor-pointer shrink-0"
                  >
                    {copy.editFare}
                  </button>
                )}
              </div>

              <div className="space-y-1 text-xs divide-y divide-zinc-100">
                <div className="flex justify-between items-center py-2.5">
                  <span className="text-zinc-600 font-medium">{copy.baseFare}</span>
                  {isEditing ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-zinc-500 font-mono">€</span>
                      <input
                        type="number"
                        value={editedAmount}
                        onChange={(e) => setEditedAmount(Number(e.target.value))}
                        className="w-32 bg-white border border-zinc-300 rounded-lg px-2.5 py-1.5 font-mono text-xs font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-black/5"
                        autoFocus
                      />
                    </div>
                  ) : (
                    <span className="font-mono font-semibold text-zinc-900">{formatEuro(subtotal)}</span>
                  )}
                </div>

                <div className="flex justify-between py-2.5">
                  <span className="text-zinc-600 font-medium">{interpolate(copy.timeCharge, { hours: durationHours, rate: hourlyRate })}</span>
                  <span className="font-mono font-semibold text-zinc-900">{formatEuro(timeCost)}</span>
                </div>
                <div className="flex justify-between py-2.5">
                  <span className="text-zinc-600 font-medium">{interpolate(copy.waitTime, { minutes: totalWaitMinutes })}</span>
                  <span className="font-mono font-semibold text-zinc-900">{formatEuro(waitCost)}</span>
                </div>
              </div>

              <div className="pt-3 mt-3 border-t border-zinc-200 space-y-3">
                <div className="flex justify-between text-xs text-zinc-700 font-medium">
                  <span>{copy.totalBaseExcl}</span>
                  <span className="font-mono text-zinc-900">{formatEuro(baseFare)}</span>
                </div>

                {/* Fully Editable 9% BTW Rate & Description */}
                <div className="flex justify-between items-center text-xs text-cyan-700 font-medium">
                  {isEditing ? (
                    <div className="flex items-center gap-1.5 flex-1 mr-4">
                      <input
                        type="number"
                        value={btw9Rate}
                        onChange={(e) => setBtw9Rate(Number(e.target.value))}
                        className="w-12 bg-white border border-cyan-300 rounded px-1.5 py-1 font-mono text-xs font-bold text-cyan-900 focus:outline-none"
                      />
                      <span>% BTW (</span>
                      <input
                        type="text"
                        value={btw9Label}
                        onChange={(e) => setBtw9Label(e.target.value)}
                        className="bg-white border border-cyan-300 rounded px-2 py-1 text-xs text-cyan-900 focus:outline-none flex-1"
                      />
                      <span>)</span>
                    </div>
                  ) : (
                    <span>{btw9Rate}% BTW ({btw9Label})</span>
                  )}
                  <span className="font-mono shrink-0">{formatEuro(btw9)}</span>
                </div>

                {/* Fully Editable 21% BTW Rate & Description */}
                <div className="flex justify-between items-center text-xs text-blue-700 font-medium">
                  {isEditing ? (
                    <div className="flex items-center gap-1.5 flex-1 mr-4">
                      <input
                        type="number"
                        value={btw21Rate}
                        onChange={(e) => setBtw21Rate(Number(e.target.value))}
                        className="w-12 bg-white border border-blue-300 rounded px-1.5 py-1 font-mono text-xs font-bold text-blue-900 focus:outline-none"
                      />
                      <span>% BTW (</span>
                      <input
                        type="text"
                        value={btw21Label}
                        onChange={(e) => setBtw21Label(e.target.value)}
                        className="bg-white border border-blue-300 rounded px-2 py-1 text-xs text-blue-900 focus:outline-none flex-1"
                      />
                      <span>)</span>
                    </div>
                  ) : (
                    <span>{btw21Rate}% BTW ({btw21Label})</span>
                  )}
                  <span className="font-mono shrink-0">{formatEuro(btw21)}</span>
                </div>
              </div>
            </div>

            {/* Total Tax (BTW) placed right above final amount */}
            <div className="bg-zinc-900 text-white rounded-xl p-3.5 flex items-center justify-between shadow-sm">
              <span className="text-xs font-bold tracking-wider uppercase">Total Tax (BTW)</span>
              <span className="text-lg font-bold font-mono text-cyan-400">{formatEuro(totalTax)}</span>
            </div>

            {/* Final Amount Banner */}
            <div className="bg-gradient-to-r from-zinc-900 to-zinc-950 text-white border border-zinc-900 rounded-xl p-3.5 text-center shadow-sm flex items-center justify-between">
              <span className="text-xs text-zinc-400 uppercase tracking-wider">{copy.finalAmount}</span>
              <span className="text-xl font-bold font-mono text-emerald-400">
                {formatEuro(grandTotal)}
              </span>
            </div>
          </div>

          {/* Authorisation & Dispatch Controls */}
          <div className="bg-zinc-50/60 border border-zinc-200/80 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-zinc-900 uppercase tracking-wider mb-2.5">{copy.authTitle}</h3>
            
            {/* Status Dropdown Selector */}
            <div className="bg-white border border-zinc-200 rounded-lg p-3 mb-3 space-y-1 shadow-2xs">
              <label className="text-[11px] font-medium text-zinc-500 uppercase block">{copy.status}</label>
              <select
                value={status}
                onChange={(e) => handleStatusChange(e.target.value as typeof status)}
                disabled={loading}
                className="w-full bg-amber-50 border border-amber-200 text-amber-900 font-bold text-xs uppercase tracking-wide rounded-lg px-3 py-1.5 focus:outline-none cursor-pointer disabled:opacity-50"
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

      </div>
    </div>
  );
}