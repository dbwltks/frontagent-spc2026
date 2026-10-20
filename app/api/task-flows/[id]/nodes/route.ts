import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "../../../../../lib/supabase/service";
import { OrganizationAccessError, resolveAdminOrganization } from "../../../../../lib/org/resolveOrganization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SELECT_FIELDS = "id, flow_id, node_key, node_type, label, config, code, position_x, position_y, timeout_seconds, retry_limit, created_at, updated_at";

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
    const { data, error } = await supabase.from("task_nodes").select(SELECT_FIELDS).eq("flow_id", flowId).order("created_at", { ascending: true });
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
  const nodeKey = typeof body?.node_key === "string" ? body.node_key : null;
  const nodeType = typeof body?.node_type === "string" ? body.node_type : null;
  if (!nodeKey || !nodeType) return NextResponse.json({ error: "node_key, node_type이 필요합니다." }, { status: 400 });

  try {
    await resolveFlowOrganization(flowId);
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("task_nodes")
      .insert({
        flow_id: flowId,
        node_key: nodeKey,
        node_type: nodeType,
        label: body.label ?? nodeKey,
        config: body.config ?? {},
        code: body.code ?? null,
        position_x: body.position_x ?? 0,
        position_y: body.position_y ?? 0,
        timeout_seconds: body.timeout_seconds ?? 10,
        retry_limit: body.retry_limit ?? 0,
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
