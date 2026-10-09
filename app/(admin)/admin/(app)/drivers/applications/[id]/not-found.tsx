import Link from "next/link";
import { SearchIcon } from "../../../../_components/icons";
import { btn, Card, EmptyState } from "../../../../_components/ui";

export default function ApplicationNotFound() {
  return (
    <Card className="mt-6">
      <EmptyState
        icon={<SearchIcon size={18} />}
        title="Application not found"
        description="It may have been deleted, or the link is incorrect."
        action={
          <Link href="/admin/drivers/applications" className={`${btn.base} ${btn.secondary} ${btn.md}`}>
            Back to all applications
          </Link>
        }
      />
    </Card>
  );
}
