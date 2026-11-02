import { NextRequest } from "next/server";
import { must, pick, runAdmin } from "../../../../../lib/org/adminRoute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ itemId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { itemId } = await params;
  return runAdmin(request, async ({ organizationId, supabase, body }) => {
    const result = await supabase
      .from("service_items")
      .update({
        ...pick(body, ["name", "description", "base_price", "duration_minutes", "is_available"]),
        updated_at: new Date().toISOString(),
      })
      .eq("id", itemId)
      .eq("organization_id", organizationId)
      .select("*")
      .maybeSingle();
    return { item: must(result, "서비스 아이템을 찾을 수 없습니다.") };
  });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { itemId } = await params;
  return runAdmin(request, async ({ organizationId, supabase }) => {
    await supabase.from("service_item_options").delete().eq("service_item_id", itemId).eq("organization_id", organizationId);
    const { error } = await supabase.from("service_items").delete().eq("id", itemId).eq("organization_id", organizationId);
    if (error) throw error;
    return { ok: true };
  });
}
