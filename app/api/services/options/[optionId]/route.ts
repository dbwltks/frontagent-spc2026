import { NextRequest } from "next/server";
import { must, pick, runAdmin } from "../../../../../lib/org/adminRoute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ optionId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { optionId } = await params;
  return runAdmin(request, async ({ organizationId, supabase, body }) => {
    const result = await supabase
      .from("service_item_options")
      .update({
        ...pick(body, ["option_group", "option_value", "description", "additional_price", "additional_duration", "is_available"]),
        updated_at: new Date().toISOString(),
      })
      .eq("id", optionId)
      .eq("organization_id", organizationId)
      .select("*")
      .maybeSingle();
    return { option: must(result, "옵션을 찾을 수 없습니다.") };
  });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { optionId } = await params;
  return runAdmin(request, async ({ organizationId, supabase }) => {
    const { error } = await supabase.from("service_item_options").delete().eq("id", optionId).eq("organization_id", organizationId);
    if (error) throw error;
    return { ok: true };
  });
}
