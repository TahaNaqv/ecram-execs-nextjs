"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SearchIcon, PlusIcon, XIcon, BriefcaseIcon } from "../../_components/icons";
import type { CorporatePartnerRow } from "@/lib/admin/live-queries";
import { addCorporatePartner, deleteCorporatePartner } from "@/lib/admin/corporate-actions";
import { formatEuro } from "@/lib/admin/format";

export function CorporateDirectoryHub({ initialPartners = [] }: { initialPartners: CorporatePartnerRow[] }) {
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

  const handleAddPartner = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAddError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const res = await addCorporatePartner(formData);
      if (res && !res.ok) {
        setAddError(res.error || "Failed to create partner");
        return;
      }
      setIsAddModalOpen(false);
      router.refresh();
    });
  };

  const handleDeletePartner = (id: string) => {
    if (!confirm("Are you sure you want to remove this corporate partner account?")) return;
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
              placeholder="Search by company name, KVK, booker, or email..."
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
              <option value="All">Status: All</option>
              <option value="Active">Active</option>
              <option value="Pending 2FA">Pending 2FA</option>
              <option value="Suspended">Suspended</option>
            </select>

            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="bg-black hover:bg-zinc-800 text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition shadow-sm flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <PlusIcon size={14} /> Add New Partner
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
              <p className="font-semibold text-zinc-900 text-sm">No corporate partners found</p>
              <p className="mt-1 text-zinc-500">No partners match the current search or status filter.</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="border-b border-zinc-100 bg-zinc-50/80 text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">
                <tr>
                  <th className="px-6 py-4">Company Name</th>
                  <th className="px-5 py-4">KVK Number</th>
                  <th className="px-5 py-4">Booker Details</th>
                  <th className="px-5 py-4">Preferred Vehicle</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-6 py-4">Spend MTD</th>
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
                        {partner.status}
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
            Showing <span className="font-bold text-zinc-900">{filteredPartners.length} of {partners.length}</span> partners
          </div>
          <div className="flex flex-wrap items-center gap-6 font-mono text-[11px]">
            <div>Active: <span className="font-bold text-emerald-700">{totalActive}</span></div>
            <div>Pending: <span className="font-bold text-amber-700">{totalPending}</span></div>
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
                    KVK: {selectedPartner.kvk} &bull; Booker: {selectedPartner.bookerName}
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
                  {activeTabDrawer === "edit" ? "View Overview" : "Edit Profile"}
                </button>

                {selectedPartner.activeBookings > 0 && (
                  <button
                    onClick={() => setActiveTabDrawer("bookings")}
                    className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors"
                  >
                    View Bookings ({selectedPartner.activeBookings})
                  </button>
                )}

                {selectedPartner.totalSpend > 0 && (
                  <button
                    onClick={() => setActiveTabDrawer("billing")}
                    className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors"
                  >
                    Billing &amp; VAT
                  </button>
                )}
              </div>

              {/* Conditional Sub-views inside the sidebar drawer */}
              {activeTabDrawer === "bookings" ? (
                <div className="p-4 rounded-xl border border-zinc-200 bg-zinc-50 space-y-2 animate-in fade-in">
                  <h4 className="font-semibold text-xs text-zinc-900">Recent Itineraries &amp; Bookings</h4>
                  <p className="text-[11px] text-zinc-500">Detailed logs for {selectedPartner.companyName}.</p>
                </div>
              ) : activeTabDrawer === "billing" ? (
                <div className="p-4 rounded-xl border border-zinc-200 bg-zinc-50 space-y-2 animate-in fade-in">
                  <h4 className="font-semibold text-xs text-zinc-900">Billing Ledger &amp; KVK Verification</h4>
                  <p className="text-[11px] text-zinc-500">KVK: {selectedPartner.kvk}</p>
                </div>
              ) : activeTabDrawer === "edit" ? (
                /* --- FULL EDITABLE FORM FOR ALL FIELDS --- */
                <form onSubmit={handleUpdatePartner} className="p-4 rounded-xl border border-zinc-200 bg-zinc-50 space-y-3.5 animate-in fade-in text-xs">
                  <h4 className="font-bold text-zinc-900 text-sm mb-1">Edit Partner Details</h4>
                  
                  <div>
                    <label className="block font-medium text-zinc-700 mb-1">Company Legal Name</label>
                    <input
                      type="text"
                      defaultValue={selectedPartner.companyName}
                      className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-black/5"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-medium text-zinc-700 mb-1">KVK Number</label>
                      <input
                        type="text"
                        defaultValue={selectedPartner.kvk}
                        className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 font-mono text-zinc-900 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-zinc-700 mb-1">Preferred Vehicle</label>
                      <input
                        type="text"
                        defaultValue={selectedPartner.preferredVehicle}
                        className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-zinc-900 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-medium text-zinc-700 mb-1">Primary Booker Name</label>
                      <input
                        type="text"
                        defaultValue={selectedPartner.bookerName}
                        className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-zinc-900 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-zinc-700 mb-1">Booker Role</label>
                      <input
                        type="text"
                        defaultValue={selectedPartner.bookerRole}
                        className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-zinc-900 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-medium text-zinc-700 mb-1">Booker Email</label>
                      <input
                        type="email"
                        defaultValue={selectedPartner.email}
                        className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-zinc-900 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-zinc-700 mb-1">Phone Number</label>
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
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="bg-black hover:bg-zinc-800 text-white font-semibold px-4 py-1.5 rounded-lg"
                    >
                      Save Changes
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  {/* Compact Overview Cards */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 space-y-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Active Bookings</p>
                      <p className="text-xl font-bold tracking-tight text-zinc-950">{selectedPartner.activeBookings}</p>
                    </div>
                    <div className="rounded-xl border border-zinc-950 bg-zinc-950 text-white p-4 space-y-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Total Spend MTD</p>
                      <p className="text-xl font-bold tracking-tight">{formatEuro(selectedPartner.totalSpend)}</p>
                    </div>
                  </div>

                  {/* Booker Contact Details */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Primary Contact</h3>
                    <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200/80 space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Name:</span>
                        <span className="font-semibold text-zinc-900">{selectedPartner.bookerName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Role:</span>
                        <span className="text-zinc-700">{selectedPartner.bookerRole}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Email:</span>
                        <span className="font-mono text-zinc-700">{selectedPartner.email}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Phone:</span>
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
                Delete Account
              </button>
              <button
                type="button"
                onClick={() => setSelectedPartner(null)}
                className="bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-semibold px-4 py-2 rounded-xl text-xs transition cursor-pointer"
              >
                Close
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
            <h3 className="text-base font-semibold text-zinc-950 mb-1">Add New Corporate Partner</h3>
            <p className="text-xs text-zinc-500 mb-4">Register a verified B2B corporate account in the database.</p>

            {addError && (
              <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
                {addError}
              </div>
            )}

            <form onSubmit={handleAddPartner} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-zinc-700 mb-1">Company Legal Name</label>
                <input
                  name="companyName"
                  type="text"
                  required
                  placeholder="e.g. Shell Nederland B.V."
                  className="w-full bg-white border border-zinc-200 rounded-xl px-3.5 py-2.5 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-black/5"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-zinc-700 mb-1">KVK Number</label>
                  <input
                    name="kvk"
                    type="text"
                    placeholder="8 digits"
                    className="w-full bg-white border border-zinc-200 rounded-xl px-3.5 py-2.5 font-mono text-zinc-900 focus:outline-none focus:ring-2 focus:ring-black/5"
                  />
                </div>
                <div>
                  <label className="block font-medium text-zinc-700 mb-1">Booker Role / Title</label>
                  <input
                    name="bookerRole"
                    type="text"
                    placeholder="e.g. Travel Manager"
                    className="w-full bg-white border border-zinc-200 rounded-xl px-3.5 py-2.5 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-black/5"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-zinc-700 mb-1">Primary Booker Name</label>
                  <input
                    name="bookerName"
                    type="text"
                    required
                    placeholder="Full Name"
                    className="w-full bg-white border border-zinc-200 rounded-xl px-3.5 py-2.5 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-black/5"
                  />
                </div>
                <div>
                  <label className="block font-medium text-zinc-700 mb-1">Booker Email</label>
                  <input
                    name="email"
                    type="email"
                    required
                    placeholder="name@company.com"
                    className="w-full bg-white border border-zinc-200 rounded-xl px-3.5 py-2.5 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-black/5"
                  />
                </div>
              </div>
              <div>
                <label className="block font-medium text-zinc-700 mb-1">Direct Phone (Optional)</label>
                <input
                  name="phone"
                  type="text"
                  placeholder="+31 20 123 4567"
                  className="w-full bg-white border border-zinc-200 rounded-xl px-3.5 py-2.5 font-mono text-zinc-900 focus:outline-none focus:ring-2 focus:ring-black/5"
                />
              </div>

              <div className="pt-4 border-t border-zinc-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-semibold px-4 py-2 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="bg-black hover:bg-zinc-800 text-white font-semibold px-5 py-2 rounded-xl cursor-pointer disabled:opacity-50"
                >
                  {isPending ? "Registering..." : "Register Partner"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}