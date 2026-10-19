import Link from "next/link";
import { getPartnerLink } from "@/lib/admin/portal";
import { interpolate } from "@/lib/i18n/interpolate";
import { adminDictionary } from "@/lib/i18n/get-dictionary";
import { BriefcaseIcon } from "../../../_components/icons";
import { btn, Card, CardHeader, field, fieldLabel } from "../../../_components/ui";
import { attachPartner, detachPartner } from "./portal-actions";

/**
 * Which partner account this request belongs to, if any. A linked request is in that partner's portal. When the
 * request's email address matches a partner who has an account, one click attaches it (it is never done automatically
 * when a form is submitted: anyone can type any address there).
 */
export async function PartnerCard({ requestId }: { requestId: string }) {
  const [data, { admin }] = await Promise.all([getPartnerLink(requestId), adminDictionary()]);
  if (!data) return null;
  const t = admin.partnerCard;
  const { linked, suggestion, partners } = data;

  return (
    <Card>
      <CardHeader title={t.title} description={t.note} icon={<BriefcaseIcon />} />
      <div className="flex flex-col gap-4 p-5">
        {linked ? (
          <>
            <p className="m-0 text-sm text-zinc-900">
              <span className="text-zinc-500">{t.linkedTo}</span> <strong>{linked.name}</strong>
              {linked.companyName ? <span className="text-zinc-600"> · {linked.companyName}</span> : null}
              <br />
              <Link href="/admin/corporate" className="text-xs text-zinc-500 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-950">
                {linked.email}
              </Link>
            </p>
            <form action={detachPartner}>
              <input type="hidden" name="requestId" value={requestId} />
              <button className={`${btn.base} ${btn.secondary} ${btn.md}`}>{t.detach}</button>
            </form>
          </>
        ) : (
          <>
            <p className="m-0 text-sm text-zinc-500">{t.notLinked}</p>
            {data.restricted && <p className="m-0 rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-700 ring-1 ring-inset ring-zinc-200">{t.historyNote}</p>}
            {suggestion && (
              <form action={attachPartner} className="flex flex-col gap-3 rounded-lg bg-amber-50 p-3 ring-1 ring-inset ring-amber-200">
                <p className="m-0 text-sm text-amber-950">{interpolate(t.suggest, { name: suggestion.name })}</p>
                <input type="hidden" name="requestId" value={requestId} />
                <input type="hidden" name="contactId" value={suggestion.id} />
                <button className={`${btn.base} ${btn.primary} ${btn.md} self-start`}>{t.attach}</button>
              </form>
            )}
            {partners.length === 0 ? (
              !data.restricted && <p className="m-0 text-sm text-zinc-500">{t.noPartners}</p>
            ) : (
              <form action={attachPartner} className="flex flex-col gap-2">
                <label htmlFor="attach-partner" className={fieldLabel}>
                  {t.attachLabel}
                </label>
                <select id="attach-partner" name="contactId" required defaultValue="" className={`${field} h-10 cursor-pointer`}>
                  <option value="" disabled>
                    {t.choose}
                  </option>
                  {partners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.companyName ? ` — ${p.companyName}` : ""} ({p.email})
                    </option>
                  ))}
                </select>
                <input type="hidden" name="requestId" value={requestId} />
                <button className={`${btn.base} ${btn.secondary} ${btn.md} self-start`}>{t.attach}</button>
              </form>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
