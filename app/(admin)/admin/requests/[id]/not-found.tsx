import Link from "next/link";

export default function RequestNotFound() {
  return (
    <div className="mt-10 rounded-lg border border-zinc-200 bg-white p-8 text-center">
      <h1 className="text-lg font-semibold">Request not found</h1>
      <p className="mt-2 text-sm text-zinc-600">It may have been deleted.</p>
      <Link href="/admin" className="mt-4 inline-block text-sm underline">
        Back to all requests
      </Link>
    </div>
  );
}
