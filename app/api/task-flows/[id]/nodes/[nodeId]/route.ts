import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "../../../../../../lib/supabase/service";
import { OrganizationAccessError, resolveAdminOrganization } from "../../../../../../lib/org/resolveOrganization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SELECT_FIELDS = "id, flow_id, node_key, node_type, label, config, code, position_x, position_y, timeout_seconds, retry_limit, created_at, updated_at";

async function resolveFlowOrganization(flowId: string) {
  const supabase = createSupabaseServiceClient();
  const { data } = await supabase.from("task_flows").select("organization_id").eq("id", flowId).maybeSingle();
  if (!data) throw new OrganizationAccessError("찾을 수 없습니다.");
  await resolveAdminOrganization(data.organization_id);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; nodeId: string }> }) {
  const { id: flowId, nodeId } = await params;
  const body = await request.json().catch(() => ({}));

  try {
    await resolveFlowOrganization(flowId);
    const supabase = createSupabaseServiceClient();
    const patch: Record<string, unknown> = {};
    for (const key of ["node_key", "node_type", "label", "config", "code", "position_x", "position_y", "timeout_seconds", "retry_limit"]) {
      if (key in (body ?? {})) patch[key] = body[key];
    }
    const { data, error } = await supabase
      .from("task_nodes")
      .update(patch)
      .eq("id", nodeId)
      .eq("flow_id", flowId)
      .select(SELECT_FIELDS)
      .single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof OrganizationAccessError) return NextResponse.json({ error: err.message }, { status: 403 });
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string; nodeId: string }> }) {
  const { id: flowId, nodeId } = await params;

  try {
    await resolveFlowOrganization(flowId);
    const supabase = createSupabaseServiceClient();
    const { error } = await supabase.from("task_nodes").delete().eq("id", nodeId).eq("flow_id", flowId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof OrganizationAccessError) return NextResponse.json({ error: err.message }, { status: 403 });
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
