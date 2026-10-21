import { COOKIE_ROWS } from "@/lib/consent";
import type { Dictionary } from "@/lib/i18n/types";

/** The cookies the public site sets. Shown in the preferences dialog and in the privacy policy, from one list. */
export function CookieTable({ copy }: { copy: Dictionary["cookieConsent"] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-[13px]">
        <caption className="sr-only">{copy.tableTitle}</caption>
        <thead>
          <tr className="border-b border-ink-700 text-[11px] tracking-[0.18em] text-ink-450 uppercase">
            <th scope="col" className="py-2 pr-4 font-medium">
              {copy.colName}
            </th>
            <th scope="col" className="py-2 pr-4 font-medium">
              {copy.colPurpose}
            </th>
            <th scope="col" className="py-2 font-medium whitespace-nowrap">
              {copy.colDuration}
            </th>
          </tr>
        </thead>
        <tbody>
          {COOKIE_ROWS.map(([name, purpose, duration]) => (
            <tr key={name} className="border-b border-ink-800 align-top">
              <th scope="row" className="py-2.5 pr-4 font-mono text-[12px] font-normal text-ink-150">
                {name}
              </th>
              <td className="py-2.5 pr-4 text-ink-300">{copy[purpose]}</td>
              <td className="py-2.5 whitespace-nowrap text-ink-300">{copy[duration]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
