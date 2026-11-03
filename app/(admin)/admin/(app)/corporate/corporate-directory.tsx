"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SearchIcon, PlusIcon, XIcon, BriefcaseIcon } from "../../_components/icons";
import type { CorporatePartnerRow } from "@/lib/admin/live-queries";
import { addCorporatePartner, deleteCorporatePartner, updateCorporatePartner } from "@/lib/admin/corporate-actions";
import { cleanPhoneInput, phoneLengthOk } from "@/lib/phone";
import { formatEuro, formatPickup, STATUS_STYLE } from "@/lib/admin/format";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { interpolate } from "@/lib/i18n/interpolate";
import type { RequestStatus } from "@/lib/quotes/constants";

type HubCopy = Dictionary["admin"]["corporate"]["hub"];

/** A plain text box. Chromium will not move a caret through type=email, and overflow on the input stops arrow keys from scrolling the value. */
const emailField =
  "box-border w-full min-w-0 max-w-full bg-white text-zinc-900 [text-overflow:clip] focus:outline-none focus:ring-2 focus:ring-black/5";
const phoneField =
  "box-border min-w-0 max-w-full flex-1 border-0 bg-transparent px-3 font-mono text-sm text-zinc-900 outline-none [text-overflow:clip]";

const phoneError = "Enter a phone number with 8 to 15 digits for the selected country.";

function keepPartnerPhone(event: FormEvent<HTMLInputElement>) {
  const input = event.currentTarget;
  const code = (input.form?.elements.namedItem("countryCode") as HTMLSelectElement | null)?.value ?? "+31";
  const next = cleanPhoneInput(input.value, code);
  if (input.value !== next) input.value = next;
}
const countryField =
  "w-[6.75rem] shrink-0 cursor-pointer border-0 border-r border-zinc-200 bg-transparent px-2 text-xs font-mono text-zinc-700 outline-none";

const COUNTRY_CODES = [
  { code: "+31", label: "NL +31" },
  { code: "+92", label: "PK +92" },
  { code: "+32", label: "BE +32" },
  { code: "+49", label: "DE +49" },
  { code: "+33", label: "FR +33" },
  { code: "+44", label: "GB +44" },
  { code: "+41", label: "CH +41" },
  { code: "+43", label: "AT +43" },
  { code: "+34", label: "ES +34" },
  { code: "+39", label: "IT +39" },
  { code: "+352", label: "LU +352" },
  { code: "+351", label: "PT +351" },
  { code: "+353", label: "IE +353" },
  { code: "+45", label: "DK +45" },
  { code: "+46", label: "SE +46" },
  { code: "+47", label: "NO +47" },
  { code: "+358", label: "FI +358" },
  { code: "+354", label: "IS +354" },
  { code: "+1", label: "US/CA +1" },
  { code: "+971", label: "AE +971" },
  { code: "+966", label: "SA +966" },
];

