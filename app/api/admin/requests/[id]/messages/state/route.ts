import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requestMessageState } from "@/lib/admin/portal";
import { requireAdmin } from "@/lib/auth/session";

/**
 * What the open request Messages card polls: the latest message id and unread count.
 * Full message bodies stay on the RSC refresh path.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  }
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "not_found" }, { status: 404, headers });
  }
  const state = await requestMessageState(id);
  return NextResponse.json(state, { headers });
}
