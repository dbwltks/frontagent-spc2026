import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "../../../../../lib/supabase/service";
import { OrganizationAccessError, resolveAdminOrganization } from "../../../../../lib/org/resolveOrganization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: folderId } = await params;
  const organizationId = request.nextUrl.searchParams.get("organization_id");
  if (!organizationId) return NextResponse.json({ error: "organization_id가 필요합니다." }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  if (typeof body?.name === "string") patch.name = body.name;
  if ("description" in (body ?? {})) patch.description = body.description;
  if ("parent_id" in (body ?? {})) patch.parent_id = body.parent_id;
  if (typeof body?.is_active === "boolean") patch.is_active = body.is_active;

  try {
    await resolveAdminOrganization(organizationId);
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("knowledge_folders")
      .update(patch)
      .eq("id", folderId)
      .eq("organization_id", organizationId)
      .select("id, organization_id, name, description, parent_id, is_active, created_at, updated_at")
      .single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof OrganizationAccessError) return NextResponse.json({ error: err.message }, { status: 403 });
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: folderId } = await params;
  const organizationId = request.nextUrl.searchParams.get("organization_id");
  if (!organizationId) return NextResponse.json({ error: "organization_id가 필요합니다." }, { status: 400 });

  try {
    await resolveAdminOrganization(organizationId);
    const supabase = createSupabaseServiceClient();
    // 폴더를 지워도 안의 문서/청크는 남기고 folder_id만 null로 돌리는 기존 RPC를 그대로 쓴다.
    const { error } = await supabase.rpc("delete_knowledge_folder_keep_contents", {
      organization_id_input: organizationId,
      folder_id_input: folderId,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof OrganizationAccessError) return NextResponse.json({ error: err.message }, { status: 403 });
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
