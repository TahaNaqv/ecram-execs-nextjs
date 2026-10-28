"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SearchIcon, PlusIcon, XIcon, BriefcaseIcon } from "../../_components/icons";
import type { CorporatePartnerRow } from "@/lib/admin/live-queries";
import { addCorporatePartner, deleteCorporatePartner } from "@/lib/admin/corporate-actions";
import { formatEuro } from "@/lib/admin/format";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { interpolate } from "@/lib/i18n/interpolate";

type HubCopy = Dictionary["admin"]["corporate"]["hub"];

export function CorporateDirectoryHub({ initialPartners = [], copy }: { initialPartners: CorporatePartnerRow[]; copy: HubCopy }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [partners, setPartners] = useState<CorporatePartnerRow[]>(initialPartners);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  
  // Selected partner for the right-side profile sidebar drawer
  const [selectedPartner, setSelectedPartner] = useState<CorporatePartnerRow | null>(null);
  
  // Sub-drawers/modals inside the profile sidebar
  const [activeTabDrawer, setActiveTabDrawer] = useState<"bookings" | "billing" | "edit" | null>(null);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const filteredPartners = partners.filter((p) => {
    const matchesSearch =
      p.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.kvk.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.bookerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "All" || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalActive = partners.filter((p) => p.status === "Active").length;
  const totalPending = partners.filter((p) => p.status === "Pending 2FA").length;
  const statusLabel = (status: string) =>
    status === "Active" ? copy.statusActive : status === "Pending 2FA" ? copy.statusPending : status === "Suspended" ? copy.statusSuspended : status;

  const handleAddPartner = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAddError(null);
    const formData = new FormData(e.currentTarget);

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
    if (!confirm(copy.deleteConfirm)) return;
    startTransition(async () => {
      await deleteCorporatePartner(id);
      setPartners((prev) => prev.filter((p) => p.id !== id));
      setSelectedPartner(null);
      router.refresh();
    });
  };

  const handleUpdatePartner = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Here you can hook up your update server action if available
    setActiveTabDrawer(null);
    router.refresh();
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
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-zinc-200 rounded-xl pl-9 pr-4 py-2.5 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-black/5"
            />
          </div>

          <div className="flex items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
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
          {filteredPartners.length === 0 ? (
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
                {filteredPartners.map((partner) => (
                  <tr
                    key={partner.id}
                    onClick={() => {
                      setSelectedPartner(partner);
                      setActiveTabDrawer(null);
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
            {interpolate(copy.showing, { shown: filteredPartners.length, total: partners.length })}
          </div>
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
                  <h2 className="text-lg font-bold text-zinc-950">{selectedPartner.companyName}</h2>
                  <p className="text-xs text-zinc-500 font-mono mt-0.5">
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
                  onClick={() => setActiveTabDrawer(activeTabDrawer === "edit" ? null : "edit")}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    activeTabDrawer === "edit"
                      ? "bg-black text-white border-black"
                      : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  {activeTabDrawer === "edit" ? copy.viewOverview : copy.editProfile}
                </button>

                {selectedPartner.activeBookings > 0 && (
                  <button
                    onClick={() => setActiveTabDrawer("bookings")}
                    className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors"
                  >
                    {interpolate(copy.viewBookings, { count: selectedPartner.activeBookings })}
                  </button>
                )}

                {selectedPartner.totalSpend > 0 && (
                  <button
                    onClick={() => setActiveTabDrawer("billing")}
                    className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors"
                  >
                    {copy.billingVat}
                  </button>
                )}
              </div>

              {/* Conditional Sub-views inside the sidebar drawer */}
              {activeTabDrawer === "bookings" ? (
                <div className="p-4 rounded-xl border border-zinc-200 bg-zinc-50 space-y-2 animate-in fade-in">
                  <h4 className="font-semibold text-xs text-zinc-900">{copy.recentBookings}</h4>
                  <p className="text-[11px] text-zinc-500">{interpolate(copy.recentBookingsNote, { company: selectedPartner.companyName })}</p>
                </div>
              ) : activeTabDrawer === "billing" ? (
                <div className="p-4 rounded-xl border border-zinc-200 bg-zinc-50 space-y-2 animate-in fade-in">
                  <h4 className="font-semibold text-xs text-zinc-900">{copy.billingLedger}</h4>
                  <p className="text-[11px] text-zinc-500">{copy.kvkNumber}: {selectedPartner.kvk}</p>
                </div>
              ) : activeTabDrawer === "edit" ? (
                /* --- FULL EDITABLE FORM FOR ALL FIELDS --- */
                <form onSubmit={handleUpdatePartner} className="p-4 rounded-xl border border-zinc-200 bg-zinc-50 space-y-3.5 animate-in fade-in text-xs">
                  <h4 className="font-bold text-zinc-900 text-sm mb-1">{copy.editDetails}</h4>
                  
                  <div>
                    <label className="block font-medium text-zinc-700 mb-1">{copy.companyLegalName}</label>
                    <input
                      type="text"
                      defaultValue={selectedPartner.companyName}
                      className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-black/5"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-medium text-zinc-700 mb-1">{copy.colKvk}</label>
                      <input
                        type="text"
                        defaultValue={selectedPartner.kvk}
                        className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 font-mono text-zinc-900 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-zinc-700 mb-1">{copy.preferredVehicle}</label>
                      <input
                        type="text"
                        defaultValue={selectedPartner.preferredVehicle}
                        className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-zinc-900 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-medium text-zinc-700 mb-1">{copy.bookerName}</label>
                      <input
                        type="text"
                        defaultValue={selectedPartner.bookerName}
                        className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-zinc-900 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-zinc-700 mb-1">{copy.bookerRole}</label>
                      <input
                        type="text"
                        defaultValue={selectedPartner.bookerRole}
                        className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-zinc-900 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-medium text-zinc-700 mb-1">{copy.bookerEmail}</label>
                      <input
                        type="email"
                        defaultValue={selectedPartner.email}
                        className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-zinc-900 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-zinc-700 mb-1">{copy.phone}</label>
                      <input
                        type="text"
                        defaultValue={selectedPartner.phone}
                        className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 font-mono text-zinc-900 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveTabDrawer(null)}
                      className="bg-zinc-200 hover:bg-zinc-300 text-zinc-800 font-semibold px-3 py-1.5 rounded-lg"
                    >
                      {copy.cancel}
                    </button>
                    <button
                      type="submit"
                      className="bg-black hover:bg-zinc-800 text-white font-semibold px-4 py-1.5 rounded-lg"
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
                onClick={() => handleDeletePartner(selectedPartner.id)}
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-zinc-700 mb-1">{copy.colKvk}</label>
                  <input
                    name="kvk"
                    type="text"
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-zinc-700 mb-1">{copy.bookerName}</label>
                  <input
                    name="bookerName"
                    type="text"
                    required
                    placeholder={copy.namePlaceholder}
                    className="w-full bg-white border border-zinc-200 rounded-xl px-3.5 py-2.5 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-black/5"
                  />
                </div>
                <div>
                  <label className="block font-medium text-zinc-700 mb-1">{copy.bookerEmail}</label>
                  <input
                    name="email"
                    type="email"
                    required
                    placeholder={copy.emailPlaceholder}
                    className="w-full bg-white border border-zinc-200 rounded-xl px-3.5 py-2.5 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-black/5"
                  />
                </div>
              </div>
              <div>
                <label className="block font-medium text-zinc-700 mb-1">{copy.phoneOptional}</label>
                <input
                  name="phone"
                  type="text"
                  placeholder={copy.phonePlaceholder}
                  className="w-full bg-white border border-zinc-200 rounded-xl px-3.5 py-2.5 font-mono text-zinc-900 focus:outline-none focus:ring-2 focus:ring-black/5"
                />
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