export function CorporateDirectoryHub({
  initialPartners = [],
  copy,
  statuses,
}: {
  initialPartners: CorporatePartnerRow[];
  copy: HubCopy;
  statuses: Dictionary["admin"]["statuses"];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [partners, setPartners] = useState<CorporatePartnerRow[]>(initialPartners);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  
  // Pagination State (10 records per page)
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  
  // Selected partner for the right-side profile sidebar drawer
  const [selectedPartner, setSelectedPartner] = useState<CorporatePartnerRow | null>(null);
  
  // Sub-drawers/modals inside the profile sidebar
  const [activeTabDrawer, setActiveTabDrawer] = useState<"bookings" | "billing" | "edit" | null>(null);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [partnerToDelete, setPartnerToDelete] = useState<CorporatePartnerRow | null>(null);

  useEffect(() => {
    setPartners(initialPartners);
    setSelectedPartner((current) => (current ? initialPartners.find((p) => p.id === current.id) ?? null : null));
  }, [initialPartners]);

  useEffect(() => {
    router.refresh();
  }, [router]);

  const filteredPartners = partners.filter((p) => {
    const matchesSearch =
      p.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.kvk.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.bookerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "All" || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Pagination calculation
  const totalPages = Math.ceil(filteredPartners.length / pageSize) || 1;
  const paginatedPartners = filteredPartners.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const totalActive = partners.filter((p) => p.status === "Active").length;
  const totalPending = partners.filter((p) => p.status === "Pending 2FA").length;
  const statusLabel = (status: string) =>
    status === "Active" ? copy.statusActive : status === "Pending 2FA" ? copy.statusPending : status === "Suspended" ? copy.statusSuspended : status;

  const handleAddPartner = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAddError(null);
    const formElement = e.currentTarget;
    const formData = new FormData(formElement);
    
    // Combine country code and phone number
    const countryCode = (formData.get("countryCode") as string) || "+31";
    const rawPhone = cleanPhoneInput((formData.get("phoneRaw") as string) || "", countryCode);
    if (!phoneLengthOk(countryCode, rawPhone)) {
      setAddError(phoneError);
      return;
    }
    formData.set("phone", `${countryCode} ${rawPhone}`);

    startTransition(async () => {
      const res = await addCorporatePartner(formData);
      if (res && !res.ok) {
        setAddError(res.error || copy.createFailed);
        return;
      }
      setIsAddModalOpen(false);
      router.refresh();
    });
  };

  const handleDeletePartner = (id: string) => {
    startTransition(async () => {
      const res = await deleteCorporatePartner(id);
      if (res && !res.ok) {
        alert(res.error || "Failed to delete account");
        return;
      }
      setPartners((prev) => prev.filter((p) => p.id !== id));
      setSelectedPartner(null);
      setPartnerToDelete(null);
      router.refresh();
    });
  };

  const handleUpdatePartner = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedPartner) return;
    const formElement = e.currentTarget;
    const formData = new FormData(formElement);
    formData.set("id", selectedPartner.id);

    const countryCode = (formData.get("countryCode") as string) || "+31";
    const rawPhone = cleanPhoneInput((formData.get("phoneRaw") as string) || "", countryCode);
    if (!phoneLengthOk(countryCode, rawPhone)) return;
    formData.set("phone", `${countryCode} ${rawPhone}`);

    startTransition(async () => {
      const res = await updateCorporatePartner(formData);
      if (res && !res.ok) return;
      router.refresh();
    });
  };

  return (
    <div className="w-full relative">
      {/* Corporate Partner Management Table */}
      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden flex flex-col w-full">
        {/* Top Controls Bar */}
        <div className="p-5 border-b border-zinc-100 flex flex-wrap items-center justify-between gap-4 bg-zinc-50/50">
          <div className="relative flex-1 min-w-[260px] max-w-md">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-400">
              <SearchIcon size={16} />
            </span>
            <input
              type="text"
              placeholder={copy.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1); // Reset to page 1 on search
              }}
              className="w-full bg-white border border-zinc-200 rounded-xl pl-9 pr-4 py-2.5 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-black/5"
            />
          </div>

          <div className="flex items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1); // Reset to page 1 on filter change
              }}
              className="bg-white border border-zinc-200 rounded-xl px-3.5 py-2.5 text-xs font-medium text-zinc-700 focus:outline-none cursor-pointer"
            >
              <option value="All">{copy.statusAll}</option>
              <option value="Active">{copy.statusActive}</option>
              <option value="Pending 2FA">{copy.statusPending}</option>
              <option value="Suspended">{copy.statusSuspended}</option>
            </select>

            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="bg-black hover:bg-zinc-800 text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition shadow-sm flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <PlusIcon size={14} /> {copy.addPartner}
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto w-full">
          {paginatedPartners.length === 0 ? (
            <div className="p-12 text-center text-xs text-zinc-500">
              <div className="grid size-12 place-items-center rounded-2xl bg-zinc-100 mx-auto mb-3 text-zinc-400">
                <BriefcaseIcon size={20} />
              </div>
              <p className="font-semibold text-zinc-900 text-sm">{copy.emptyTitle}</p>
              <p className="mt-1 text-zinc-500">{copy.emptyNote}</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="border-b border-zinc-100 bg-zinc-50/80 text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">
                <tr>
                  <th className="px-6 py-4">{copy.colCompany}</th>
                  <th className="px-5 py-4">{copy.colKvk}</th>
                  <th className="px-5 py-4">{copy.colBooker}</th>
                  <th className="px-5 py-4">{copy.colVehicle}</th>
                  <th className="px-5 py-4">{copy.colStatus}</th>
                  <th className="px-6 py-4">{copy.colSpend}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {paginatedPartners.map((partner) => (
                  <tr
                    key={partner.id}
                    onClick={() => {
                      setSelectedPartner(partner);
                      setActiveTabDrawer("edit");
                    }}
                    className="hover:bg-zinc-50/80 transition-colors cursor-pointer group"
                  >
                    <td className="px-6 py-4 font-semibold text-zinc-950">
                      <div className="flex items-center gap-3">
                        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-zinc-100 text-zinc-900 font-mono text-[11px] font-bold group-hover:bg-black group-hover:text-white transition-colors">
                          {partner.companyName.substring(0, 2).toUpperCase()}
                        </span>
                        <span className="text-sm">{partner.companyName}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 font-mono text-zinc-600">{partner.kvk}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="size-8 shrink-0 rounded-full bg-zinc-200 flex items-center justify-center text-[11px] font-bold text-zinc-700">
                          {partner.bookerName.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                        </div>
                        <div>
                          <p className="font-medium text-zinc-900">{partner.bookerName}</p>
                          <p className="text-[11px] text-zinc-500">({partner.bookerRole})</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-zinc-700 font-medium">{partner.preferredVehicle}</td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold ${
                          partner.status === "Active"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}
                      >
                        <span className="size-1.5 rounded-full bg-emerald-500" />
                        {statusLabel(partner.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono font-medium text-zinc-900">
                      {formatEuro(partner.totalSpend)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Bottom Pagination & Summary Bar */}
        <div className="p-4 sm:px-6 border-t border-zinc-100 bg-zinc-50/80 flex flex-wrap items-center justify-between gap-4 text-xs text-zinc-600">
          <div>
            {interpolate(copy.showing, { shown: paginatedPartners.length, total: filteredPartners.length })}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg border border-zinc-200 bg-white font-medium text-zinc-800 transition hover:bg-zinc-50 disabled:opacity-40 cursor-pointer"
              >
                Previous
              </button>
              <span className="font-mono text-[11px]">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-lg border border-zinc-200 bg-white font-medium text-zinc-800 transition hover:bg-zinc-50 disabled:opacity-40 cursor-pointer"
              >
                Next
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-6 font-mono text-[11px]">
            <div>{copy.activeCount} <span className="font-bold text-emerald-700">{totalActive}</span></div>
            <div>{copy.pendingCount} <span className="font-bold text-amber-700">{totalPending}</span></div>
          </div>
        </div>
      </div>

      {/* --- RIGHT-SIDE PROFILE SIDEBAR DRAWER --- */}
      {selectedPartner && (
        <div className="fixed inset-0 z-50 flex justify-end bg-zinc-950/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border-l border-zinc-200 w-full max-w-xl h-full p-6 shadow-2xl flex flex-col justify-between overflow-y-auto">
            <div className="space-y-6">
              {/* Drawer Header & Action Buttons */}
              <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-zinc-950">{selectedPartner.companyName}</h2>
                  <p className="mt-1 text-xs text-zinc-500">
                    {interpolate(copy.bookerLine, { kvk: selectedPartner.kvk, name: selectedPartner.bookerName })}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedPartner(null)}
                  className="text-zinc-400 hover:text-zinc-900 p-1.5 rounded-lg hover:bg-zinc-100 cursor-pointer"
                >
                  <XIcon size={18} />
                </button>
              </div>

              {/* Conditional Quick Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setActiveTabDrawer(activeTabDrawer === "edit" ? null : "edit")}
                  className={`rounded-full border px-4 py-2 text-xs font-semibold transition-colors ${
                    activeTabDrawer === "edit"
                      ? "border-zinc-950 bg-zinc-950 text-white"
                      : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50"
                  }`}
                >
                  {activeTabDrawer === "edit" ? copy.viewOverview : copy.editProfile}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTabDrawer("bookings")}
                  className={`rounded-full border px-4 py-2 text-xs font-semibold transition-colors ${
                    activeTabDrawer === "bookings"
                      ? "border-zinc-950 bg-zinc-950 text-white"
                      : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50"
                  }`}
                >
                  {interpolate(copy.viewBookings, { count: selectedPartner.bookings?.length || selectedPartner.activeBookings })}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTabDrawer("billing")}
                  className={`rounded-full border px-4 py-2 text-xs font-semibold transition-colors ${
                    activeTabDrawer === "billing"
                      ? "border-zinc-950 bg-zinc-950 text-white"
                      : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50"
                  }`}
                >
                  {copy.billingVat}
                </button>
              </div>

              {/* Conditional Sub-views inside the sidebar drawer */}
              {activeTabDrawer === "bookings" ? (
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-bold text-zinc-950">{copy.recentBookings}</h4>
                      <p className="mt-0.5 text-[11px] text-zinc-500">{interpolate(copy.recentBookingsNote, { company: selectedPartner.companyName })}</p>
                    </div>
                    <Link href={`/admin/corporate/${selectedPartner.id}/bookings`} className="shrink-0 text-[11px] font-medium text-sky-700 hover:underline">
                      {copy.openFull}
                    </Link>
                  </div>
                  {(selectedPartner.bookings ?? []).length === 0 ? (
                    <p className="rounded-lg border border-zinc-200 bg-white px-4 py-6 text-center text-xs text-zinc-500">{copy.noBookings}</p>
                  ) : (
                    <ul className="m-0 flex list-none flex-col gap-2 p-0">
                      {selectedPartner.bookings.map((booking) => {
                        const route = [booking.collection, booking.destination].filter(Boolean).join(" → ");
                        const status = booking.status as RequestStatus;
                        return (
                          <li key={booking.id}>
                            <Link href={`/admin/requests/${booking.id}`} className="block rounded-lg border border-zinc-200 bg-white p-3 no-underline hover:bg-zinc-50">
                              <span className="flex items-center justify-between gap-3">
                                <span className="font-mono text-xs font-bold text-sky-700">{booking.reference}</span>
                                <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${STATUS_STYLE[status] ?? "bg-zinc-100 text-zinc-700 ring-zinc-200"}`}>
                                  {statuses[status] ?? booking.status}
                                </span>
                              </span>
                              <span className="mt-1.5 block text-xs font-medium text-zinc-950">{route || booking.passengerName}</span>
                              <span className="mt-0.5 block text-[11px] text-zinc-500">
                                {[booking.pickupAt ? formatPickup(booking.pickupAt) : null, formatEuro(booking.amount), booking.passengerName].filter(Boolean).join(" · ")}
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              ) : activeTabDrawer === "billing" ? (
                <div className="p-4 rounded-xl border border-zinc-200 bg-zinc-50 space-y-2 animate-in fade-in">
                  <h4 className="font-semibold text-xs text-zinc-900">{copy.billingLedger}</h4>
                  <p className="text-[11px] text-zinc-500">{copy.kvkNumber}: {selectedPartner.kvk}</p>
                </div>
              ) : activeTabDrawer === "edit" ? (
                <form key={selectedPartner.id} onSubmit={handleUpdatePartner} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 text-xs">
                  <h4 className="mb-4 text-sm font-bold text-zinc-950">{copy.editDetails}</h4>

                  <div>
                    <label className="mb-1.5 block font-medium text-zinc-800">{copy.companyLegalName}</label>
                    <input
                      type="text"
                      name="companyName"
                      defaultValue={selectedPartner.companyName}
                      className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-black/5"
                    />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1.5 block font-medium text-zinc-800">{copy.colKvk}</label>
                      <input
                        type="text"
                        name="kvk"
                        maxLength={8}
                        minLength={8}
                        pattern="\d{8}"
                        title="Chamber of Commerce (KvK) number must be exactly 8 digits"
                        defaultValue={selectedPartner.kvk === "—" ? "" : selectedPartner.kvk}
                        className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 font-mono text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-black/5"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block font-medium text-zinc-800">{copy.preferredVehicle}</label>
                      <input
                        type="text"
                        defaultValue={selectedPartner.preferredVehicle}
                        readOnly
                        className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1.5 block font-medium text-zinc-800">{copy.bookerName}</label>
                      <input
                        type="text"
                        name="bookerName"
                        defaultValue={selectedPartner.bookerName}
                        className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-black/5"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block font-medium text-zinc-800">{copy.bookerRole}</label>
                      <input
                        type="text"
                        name="bookerRole"
                        defaultValue={selectedPartner.bookerRole}
                        className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-black/5"
                      />
                    </div>
                  </div>

                  <div className="mt-4 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="min-w-0">
                      <label className="mb-1.5 block font-medium text-zinc-800">{copy.bookerEmail}</label>
                      <input
                        type="text"
                        inputMode="email"
                        autoComplete="email"
                        spellCheck={false}
                        name="email"
                        defaultValue={selectedPartner.email}
                        className={`${emailField} h-10 rounded-lg border border-zinc-200 px-3 text-sm`}
                      />
                    </div>
                    <div className="min-w-0">
                      <label className="mb-1.5 block font-medium text-zinc-800">{copy.phone} *</label>
                      <div className="flex h-10 min-w-0 w-full overflow-hidden rounded-lg border border-zinc-200 bg-white focus-within:ring-2 focus-within:ring-black/5">
                        <select
                          name="countryCode"
                          defaultValue={selectedPartner.phone && selectedPartner.phone.startsWith("+") ? selectedPartner.phone.split(" ")[0] : "+31"}
                          className={countryField}
                        >
                          {COUNTRY_CODES.map((c) => (
                            <option key={c.code} value={c.code}>{c.label}</option>
                          ))}
                        </select>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          autoComplete="tel-national"
                          spellCheck={false}
                          name="phoneRaw"
                          required
                          onInput={keepPartnerPhone}
                          placeholder="3349440201"
                          defaultValue={
                            selectedPartner.phone && selectedPartner.phone !== "—"
                              ? selectedPartner.phone.replace(/^\+\d+\s*/, "")
                              : ""
                          }
                          className={phoneField}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveTabDrawer(null)}
                      className="rounded-lg bg-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-300"
                    >
                      {copy.cancel}
                    </button>
                    <button
                      type="submit"
                      disabled={isPending}
                      className="rounded-lg bg-zinc-950 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
                    >
                      {copy.save}
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  {/* Compact Overview Cards */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 space-y-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{copy.activeBookings}</p>
                      <p className="text-xl font-bold tracking-tight text-zinc-950">{selectedPartner.activeBookings}</p>
                    </div>
                    <div className="rounded-xl border border-zinc-950 bg-zinc-950 text-white p-4 space-y-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{copy.spendMtd}</p>
                      <p className="text-xl font-bold tracking-tight">{formatEuro(selectedPartner.totalSpend)}</p>
                    </div>
                  </div>

                  {/* Booker Contact Details */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{copy.primaryContact}</h3>
                    <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200/80 space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-zinc-500">{copy.name}</span>
                        <span className="font-semibold text-zinc-900">{selectedPartner.bookerName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">{copy.role}</span>
                        <span className="text-zinc-700">{selectedPartner.bookerRole}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">{copy.email}</span>
                        <span className="font-mono text-zinc-700">{selectedPartner.email}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">{copy.phoneLabel}</span>
                        <span className="font-mono text-zinc-700">{selectedPartner.phone}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="pt-6 border-t border-zinc-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setPartnerToDelete(selectedPartner)}
                className="text-rose-600 hover:bg-rose-50 font-semibold px-3 py-2 rounded-xl text-xs transition cursor-pointer"
              >
                {copy.deleteAccount}
              </button>
              <button
                type="button"
                onClick={() => setSelectedPartner(null)}
                className="bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-semibold px-4 py-2 rounded-xl text-xs transition cursor-pointer"
              >
                {copy.close}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal with Close (X) Button */}
      {partnerToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 backdrop-blur-sm p-4">
          <div className="bg-white border border-zinc-200 rounded-2xl max-w-md w-full p-6 shadow-2xl relative space-y-4">
            <button
              onClick={() => setPartnerToDelete(null)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-900 p-1 cursor-pointer"
            >
              <XIcon size={18} />
            </button>
            <h3 className="text-base font-semibold text-zinc-950">Delete Corporate Partner</h3>
            <p className="text-xs text-zinc-600 pr-6">
              {copy.deleteConfirm} ({partnerToDelete.companyName})
            </p>
            <div className="pt-3 border-t border-zinc-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => handleDeletePartner(partnerToDelete.id)}
                disabled={isPending}
                className="bg-rose-600 hover:bg-rose-500 text-white font-semibold px-5 py-2 rounded-xl text-xs cursor-pointer disabled:opacity-50"
              >
                {isPending ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add New Partner Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 backdrop-blur-xs p-4">
          <div className="bg-white border border-zinc-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-900 p-1 cursor-pointer"
            >
              <XIcon size={18} />
            </button>
            <h3 className="text-base font-semibold text-zinc-950 mb-1">{copy.addTitle}</h3>
            <p className="text-xs text-zinc-500 mb-4">{copy.addNote}</p>

            {addError && (
              <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
                {addError}
              </div>
            )}

            <form onSubmit={handleAddPartner} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-zinc-700 mb-1">{copy.companyLegalName}</label>
                <input
                  name="companyName"
                  type="text"
                  required
                  placeholder={copy.companyPlaceholder}
                  className="w-full bg-white border border-zinc-200 rounded-xl px-3.5 py-2.5 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-black/5"
                />
              </div>
              <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="min-w-0">
                  <label className="block font-medium text-zinc-700 mb-1">{copy.colKvk}</label>
                  <input
                    name="kvk"
                    type="text"
                    maxLength={8}
                    minLength={8}
                    pattern="\d{8}"
                    title="Chamber of Commerce (KvK) number must be exactly 8 digits"
                    placeholder={copy.kvkPlaceholder}
                    className="w-full bg-white border border-zinc-200 rounded-xl px-3.5 py-2.5 font-mono text-zinc-900 focus:outline-none focus:ring-2 focus:ring-black/5"
                  />
                </div>
                <div>
                  <label className="block font-medium text-zinc-700 mb-1">{copy.bookerRoleTitle}</label>
                  <input
                    name="bookerRole"
                    type="text"
                    placeholder={copy.rolePlaceholder}
                    className="w-full bg-white border border-zinc-200 rounded-xl px-3.5 py-2.5 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-black/5"
                  />
                </div>
              </div>
              <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="min-w-0">
                  <label className="block font-medium text-zinc-700 mb-1">{copy.bookerName}</label>
                  <input
                    name="bookerName"
                    type="text"
                    required
                    placeholder={copy.namePlaceholder}
                    className="w-full bg-white border border-zinc-200 rounded-xl px-3.5 py-2.5 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-black/5"
                  />
                </div>
                <div className="min-w-0">
                  <label className="block font-medium text-zinc-700 mb-1">{copy.bookerEmail}</label>
                  <input
                    name="email"
                    type="text"
                    inputMode="email"
                    autoComplete="email"
                    spellCheck={false}
                    required
                    placeholder={copy.emailPlaceholder}
                    className={`${emailField} rounded-xl border border-zinc-200 px-3.5 py-2.5`}
                  />
                </div>
              </div>
              <div className="min-w-0">
                <label className="block font-medium text-zinc-700 mb-1">Direct Phone *</label>
                <div className="flex h-10 min-w-0 w-full overflow-hidden rounded-xl border border-zinc-200 bg-white focus-within:ring-2 focus-within:ring-black/5">
                  <select
                    name="countryCode"
                    defaultValue="+31"
                    className={countryField}
                  >
                    {COUNTRY_CODES.map((c) => (
                      <option key={c.code} value={c.code}>{c.label}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="tel-national"
                    spellCheck={false}
                    name="phoneRaw"
                    required
                    onInput={keepPartnerPhone}
                    placeholder="3349440201"
                    className={phoneField}
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-semibold px-4 py-2 rounded-xl cursor-pointer"
                >
                  {copy.cancel}
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="bg-black hover:bg-zinc-800 text-white font-semibold px-5 py-2 rounded-xl cursor-pointer disabled:opacity-50"
                >
                  {isPending ? copy.registering : copy.registerPartner}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}