import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "../../../../lib/supabase/service";
import { OrganizationAccessError, resolveAdminOrganization } from "../../../../lib/org/resolveOrganization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SELECT_FIELDS =
  "id, organization_id, name, description, trigger_intent, trigger_description, trigger_examples, allowed_channels, filters, is_enabled, created_at, updated_at";

// 프론트(tasksApi.ts)가 PATCH/DELETE에 organization_id를 안 실어보내서, flow row에서
// 먼저 organization_id를 찾아 그걸로 접근 권한을 검증한다.
async function resolveFlowOrganization(flowId: string) {
  const supabase = createSupabaseServiceClient();
  const { data } = await supabase.from("task_flows").select("organization_id").eq("id", flowId).maybeSingle();
  if (!data) throw new OrganizationAccessError("찾을 수 없습니다.");
  await resolveAdminOrganization(data.organization_id);
  return data.organization_id as string;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: flowId } = await params;
  const body = await request.json().catch(() => ({}));

  try {
    await resolveFlowOrganization(flowId);
    const supabase = createSupabaseServiceClient();

    const patch: Record<string, unknown> = {};
    for (const key of ["name", "description", "trigger_intent", "trigger_description", "trigger_examples", "allowed_channels", "filters", "is_enabled"]) {
      if (key in (body ?? {})) patch[key] = body[key];
    }

    const { data, error } = await supabase.from("task_flows").update(patch).eq("id", flowId).select(SELECT_FIELDS).single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof OrganizationAccessError) return NextResponse.json({ error: err.message }, { status: 403 });
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: flowId } = await params;

  try {
    await resolveFlowOrganization(flowId);
    const supabase = createSupabaseServiceClient();
    await supabase.from("task_edges").delete().eq("flow_id", flowId);
    await supabase.from("task_nodes").delete().eq("flow_id", flowId);
    const { error } = await supabase.from("task_flows").delete().eq("id", flowId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof OrganizationAccessError) return NextResponse.json({ error: err.message }, { status: 403 });
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
