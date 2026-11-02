import { NextRequest } from "next/server";
import { HttpError, must, runAdmin } from "../../../../lib/org/adminRoute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: NextRequest) {
  return runAdmin(request, async ({ organizationId, supabase, body }) => {
    if (typeof body.name !== "string" || !body.name.trim()) throw new HttpError("name이 필요합니다.");
    const result = await supabase
      .from("services")
      .insert({
        organization_id: organizationId,
        name: body.name.trim(),
        description: body.description ?? null,
        price: body.price ?? null,
        currency: body.currency ?? "KRW",
        duration_minutes: body.duration_minutes ?? 60,
        is_active: body.is_active ?? true,
        is_reservable: body.is_reservable ?? true,
        approval_status: "approved",
      })
      .select("*")
      .single();
    return { service: must(result) };
  });
}
