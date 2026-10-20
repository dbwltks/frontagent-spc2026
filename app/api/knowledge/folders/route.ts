import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "../../../../lib/supabase/service";
import { OrganizationAccessError, resolveAdminOrganization } from "../../../../lib/org/resolveOrganization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const organizationId = request.nextUrl.searchParams.get("organization_id");
  if (!organizationId) return NextResponse.json({ error: "organization_id가 필요합니다." }, { status: 400 });

  try {
    await resolveAdminOrganization(organizationId);
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("knowledge_folders")
      .select("id, organization_id, name, description, parent_id, is_active, created_at, updated_at")
      .eq("organization_id", organizationId)
      .order("name", { ascending: true });
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

  if (!organizationId || !name) {
    return NextResponse.json({ error: "organization_id, name이 필요합니다." }, { status: 400 });
  }

  try {
    await resolveAdminOrganization(organizationId);
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("knowledge_folders")
      .insert({
        organization_id: organizationId,
        name,
        description: typeof body?.description === "string" ? body.description : null,
        parent_id: typeof body?.parent_id === "string" ? body.parent_id : null,
      })
      .select("id, organization_id, name, description, parent_id, is_active, created_at, updated_at")
      .single();
    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    if (err instanceof OrganizationAccessError) return NextResponse.json({ error: err.message }, { status: 403 });
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
