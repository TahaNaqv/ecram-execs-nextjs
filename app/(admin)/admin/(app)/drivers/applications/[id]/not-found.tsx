import Link from "next/link";
import { adminDictionary } from "@/lib/i18n/get-dictionary";
import { SearchIcon } from "../../../../_components/icons";
import { btn, Card, EmptyState } from "../../../../_components/ui";

export default async function ApplicationNotFound() {
  const { admin: t } = await adminDictionary();
  return (
    <Card className="mt-6">
      <EmptyState
        icon={<SearchIcon size={18} />}
        title={t?.common?.applicationNotFound ?? "Application not found"}
        description={t?.common?.notFoundNote ?? "The requested application could not be found."}
        action={
          <Link href="/admin/drivers/applications" className={`${btn.base} ${btn.secondary} ${btn.md}`}>
            {t?.common?.backToApplications ?? "Back to Applications"}
          </Link>
        }
      />
    </Card>
  );
}