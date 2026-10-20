import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "../../../../../lib/supabase/service";
import { OrganizationAccessError, resolveAdminOrganization } from "../../../../../lib/org/resolveOrganization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ sourceId: string }> }) {
  const { sourceId } = await params;
  const organizationId = request.nextUrl.searchParams.get("organization_id");
  if (!organizationId) return NextResponse.json({ error: "organization_id가 필요합니다." }, { status: 400 });

  try {
    await resolveAdminOrganization(organizationId);
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("knowledge_chunks")
      .select("id, source_id, chunk_index, content, metadata, created_at")
      .eq("source_id", sourceId)
      .eq("organization_id", organizationId)
      .order("chunk_index", { ascending: true });
    if (error) throw error;
    return NextResponse.json({ items: data ?? [] });
  } catch (err) {
    if (err instanceof OrganizationAccessError) return NextResponse.json({ error: err.message }, { status: 403 });
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
