import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "../../../../../lib/supabase/service";
import { OrganizationAccessError, resolveAdminOrganization } from "../../../../../lib/org/resolveOrganization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SELECT_FIELDS = "id, flow_id, source_node_key, target_node_key, edge_type, condition_type, condition_config, is_failure_edge, priority, created_at";

async function resolveFlowOrganization(flowId: string) {
  const supabase = createSupabaseServiceClient();
  const { data } = await supabase.from("task_flows").select("organization_id").eq("id", flowId).maybeSingle();
  if (!data) throw new OrganizationAccessError("찾을 수 없습니다.");
  await resolveAdminOrganization(data.organization_id);
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: flowId } = await params;
  try {
    await resolveFlowOrganization(flowId);
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase.from("task_edges").select(SELECT_FIELDS).eq("flow_id", flowId).order("priority", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ items: data ?? [] });
  } catch (err) {
    if (err instanceof OrganizationAccessError) return NextResponse.json({ error: err.message }, { status: 403 });
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: flowId } = await params;
  const body = await request.json().catch(() => null);
  const sourceNodeKey = typeof body?.source_node_key === "string" ? body.source_node_key : null;
  const targetNodeKey = typeof body?.target_node_key === "string" ? body.target_node_key : null;
  if (!sourceNodeKey || !targetNodeKey) {
    return NextResponse.json({ error: "source_node_key, target_node_key가 필요합니다." }, { status: 400 });
  }

  try {
    await resolveFlowOrganization(flowId);
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("task_edges")
      .insert({
        flow_id: flowId,
        source_node_key: sourceNodeKey,
        target_node_key: targetNodeKey,
        edge_type: body.edge_type ?? "single",
        condition_type: body.condition_type ?? "always",
        condition_config: body.condition_config ?? {},
        is_failure_edge: body.is_failure_edge ?? false,
        priority: body.priority ?? 100,
      })
      .select(SELECT_FIELDS)
      .single();
    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    if (err instanceof OrganizationAccessError) return NextResponse.json({ error: err.message }, { status: 403 });
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
