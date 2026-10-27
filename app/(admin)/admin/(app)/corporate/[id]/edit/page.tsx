"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";

export default function EditCorporatePartnerPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();

  const [companyName, setCompanyName] = useState("Deloitte Amsterdam");
  const [kvk, setKvk] = useState("34289765");
  const [status, setStatus] = useState("Active");
  const [bookerName, setBookerName] = useState("Lisa van der Meer");
  const [bookerRole, setBookerRole] = useState("Travel Manager");
  const [vehicle, setVehicle] = useState("Mercedes-Benz EQS");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert(`Partner profile for ${companyName} (ID: ${resolvedParams.id}) updated successfully!`);
    router.push("/admin/corporate");
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Edit Corporate Partner Profile</h1>
        <p className="text-sm text-zinc-500 mt-1">Modifying configuration and compliance settings for partner ID: {resolvedParams.id}</p>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-zinc-700 mb-1">Company Name</label>
            <input 
              type="text" 
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
              className="w-full bg-white border border-zinc-200 rounded-xl px-3.5 py-2.5 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-black/5"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-zinc-700 mb-1">KVK Number</label>
              <input 
                type="text" 
                value={kvk}
                onChange={(e) => setKvk(e.target.value)}
                required
                className="w-full bg-white border border-zinc-200 rounded-xl px-3.5 py-2.5 font-mono text-zinc-900 focus:outline-none focus:ring-2 focus:ring-black/5"
              />
            </div>
            <div>
              <label className="block font-medium text-zinc-700 mb-1">Account Status</label>
              <select 
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2.5 text-zinc-900 focus:outline-none cursor-pointer"
              >
                <option value="Active">Active</option>
                <option value="Pending 2FA">Pending 2FA</option>
                <option value="Suspended">Suspended</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-zinc-700 mb-1">Primary Booker Name</label>
              <input 
                type="text" 
                value={bookerName}
                onChange={(e) => setBookerName(e.target.value)}
                required
                className="w-full bg-white border border-zinc-200 rounded-xl px-3.5 py-2.5 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-black/5"
              />
            </div>
            <div>
              <label className="block font-medium text-zinc-700 mb-1">Booker Role / Title</label>
              <input 
                type="text" 
                value={bookerRole}
                onChange={(e) => setBookerRole(e.target.value)}
                required
                className="w-full bg-white border border-zinc-200 rounded-xl px-3.5 py-2.5 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-black/5"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-zinc-700 mb-1">Preferred Electric Vehicle</label>
            <input 
              type="text" 
              value={vehicle}
              onChange={(e) => setVehicle(e.target.value)}
              required
              className="w-full bg-white border border-zinc-200 rounded-xl px-3.5 py-2.5 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-black/5"
            />
          </div>

          <div className="pt-4 border-t border-zinc-100 flex gap-3">
            <button
              type="submit"
              className="bg-black hover:bg-zinc-800 text-white font-semibold px-5 py-2.5 rounded-xl transition cursor-pointer"
            >
              Save Changes
            </button>
            <button
              type="button"
              onClick={() => router.push("/admin/corporate")}
              className="bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-semibold px-5 py-2.5 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}