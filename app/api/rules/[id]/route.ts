import { NextRequest } from "next/server";
import { must, pick, runAdmin } from "../../../../lib/org/adminRoute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  return runAdmin(request, async ({ organizationId, supabase, body }) => {
    const result = await supabase
      .from("rules")
      .update({ ...pick(body, ["name", "instruction", "is_active"]), updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("organization_id", organizationId)
      .select("*")
      .maybeSingle();
    return must(result, "규칙을 찾을 수 없습니다.");
  });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { id } = await params;
  return runAdmin(request, async ({ organizationId, supabase }) => {
    const { error } = await supabase.from("rules").delete().eq("id", id).eq("organization_id", organizationId);
    if (error) throw error;
    return { ok: true };
  });
}
