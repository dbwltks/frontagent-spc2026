import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "../../../../lib/supabase/service";
import { OrganizationAccessError, resolveAdminOrganization } from "../../../../lib/org/resolveOrganization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SELECT_FIELDS =
  "id, title, source_type, folder_id, file_name, mime_type, status, is_referenced, resolution_rate, reference_count, created_at, updated_at";

export async function GET(request: NextRequest, { params }: { params: Promise<{ sourceId: string }> }) {
  const { sourceId } = await params;
  const organizationId = request.nextUrl.searchParams.get("organization_id");
  if (!organizationId) return NextResponse.json({ error: "organization_id가 필요합니다." }, { status: 400 });

  try {
    await resolveAdminOrganization(organizationId);
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("knowledge_sources")
      .select(SELECT_FIELDS)
      .eq("id", sourceId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof OrganizationAccessError) return NextResponse.json({ error: err.message }, { status: 403 });
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ sourceId: string }> }) {
  const { sourceId } = await params;
  const organizationId = request.nextUrl.searchParams.get("organization_id");
  if (!organizationId) return NextResponse.json({ error: "organization_id가 필요합니다." }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  if (typeof body?.title === "string") patch.title = body.title;
  if (typeof body?.is_referenced === "boolean") patch.is_referenced = body.is_referenced;
  if (typeof body?.status === "string") patch.status = body.status;
  if ("folder_id" in (body ?? {})) patch.folder_id = body.folder_id;

  try {
    await resolveAdminOrganization(organizationId);
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("knowledge_sources")
      .update(patch)
      .eq("id", sourceId)
      .eq("organization_id", organizationId)
      .select(SELECT_FIELDS)
      .single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof OrganizationAccessError) return NextResponse.json({ error: err.message }, { status: 403 });
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ sourceId: string }> }) {
  const { sourceId } = await params;
  const organizationId = request.nextUrl.searchParams.get("organization_id");
  if (!organizationId) return NextResponse.json({ error: "organization_id가 필요합니다." }, { status: 400 });

  try {
    await resolveAdminOrganization(organizationId);
    const supabase = createSupabaseServiceClient();
    await supabase.from("knowledge_chunks").delete().eq("source_id", sourceId).eq("organization_id", organizationId);
    const { error } = await supabase.from("knowledge_sources").delete().eq("id", sourceId).eq("organization_id", organizationId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof OrganizationAccessError) return NextResponse.json({ error: err.message }, { status: 403 });
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
