import Link from "next/link";
import { adminDictionary } from "@/lib/i18n/get-dictionary";
import { SearchIcon } from "../../../_components/icons";
import { btn, Card, EmptyState } from "../../../_components/ui";

export default async function RequestNotFound() {
  const { admin: t } = await adminDictionary();
  return (
    <Card className="mt-6">
      <EmptyState
        icon={<SearchIcon size={18} />}
        title={t.common.requestNotFound}
        description={t.common.notFoundNote}
        action={
          <Link href="/admin" className={`${btn.base} ${btn.secondary} ${btn.md}`}>
            {t.common.backToRequests}
          </Link>
        }
      />
    </Card>
  );
}
