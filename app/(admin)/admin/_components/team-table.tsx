import { ACCOUNT_AREAS, type AccountArea, type StaffRole } from "@/lib/admin/access";

const badge: Record<StaffRole, string> = {
  staff: "border-zinc-200 bg-zinc-50 text-zinc-800",
  manager: "border-slate-200 bg-slate-50 text-slate-800",
  owner: "border-zinc-950 bg-zinc-950 text-white",
};

type Person = { id: string; name: string; email: string; role: string; permissions: string[] | null };

export function TeamTable({
  people,
  labels,
  roleLabel,
  ownersAll,
  columns,
  empty,
}: {
  people: Person[];
  labels: Record<AccountArea, string>;
  roleLabel: Record<StaffRole, string>;
  ownersAll: string;
  columns: { name: string; email: string; role: string; permissions: string };
  empty: string;
}) {
  if (people.length === 0) return <p className="m-0 px-5 py-4 text-sm text-zinc-600">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-100 text-[12px] tracking-wide text-zinc-500 uppercase">
            <th className="px-5 py-2 font-medium">{columns.name}</th>
            <th className="px-5 py-2 font-medium">{columns.email}</th>
            <th className="px-5 py-2 font-medium">{columns.role}</th>
            <th className="px-5 py-2 font-medium">{columns.permissions}</th>
          </tr>
        </thead>
        <tbody>
          {people.map((person) => {
            const role: StaffRole = person.role === "owner" || person.role === "manager" ? person.role : "staff";
            const areas = role === "owner" ? ACCOUNT_AREAS : ACCOUNT_AREAS.filter((area) => (person.permissions ?? []).includes(area));
            return (
              <tr key={person.id} className="border-b border-zinc-100 last:border-0">
                <td className="px-5 py-3 font-medium text-zinc-950">{person.name}</td>
                <td className="px-5 py-3 text-zinc-700">{person.email}</td>
                <td className="px-5 py-3">
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium tracking-wide ${badge[role]}`}>{roleLabel[role]}</span>
                </td>
                <td className="px-5 py-3">
                  {role === "owner" ? (
                    <span className="text-[13px] leading-snug text-zinc-700">{ownersAll}</span>
                  ) : (
                    <span className="flex flex-wrap gap-1.5">
                      {areas.length === 0 ? <span className="text-zinc-400">—</span> : areas.map((area) => (
                        <span key={area} className="inline-flex rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[11px] text-zinc-800">{labels[area]}</span>
                      ))}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
