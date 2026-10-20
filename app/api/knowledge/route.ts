import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "../../../lib/supabase/service";
import { OrganizationAccessError, resolveAdminOrganization } from "../../../lib/org/resolveOrganization";
import { ingestKnowledgeText } from "../../../lib/ai/knowledge/ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const organizationId = request.nextUrl.searchParams.get("organization_id");
  if (!organizationId) return NextResponse.json({ error: "organization_id가 필요합니다." }, { status: 400 });

  try {
    await resolveAdminOrganization(organizationId);
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("knowledge_sources")
      .select("id, title, source_type, folder_id, file_name, mime_type, status, is_referenced, resolution_rate, reference_count, created_at, updated_at")
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
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const content = typeof body?.content === "string" ? body.content : "";
  const folderId = typeof body?.folder_id === "string" ? body.folder_id : null;

  if (!organizationId || !title || !content.trim()) {
    return NextResponse.json({ error: "organization_id, title, content가 필요합니다." }, { status: 400 });
  }

  try {
    await resolveAdminOrganization(organizationId);
    const supabase = createSupabaseServiceClient();

    const { data: source, error } = await supabase
      .from("knowledge_sources")
      .insert({
        organization_id: organizationId,
        folder_id: folderId,
        title,
        source_type: "text",
        status: "processing",
      })
      .select("id")
      .single();
    if (error) throw error;

    const result = await ingestKnowledgeText({ organizationId, sourceId: source.id, folderId, text: content });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof OrganizationAccessError) return NextResponse.json({ error: err.message }, { status: 403 });
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
