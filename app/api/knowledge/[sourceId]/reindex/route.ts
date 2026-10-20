import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "../../../../../lib/supabase/service";
import { OrganizationAccessError, resolveAdminOrganization } from "../../../../../lib/org/resolveOrganization";
import { ingestKnowledgeText } from "../../../../../lib/ai/knowledge/ingest";
import { extractFileText, htmlToText } from "../../../../../lib/ai/knowledge/parseFile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ sourceId: string }> }) {
  const { sourceId } = await params;
  const organizationId = request.nextUrl.searchParams.get("organization_id");
  if (!organizationId) return NextResponse.json({ error: "organization_id가 필요합니다." }, { status: 400 });

  try {
    await resolveAdminOrganization(organizationId);
    const supabase = createSupabaseServiceClient();

    const { data: source, error } = await supabase
      .from("knowledge_sources")
      .select("id, folder_id, source_type, file_name, mime_type, storage_bucket, storage_path")
      .eq("id", sourceId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (error) throw error;
    if (!source) return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });

    await supabase.from("knowledge_sources").update({ status: "processing" }).eq("id", sourceId);

    let text: string;
    if (source.storage_bucket && source.storage_path) {
      // 원본이 Storage에 있으면(업로드/URL 소스) 그걸 다시 받아서 재파싱한다 —
      // 청킹 로직이나 임베딩 모델이 바뀌었을 때 정확한 재인덱싱이 된다.
      const { data: blob, error: downloadError } = await supabase.storage
        .from(source.storage_bucket)
        .download(source.storage_path);
      if (downloadError || !blob) throw new Error(`원본 파일을 불러오지 못했습니다: ${downloadError?.message ?? "unknown"}`);
      const buffer = Buffer.from(await blob.arrayBuffer());
      text = source.source_type === "website"
        ? htmlToText(buffer.toString("utf8"))
        : await extractFileText(buffer, source.file_name ?? "", source.mime_type ?? "");
    } else {
      // 원본 보관이 없는 소스(직접 입력한 텍스트 등)는 기존 청크를 이어붙여 재구성한다
      // — 청크 경계/중복은 다소 손실되지만 임베딩/키워드는 정확히 갱신된다.
      const { data: chunks } = await supabase
        .from("knowledge_chunks")
        .select("content, chunk_index")
        .eq("source_id", sourceId)
        .order("chunk_index", { ascending: true });
      text = (chunks ?? []).map((c) => c.content).join("\n\n");
    }

    const result = await ingestKnowledgeText({ organizationId, sourceId, folderId: source.folder_id, text });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof OrganizationAccessError) return NextResponse.json({ error: err.message }, { status: 403 });
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
