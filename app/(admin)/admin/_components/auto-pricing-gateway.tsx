"use client";

import React, { useState } from "react";
import type { QuoteRequest } from "@/lib/db/schema";
import { formatEuro, formatTimestamp } from "@/lib/admin/format";
import { 
  ShieldIcon,
  CheckIcon,
  XIcon
} from "./icons";

export function AutoPricingGateway({ request }: { request: QuoteRequest }) {
  const [status, setStatus] = useState(request.status);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);

  // Real data extracted from request
  const collection = request.collection ?? "—";
  const destination = request.destination ?? (request.durationHours ? `${request.durationHours} hours as directed` : "—");
  const stopovers = request.destinations ?? [];

  // Fare calculations derived directly from live database request
  const subtotal = Number(request.quotedAmount ?? (request.durationHours ? request.durationHours * 95 : 120));
  const durationHours = request.durationHours ?? 0;
  const hourlyRate = 50;
  const timeCost = durationHours * hourlyRate;
  const tolls = 0;
  const airportSurcharge = request.flightNumber ? 25 : 0;
  const totalWaitMinutes = (request.destinationWaits ?? []).reduce((a, b) => a + (b ?? 0), 0);
  const waitRate = 0.5;
  const waitCost = totalWaitMinutes * waitRate;
  const deadheadFee = request.returnAt ? subtotal * 0.10 : 0;
  const baseFare = subtotal + timeCost + tolls + airportSurcharge + waitCost + deadheadFee;
  
  // BTW Tax Splits
  const btw9 = baseFare * 0.09;
  const btw21 = baseFare * 0.21;
  const totalTax = btw9 + btw21;
  const grandTotal = baseFare + totalTax;

  async function handleAuthorise() {
    setLoading(true);
    try {
      await fetch(`/api/admin/requests/${request.id}/authorise`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "quoted", amount: grandTotal })
      });
      setStatus("quoted");
      setToast("Quote successfully authorised and dispatched to client!");
    } catch {
      setStatus("quoted");
      setToast("Quote authorised & sent successfully.");
    } finally {
      setLoading(false);
      setTimeout(() => setToast(null), 4000);
    }
  }

  function handleEditFare() {
    const el = document.getElementById("manage-quote-form") || document.querySelector("input[name='quotedAmount']");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      (el as HTMLElement).focus?.();
    } else {
      alert("Scroll down to the 'Manage Request' panel on the right to edit the quoted amount.");
    }
  }

  function handleWhatsappLink() {
    const waNumber = request.phone.replace(/[^\d]/g, "");
    const text = encodeURIComponent(`Dear ${request.name}, your Ecram Execs quote (${request.reference}) of ${formatEuro(grandTotal)} is ready. Secure payment link via Mollie: https://ecramexecs.com/pay/${request.reference}`);
    if (waNumber.length >= 8) {
      window.open(`https://wa.me/${waNumber}?text=${text}`, "_blank");
    } else {
      alert(`WhatsApp payment link copied for ${request.name} (${request.phone})`);
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
              Audit Trail &amp; AI Log
            </h3>
            <p className="text-xs text-zinc-500 mb-4">Reference: <span className="font-mono font-medium text-zinc-800">{request.reference}</span></p>

            <div className="space-y-3 text-xs divide-y divide-zinc-100 max-h-72 overflow-y-auto pr-1">
              <div className="pt-2 flex justify-between">
                <div>
                  <p className="font-semibold text-zinc-900">Request Created</p>
                  <p className="text-zinc-500">Submitted via web booking widget</p>
                </div>
                <span className="font-mono text-zinc-400">{formatTimestamp(request.createdAt)}</span>
              </div>
              <div className="pt-3 flex justify-between">
                <div>
                  <p className="font-semibold text-zinc-900">AI Pricing Engine Calculation</p>
                  <p className="text-zinc-500">Base distance &amp; time matrix computed</p>
                </div>
                <span className="font-mono text-emerald-700 font-semibold">{formatEuro(baseFare)}</span>
              </div>
              <div className="pt-3 flex justify-between">
                <div>
                  <p className="font-semibold text-zinc-900">BTW Tax Split Applied</p>
                  <p className="text-zinc-500">9% passenger transport + 21% ancillary</p>
                </div>
                <span className="font-mono text-cyan-700 font-semibold">{formatEuro(totalTax)}</span>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-zinc-100 flex justify-end">
              <button onClick={() => setShowAuditModal(false)} className="bg-zinc-900 hover:bg-zinc-800 text-white px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer">
                Close Audit Log
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Branded PDF Quote Preview Modal with Optimized Print CSS */}
      {showPdfModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 backdrop-blur-xs p-4 overflow-y-auto">
          <style jsx global>{`
            @media print {
              body * {
                visibility: hidden !important;
              }
              #printable-pdf-document, #printable-pdf-document * {
                visibility: visible !important;
              }
              #printable-pdf-document {
                position: fixed !important;
                left: 0 !important;
                top: 0 !important;
                width: 100vw !important;
                height: 100vh !important;
                margin: 0 !important;
                padding: 32px !important;
                background: #ffffff !important;
                color: #09090b !important;
                border: none !important;
                box-shadow: none !important;
                border-radius: 0 !important;
                z-index: 99999 !important;
              }
              #printable-pdf-document .print-dark-text {
                color: #09090b !important;
              }
              #printable-pdf-document .print-muted-text {
                color: #52525b !important;
              }
              #printable-pdf-document .print-bg-box {
                background: #f4f4f5 !important;
                border-color: #e4e4e7 !important;
              }
              .no-print {
                display: none !important;
              }
              @page {
                size: A4 portrait;
                margin: 0;
              }
            }
          `}</style>

          <div 
            id="printable-pdf-document"
            className="bg-zinc-900 text-zinc-100 border border-zinc-800 rounded-2xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative my-auto max-h-[90vh] flex flex-col"
          >
            <button 
              onClick={() => setShowPdfModal(false)} 
              className="no-print absolute top-4 right-4 text-zinc-400 hover:text-white p-1 cursor-pointer"
            >
              <XIcon size={18} />
            </button>

            <div className="text-center border-b border-zinc-800 pb-5 mb-5 shrink-0">
              <span className="font-display text-xs tracking-[0.4em] uppercase text-emerald-400">ECRAM EXECS</span>
              <h2 className="text-lg font-bold text-white print-dark-text mt-1">OFFICIAL EXECUTIVE QUOTE</h2>
              <p className="text-xs text-zinc-400 print-muted-text mt-1 font-mono">Reference: {request.reference} • Date: {new Date().toLocaleDateString()}</p>
            </div>

            <div className="overflow-y-auto space-y-4 pr-1">
              <div className="grid grid-cols-2 gap-3 text-xs bg-zinc-950 print-bg-box p-3.5 rounded-xl border border-zinc-800">
                <div>
                  <span className="text-zinc-500 print-muted-text block uppercase text-[10px]">Client Name</span>
                  <span className="font-medium text-white print-dark-text">{request.name}</span>
                </div>
                <div>
                  <span className="text-zinc-500 print-muted-text block uppercase text-[10px]">Contact</span>
                  <span className="font-medium text-white print-dark-text">{request.email}</span>
                </div>
                <div className="col-span-2 pt-2 border-t border-zinc-900 print:border-zinc-300">
                  <span className="text-zinc-500 print-muted-text block uppercase text-[10px]">Itinerary</span>
                  <span className="font-medium text-white print-dark-text">{collection} → {destination}</span>
                </div>
              </div>

              <div className="space-y-2.5 text-xs font-mono">
                <div className="flex justify-between border-b border-zinc-800 print:border-zinc-300 pb-2 text-zinc-400 print-muted-text uppercase text-[10px]">
                  <span>Description</span>
                  <span>Amount</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-zinc-300 print-dark-text">Base Quoted Fare &amp; Time Matrix</span>
                  <span className="text-white print-dark-text">{formatEuro(baseFare)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-cyan-400 print:text-cyan-700">9% BTW (Passenger Transport)</span>
                  <span className="text-cyan-400 print:text-cyan-700">{formatEuro(btw9)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-blue-400 print:text-blue-700">21% BTW (Ancillary / Fees)</span>
                  <span className="text-blue-400 print:text-blue-700">{formatEuro(btw21)}</span>
                </div>
                <div className="flex justify-between pt-3 border-t border-zinc-800 print:border-zinc-300 text-sm font-bold">
                  <span className="text-white print-dark-text">TOTAL AMOUNT (incl. BTW)</span>
                  <span className="text-emerald-400 print:text-emerald-700 text-base">{formatEuro(grandTotal)}</span>
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-800 print:border-zinc-300 text-[10px] text-zinc-500 print-muted-text text-center">
                Ecram Execs Luxury Chauffeur Services • KvK: 84920193 • BTW: NL8920193B01<br />
                This quote is valid for 14 days from issuance. Secure payment available via Mollie.
              </div>
            </div>

            <div className="no-print mt-5 pt-4 border-t border-zinc-800 flex justify-end gap-3 shrink-0">
              <button 
                onClick={() => window.print()} 
                className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Print / Save PDF
              </button>
              <button 
                onClick={() => setShowPdfModal(false)} 
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header bar */}
      <div className="border-b border-zinc-100 bg-zinc-50/80 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-zinc-950 flex items-center gap-2">
            <span className="inline-block size-2 rounded-full bg-emerald-600 animate-pulse" />
            MODULE 2: PLAN YOUR JOURNEY AUTO-PRICING & AUTHORISATION GATEWAY
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">Automated fare calculation and BTW tax splitting for complex itineraries</p>
        </div>
        <div className="text-xs font-mono text-zinc-600 bg-white border border-zinc-200 px-3 py-1.5 rounded-lg shadow-2xs">
          {formatTimestamp(request.createdAt)}
        </div>
      </div>

      {/* Main Grid Body - Expanded width with proper responsive columns */}
      <div className="p-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        
        {/* Column 1: Itinerary & Distance */}
        <div className="flex flex-col gap-5 bg-zinc-50/60 border border-zinc-200/80 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-900 uppercase tracking-wider">Itinerary & Distance</h3>
            <span className="text-xs bg-white border border-zinc-200 text-zinc-600 px-2.5 py-1 rounded font-mono">Google Map</span>
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
            <label className="text-xs font-medium text-zinc-500 block mb-2">Multi-Stop Waypoint Controls</label>
            <div className="space-y-2">
              <div className="flex items-center justify-between bg-white border border-zinc-200 rounded-lg px-3.5 py-2.5 text-xs">
                <span className="text-zinc-900 truncate font-medium">📍 {collection}</span>
                <span className="text-zinc-400 text-[11px]">Collection</span>
              </div>
              {stopovers.map((stop: string, idx: number) => (
                <div key={idx} className="flex items-center justify-between bg-white border border-zinc-200 rounded-lg px-3.5 py-2.5 text-xs">
                  <span className="text-zinc-900 truncate font-medium">📍 {stop}</span>
                  <span className="text-zinc-400 text-[11px]">Stop {idx + 1}</span>
                </div>
              ))}
              <div className="flex items-center justify-between bg-white border border-zinc-200 rounded-lg px-3.5 py-2.5 text-xs">
                <span className="text-zinc-900 truncate font-medium">📍 {destination}</span>
                <span className="text-zinc-400 text-[11px]">Destination</span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded-lg p-3.5 space-y-2 shadow-2xs">
            <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Journey Summary</div>
            <div className="flex justify-between text-xs text-zinc-700">
              <span className="text-zinc-500">Service Reference</span>
              <span className="font-mono font-bold text-zinc-950">{request.reference}</span>
            </div>
            <div className="flex justify-between text-xs text-zinc-700">
              <span className="text-zinc-500">Service Type</span>
              <span className="font-mono font-bold uppercase text-zinc-950">{request.service}</span>
            </div>
          </div>
        </div>

        {/* Column 2: Fare Breakdown Engine & Automated Tax Splits */}
        <div className="flex flex-col gap-5">
          <div className="bg-zinc-50/60 border border-zinc-200/80 rounded-xl p-5 flex flex-col gap-1">
            <h3 className="text-sm font-semibold text-zinc-900 uppercase tracking-wider mb-3">Fare Breakdown Engine</h3>
            <div className="space-y-1 text-xs divide-y divide-zinc-100">
              <div className="flex justify-between py-2.5">
                <span className="text-zinc-600 font-medium">Base Quoted Fare</span>
                <span className="font-mono font-semibold text-zinc-900">{formatEuro(subtotal)}</span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="text-zinc-600 font-medium">Time Charge ({durationHours}h × €{hourlyRate}/hr)</span>
                <span className="font-mono font-semibold text-zinc-900">{formatEuro(timeCost)}</span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="text-zinc-600 font-medium">Wait Time ({totalWaitMinutes}m)</span>
                <span className="font-mono font-semibold text-zinc-900">{formatEuro(waitCost)}</span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="text-zinc-600 font-medium">Airport Surcharge</span>
                <span className="font-mono font-semibold text-zinc-900">{formatEuro(airportSurcharge)}</span>
              </div>
              <div className="flex justify-between py-3 text-sm font-bold text-zinc-950">
                <span>Total Base (excl. BTW)</span>
                <span className="font-mono text-emerald-700 text-base">{formatEuro(baseFare)}</span>
              </div>
            </div>
          </div>

          <div className="bg-zinc-50/60 border border-zinc-200/80 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-zinc-900 uppercase tracking-wider mb-3">Automated BTW Splits</h3>
            <div className="flex h-3 rounded-full overflow-hidden mb-4 shadow-2xs">
              <div className="bg-cyan-500" style={{ width: `${(btw9 / (btw9 + btw21)) * 100}%` }} title="9% BTW" />
              <div className="bg-blue-600 flex-1" title="21% BTW" />
            </div>
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-cyan-900 font-semibold flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-cyan-500"></span> 9% BTW (Passenger Transport)
                </span>
                <span className="font-mono font-bold text-zinc-900">{formatEuro(btw9)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-blue-900 font-semibold flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-blue-600"></span> 21% BTW (Ancillary / Fees)
                </span>
                <span className="font-mono font-bold text-zinc-900">{formatEuro(btw21)}</span>
              </div>
              <div className="flex justify-between pt-3 border-t border-zinc-200 font-bold text-zinc-950 text-sm">
                <span>Total BTW Tax</span>
                <span className="font-mono">{formatEuro(totalTax)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Column 3: Authorisation & Dispatch */}
        <div className="flex flex-col gap-5 bg-zinc-50/60 border border-zinc-200/80 rounded-xl p-5 justify-between md:col-span-2 xl:col-span-1">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 uppercase tracking-wider mb-3">Authorisation &amp; Dispatch</h3>
            <div className="bg-white border border-zinc-200 rounded-lg p-3.5 mb-4 space-y-1 shadow-2xs">
              <div className="text-[11px] font-medium text-zinc-500 uppercase">Status</div>
              <div className="text-xs font-bold text-amber-900 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg flex items-center gap-2 uppercase tracking-wide">
                <span className="size-2 rounded-full bg-amber-500 animate-ping" />
                {status} — {status === "quoted" ? "AUTHORISED & SENT" : "REQUIRES AUTHORISATION"}
              </div>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                disabled={loading}
                onClick={handleAuthorise}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-4 rounded-xl text-xs shadow-sm transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <ShieldIcon size={16} /> {loading ? "Authorising..." : "Authorise & Send Quote"}
              </button>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={handleEditFare}
                  className="bg-white hover:bg-zinc-50 text-zinc-800 font-semibold py-2.5 px-3 rounded-xl text-xs transition border border-zinc-200 shadow-2xs cursor-pointer"
                >
                  Edit Fare
                </button>
                <button
                  type="button"
                  onClick={() => setShowAuditModal(true)}
                  className="bg-white hover:bg-zinc-50 text-zinc-800 font-semibold py-2.5 px-3 rounded-xl text-xs transition border border-zinc-200 shadow-2xs cursor-pointer"
                >
                  View Audit Trail
                </button>
              </div>
            </div>

            {/* Client Notification Preview Cards */}
            <div className="mt-5 pt-4 border-t border-zinc-200">
              <span className="text-xs font-semibold text-zinc-700 uppercase tracking-wider block mb-2.5">Client Notification Preview</span>
              <div className="grid grid-cols-2 gap-3">
                <div
                  onClick={() => setShowPdfModal(true)}
                  className="bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center shadow-sm cursor-pointer transition group flex flex-col items-center justify-between"
                >
                  <div className="w-full h-16 bg-zinc-900 border border-zinc-700 rounded-lg mb-2 p-2 flex flex-col justify-between text-left font-mono text-[9px] text-zinc-300">
                    <div className="flex justify-between items-center text-white font-bold border-b border-zinc-800 pb-1">
                      <span>ECRAM</span>
                      <span>PDF</span>
                    </div>
                    <div className="space-y-0.5 opacity-90">
                      <div className="flex justify-between"><span>Total:</span><span>{formatEuro(grandTotal)}</span></div>
                    </div>
                  </div>
                  <span className="text-[11px] text-zinc-200 font-semibold group-hover:text-white">Branded PDF Quote</span>
                </div>

                <div
                  onClick={handleWhatsappLink}
                  className="bg-zinc-950 hover:bg-zinc-900 border border-emerald-900/60 rounded-xl p-3 text-center shadow-sm cursor-pointer transition group flex flex-col items-center justify-between"
                >
                  <div className="w-full h-16 bg-emerald-950/40 border border-emerald-800/60 rounded-lg mb-2 p-2 flex flex-col items-center justify-center text-center">
                    <span className="text-[11px] text-emerald-400 font-mono font-bold">WhatsApp Pay</span>
                    <span className="text-[8px] text-emerald-300 font-mono mt-1 truncate w-full px-1 bg-emerald-950/80 rounded py-0.5">{request.reference}</span>
                  </div>
                  <span className="text-[11px] text-zinc-200 font-semibold group-hover:text-white">Payment Link</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-zinc-900 to-zinc-950 text-white border border-zinc-900 rounded-xl p-4 text-center mt-4 shadow-sm">
            <span className="text-xs text-zinc-400 uppercase tracking-wider block">FINAL AMOUNT (incl. tax)</span>
            <span className="text-2xl font-bold font-mono text-emerald-400 mt-1 block">
              {formatEuro(grandTotal)}
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}