import { NextRequest } from "next/server";
import { must, pick, runAdmin } from "../../../../lib/org/adminRoute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  return runAdmin(request, async ({ organizationId, supabase, body }) => {
    const patch = pick(body, ["name", "description", "price", "currency", "duration_minutes", "is_active", "is_reservable"]);
    const result = await supabase
      .from("services")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("organization_id", organizationId)
      .select("*")
      .maybeSingle();
    return { service: must(result, "서비스를 찾을 수 없습니다.") };
  });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { id } = await params;
  return runAdmin(request, async ({ organizationId, supabase }) => {
    const result = await supabase
      .from("services")
      .delete()
      .eq("id", id)
      .eq("organization_id", organizationId)
      .select("*")
      .maybeSingle();
    return { service: must(result, "서비스를 찾을 수 없습니다.") };
  });
}
