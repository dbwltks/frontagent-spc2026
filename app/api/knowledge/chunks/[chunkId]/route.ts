import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "../../../../../lib/supabase/service";
import { OrganizationAccessError, resolveAdminOrganization } from "../../../../../lib/org/resolveOrganization";
import { embedText, extractKeywords } from "../../../../../lib/ai/embeddings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ chunkId: string }> }) {
  const { chunkId } = await params;
  const organizationId = request.nextUrl.searchParams.get("organization_id");
  const body = await request.json().catch(() => null);
  const content = typeof body?.content === "string" ? body.content : null;

  if (!organizationId || !content?.trim()) {
    return NextResponse.json({ error: "organization_id, content가 필요합니다." }, { status: 400 });
  }

  try {
    await resolveAdminOrganization(organizationId);
    const supabase = createSupabaseServiceClient();

    // 내용이 바뀌면 검색 정확도를 지키기 위해 임베딩/키워드도 같이 갱신한다 —
    // 텍스트만 바꾸고 벡터는 그대로 두면 검색이 엉뚱한 내용을 찾아오게 된다.
    const embedding = await embedText(content);
    const { data, error } = await supabase
      .from("knowledge_chunks")
      .update({ content, embedding, keywords: extractKeywords(content) })
      .eq("id", chunkId)
      .eq("organization_id", organizationId)
      .select("id, source_id, chunk_index, content, metadata, created_at")
      .single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof OrganizationAccessError) return NextResponse.json({ error: err.message }, { status: 403 });
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ chunkId: string }> }) {
  const { chunkId } = await params;
  const organizationId = request.nextUrl.searchParams.get("organization_id");
  if (!organizationId) return NextResponse.json({ error: "organization_id가 필요합니다." }, { status: 400 });

  try {
    await resolveAdminOrganization(organizationId);
    const supabase = createSupabaseServiceClient();
    const { error } = await supabase.from("knowledge_chunks").delete().eq("id", chunkId).eq("organization_id", organizationId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof OrganizationAccessError) return NextResponse.json({ error: err.message }, { status: 403 });
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
