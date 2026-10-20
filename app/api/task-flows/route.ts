import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "../../../lib/supabase/service";
import { OrganizationAccessError, resolveAdminOrganization } from "../../../lib/org/resolveOrganization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SELECT_FIELDS =
  "id, organization_id, name, description, trigger_intent, trigger_description, trigger_examples, allowed_channels, filters, is_enabled, created_at, updated_at";

export async function GET(request: NextRequest) {
  const organizationId = request.nextUrl.searchParams.get("organization_id");
  if (!organizationId) return NextResponse.json({ error: "organization_id가 필요합니다." }, { status: 400 });

  try {
    await resolveAdminOrganization(organizationId);
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("task_flows")
      .select(SELECT_FIELDS)
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ items: data ?? [] });
  } catch (err) {
    if (err instanceof OrganizationAccessError) return NextResponse.json({ error: err.message }, { status: 403 });
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const organizationId = typeof body?.organization_id === "string" ? body.organization_id : null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!organizationId || !name) return NextResponse.json({ error: "organization_id, name이 필요합니다." }, { status: 400 });

  try {
    await resolveAdminOrganization(organizationId);
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("task_flows")
      .insert({
        organization_id: organizationId,
        name,
        description: body.description ?? null,
        trigger_intent: body.trigger_intent ?? null,
        trigger_description: body.trigger_description ?? null,
        trigger_examples: body.trigger_examples ?? [],
        allowed_channels: body.allowed_channels ?? [],
        filters: body.filters ?? {},
        is_enabled: body.is_enabled ?? true,
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
