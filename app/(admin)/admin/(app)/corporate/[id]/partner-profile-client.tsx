"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BriefcaseIcon,
  CalendarIcon,
  CarIcon,
  ChatIcon,
  CheckCircleIcon,
  CreditCardIcon,
  EuroIcon,
  MailIcon,
  NoteIcon,
  PhoneIcon,
  PlusIcon,
  TrendingUpIcon,
  UsersIcon,
} from "../../../_components/icons";
import { Avatar, btn, Card, CardHeader, StatCard } from "../../../_components/ui";

export function PartnerProfileClient({
  partner,
}: {
  partner: {
    id: string;
    name: string;
    companyName: string;
    kvkNumber: string;
    kvrNumber: string;
    bookerName: string;
    bookerPosition: string;
    bookerEmail: string;
    bookerPhone: string;
    tier: "Platinum" | "Gold" | "Silver";
    discountRate: string;
    status: "Active" | "Pending 2FA" | "Suspended";
    totalTrips: number;
    avgTripValue: number;
    totalSpend: number;
    topVehicle: string;
    recentBookings: Array<{
      id: string;
      reference: string;
      passengerName: string;
      route: string;
      vehicle: string;
      pickupDate: string;
      amount: number;
      status: string;
    }>;
    initialNotes: Array<{
      id: string;
      author: string;
      timestamp: string;
      content: string;
    }>;
  };
}) {
  const [notes, setNotes] = useState(partner.initialNotes);
  const [newNote, setNewNote] = useState("");
  const [isAddingNote, setIsAddingNote] = useState(false);

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    const noteItem = {
      id: `n-${Date.now()}`,
      author: "Admin Aish",
      timestamp: "Just now",
      content: newNote.trim(),
    };

    setNotes([noteItem, ...notes]);
    setNewNote("");
    setIsAddingNote(false);
  };

  const rawPhone = partner.bookerPhone.replace(/[^\d]/g, "");

  return (
    <div className="space-y-6">
      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Trips"
          value={partner.totalTrips}
          hint="Completed executive journeys"
          icon={<CarIcon size={18} />}
        />
        <StatCard
          label="Average Trip Value"
          value={`€ ${partner.avgTripValue.toFixed(2)}`}
          hint="Contracted rate applied"
          icon={<TrendingUpIcon size={18} />}
        />
        <StatCard
          tone="accent"
          label="Total Spend"
          value={`€ ${partner.totalSpend.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}`}
          hint="Contract YTD · Net of VAT"
          icon={<EuroIcon size={18} />}
        />
        <StatCard
          label="Top Preferred Vehicle"
          value="Mercedes-EQS"
          hint={partner.topVehicle}
          icon={<BriefcaseIcon size={18} />}
        />
      </div>

      {/* Booker Contact Card with Direct Actions */}
      <div className="rounded-xl border border-zinc-200/90 bg-white p-5 shadow-card flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <Avatar name={partner.bookerName} size="lg" />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-zinc-950">{partner.bookerName}</h2>
              <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                Primary Booker
              </span>
            </div>
            <p className="text-xs text-zinc-500">{partner.bookerPosition} · {partner.companyName}</p>
            <p className="text-xs text-zinc-400 mt-0.5 font-mono">
              {partner.bookerEmail} · {partner.bookerPhone}
            </p>
          </div>
        </div>

        {/* Quick Communication Actions (WhatsApp / Email / Call) */}
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`https://wa.me/${rawPhone}?text=${encodeURIComponent(`Dear ${partner.bookerName}, following up regarding your Ecram Execs executive travel account.`)}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 shadow-xs transition"
          >
            <ChatIcon size={14} /> Message {partner.bookerName.split(" ")[0]} (WhatsApp)
          </a>

          <a
            href={`mailto:${partner.bookerEmail}?subject=${encodeURIComponent(`Ecram Execs Executive Service — ${partner.name}`)}`}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-50 shadow-xs transition"
          >
            <MailIcon size={14} /> Email {partner.bookerName.split(" ")[0]}
          </a>

          <a
            href={`tel:${partner.bookerPhone.replace(/\s/g, "")}`}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-50 shadow-xs transition"
          >
            <PhoneIcon size={14} /> Call {partner.bookerName.split(" ")[0]}
          </a>
        </div>
      </div>

      {/* Main Split: Left = Recent Bookings Table, Right = Notes & Activity Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Recent Bookings (7 cols) */}
        <div className="lg:col-span-7 rounded-xl border border-zinc-200 bg-white shadow-card overflow-hidden">
          <div className="border-b border-zinc-100 p-4 sm:px-5 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-950">
                Recent Executive Bookings
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Chauffeur itineraries and billing status
              </p>
            </div>
            <Link
              href={`/admin/requests?q=${encodeURIComponent(partner.bookerName)}`}
              className="text-xs font-semibold text-zinc-600 hover:text-zinc-950 underline"
            >
              View All ({partner.totalTrips})
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-zinc-100 bg-zinc-50/50 text-[11px] uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Reference</th>
                  <th className="px-4 py-3 font-semibold">Passenger / Itinerary</th>
                  <th className="px-4 py-3 font-semibold">Vehicle</th>
                  <th className="px-4 py-3 font-semibold">Amount</th>
                  <th className="px-5 py-3 font-semibold text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {partner.recentBookings.map((b) => (
                  <tr key={b.id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/admin/requests/${b.id}`}
                        className="font-mono font-bold text-sky-700 hover:underline"
                      >
                        {b.reference}
                      </Link>
                      <span className="block text-[11px] text-zinc-400">{b.pickupDate}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="font-semibold text-zinc-900">{b.passengerName}</p>
                      <p className="text-[11px] text-zinc-500 truncate max-w-xs">{b.route}</p>
                    </td>
                    <td className="px-4 py-3.5 text-zinc-700">{b.vehicle}</td>
                    <td className="px-4 py-3.5 font-mono font-semibold text-zinc-950">
                      € {b.amount.toFixed(2)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${
                          b.status === "confirmed"
                            ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                            : "bg-zinc-100 text-zinc-600 ring-zinc-200"
                        }`}
                      >
                        {b.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Notes & Activity Timeline with [+ Add Note] (5 cols) */}
        <div className="lg:col-span-5 rounded-xl border border-zinc-200 bg-white shadow-card p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-950">
                Notes & Reminders Timeline
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                VIP protocol instructions & account manager logs
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsAddingNote(!isAddingNote)}
              className="flex items-center gap-1 rounded-lg bg-zinc-950 px-2.5 py-1 text-xs font-semibold text-white hover:bg-zinc-800 transition shadow-xs"
            >
              <PlusIcon size={12} /> Add Note
            </button>
          </div>

          {/* Add Note Form */}
          {isAddingNote && (
            <form onSubmit={handleAddNote} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 space-y-2 animate-fade-in">
              <label className="block text-xs font-medium text-zinc-700">New Account Note:</label>
              <textarea
                rows={3}
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add special instructions, billing notes, or VIP preferences..."
                className="w-full rounded border border-zinc-300 bg-white p-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900"
                required
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddingNote(false)}
                  className="rounded px-2.5 py-1 text-xs text-zinc-600 hover:text-zinc-950"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded bg-zinc-950 px-3 py-1 text-xs font-semibold text-white hover:bg-zinc-800"
                >
                  Save Note
                </button>
              </div>
            </form>
          )}

          {/* Timeline List */}
          <div className="space-y-3">
            {notes.length === 0 ? (
              <p className="text-xs text-zinc-400 py-4 text-center">No notes recorded yet for this partner.</p>
            ) : (
              notes.map((n) => (
                <div key={n.id} className="rounded-lg border border-zinc-100 bg-zinc-50/70 p-3 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-zinc-900">{n.author}</span>
                    <span className="font-mono text-zinc-400">{n.timestamp}</span>
                  </div>
                  <p className="text-xs text-zinc-700 leading-relaxed">{n.content}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
