import { formatTimestamp } from "@/lib/admin/format";
import { listRequestInvoices } from "@/lib/admin/portal";
import { adminDictionary } from "@/lib/i18n/get-dictionary";
import { storageConfigured } from "@/lib/storage";
import { NoteIcon } from "../../../_components/icons";
import { Card, CardHeader } from "../../../_components/ui";
import { InvoiceUpload } from "./invoice-upload";
import { DeleteInvoiceButton } from "./delete-invoice-button";

/** PDF invoices the partner can download from their booking. Needs the request to be linked to a partner and document storage to be on. */
export async function InvoicesCard({ requestId, linked }: { requestId: string; linked: boolean }) {
  const [invoices, { admin }] = await Promise.all([listRequestInvoices(requestId), adminDictionary()]);
  const t = admin.invoices;
  const storage = storageConfigured();
  if (!linked && invoices.length === 0) return null;

  return (
    <Card>
      <CardHeader title={t.title} description={t.note} icon={<NoteIcon />} />
      <div className="flex flex-col gap-4 p-5">
        {invoices.length === 0 ? (
          <p className="m-0 text-sm text-zinc-500">{t.none}</p>
        ) : (
          <ul className="m-0 flex list-none flex-col divide-y divide-zinc-100 p-0">
            {invoices.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <span className="min-w-0 wrap-break-word text-sm text-zinc-900">
                  {inv.fileName}
                  <span className="block text-xs text-zinc-500">{formatTimestamp(inv.createdAt)}</span>
                </span>
                <DeleteInvoiceButton invoiceId={inv.id} label={t.delete} confirm={t.deleteConfirm} />
              </li>
            ))}
          </ul>
        )}
        {!linked ? (
          <p className="m-0 text-sm text-zinc-500">{t.needsPartner}</p>
        ) : storage ? (
          <InvoiceUpload requestId={requestId} copy={{ upload: t.upload, uploading: t.uploading, notPdf: t.notPdf, failed: t.failed }} />
        ) : (
          <p className="m-0 text-sm text-zinc-500">{t.storageOff}</p>
        )}
      </div>
    </Card>
  );
}
