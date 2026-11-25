import { unstable_rethrow } from "next/navigation";
import { NextResponse } from "next/server";
import { can } from "@/lib/admin/access";
import { requireAdmin } from "@/lib/auth/session";
import { evFinancialInputSchema } from "@/lib/financials/ev-input";
import {
  createVehicleFinancial,
  getVehicleFinancial,
  metricsFor,
  updateVehicleFinancial,
  vehicleExists,
  viewFromRow,
} from "@/lib/financials/vehicle-financials";

type Params = { params: Promise<{ id: string }> };

function invalid(error: { issues: { path: PropertyKey[]; message: string }[] }) {
  return NextResponse.json(
    {
      error: "Check the amounts and try again.",
      fields: Object.fromEntries(error.issues.map((issue) => [issue.path.join("."), issue.message])),
    },
    { status: 400 },
  );
}

async function readBody(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function GET(_request: Request, { params }: Params) {
  try {
    const admin = await requireAdmin();
    if (!can(admin.role, admin.permissions, "fleet")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { id } = await params;
    if (!(await vehicleExists(id))) return NextResponse.json({ error: "Vehicle not found." }, { status: 404 });
    const row = await getVehicleFinancial(id);
    return NextResponse.json(viewFromRow(row, id));
  } catch (error) {
    unstable_rethrow(error);
    console.error("[vehicle-financials] read failed", error);
    return NextResponse.json({ error: "The vehicle costs could not be loaded." }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const admin = await requireAdmin();
    if (!can(admin.role, admin.permissions, "fleet")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { id } = await params;
    if (!(await vehicleExists(id))) return NextResponse.json({ error: "Vehicle not found." }, { status: 404 });
    if (await getVehicleFinancial(id)) return NextResponse.json({ error: "This vehicle already has financial details. Update them instead." }, { status: 409 });
    const parsed = evFinancialInputSchema.safeParse(await readBody(request));
    if (!parsed.success) return invalid(parsed.error);
    const row = await createVehicleFinancial(id, parsed.data);
    const figures = metricsFor(parsed.data);
    return NextResponse.json({ ...viewFromRow(row, id), ...figures }, { status: 201 });
  } catch (error) {
    unstable_rethrow(error);
    console.error("[vehicle-financials] create failed", error);
    return NextResponse.json({ error: "The vehicle costs could not be saved." }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const admin = await requireAdmin();
    if (!can(admin.role, admin.permissions, "fleet")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { id } = await params;
    if (!(await vehicleExists(id))) return NextResponse.json({ error: "Vehicle not found." }, { status: 404 });
    const parsed = evFinancialInputSchema.safeParse(await readBody(request));
    if (!parsed.success) return invalid(parsed.error);
    const row = await updateVehicleFinancial(id, parsed.data);
    if (!row) return NextResponse.json({ error: "This vehicle has no financial details yet. Create them first." }, { status: 404 });
    const figures = metricsFor(parsed.data);
    return NextResponse.json({ ...viewFromRow(row, id), ...figures });
  } catch (error) {
    unstable_rethrow(error);
    console.error("[vehicle-financials] update failed", error);
    return NextResponse.json({ error: "The vehicle costs could not be saved." }, { status: 500 });
  }
}
