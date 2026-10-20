import { createSupabaseServiceClient } from "../../supabase/service";
import { embedTexts, extractKeywords } from "../embeddings";
import { chunkText } from "./chunk";

export type IngestResult = { source_id: string; chunks: number; status: string };

// 소스 row는 이미 만들어진 상태로 들어온다(호출자가 title/type/status='processing'로 insert).
// 여기서는 순수 텍스트를 청킹→임베딩→knowledge_chunks에 저장하고 소스 상태를 갱신한다.
// v1은 QStash 같은 큐 없이 요청 안에서 동기로 끝낸다 — 문서가 아주 크면(수백 페이지)
// 서버리스 실행시간 제한에 걸릴 수 있어, 그런 경우엔 Phase 2 후속으로 큐를 붙인다.
export async function ingestKnowledgeText(params: {
  organizationId: string;
  sourceId: string;
  folderId?: string | null;
  text: string;
}): Promise<IngestResult> {
  const { organizationId, sourceId, folderId, text } = params;
  const supabase = createSupabaseServiceClient();

  try {
    const chunks = chunkText(text);
    if (chunks.length === 0) {
      await supabase
        .from("knowledge_sources")
        .update({ status: "failed", resolution_rate: 0 })
        .eq("id", sourceId)
        .eq("organization_id", organizationId);
      return { source_id: sourceId, chunks: 0, status: "failed" };
    }

    await supabase.from("knowledge_sources").update({ status: "embedding" }).eq("id", sourceId).eq("organization_id", organizationId);

    const embeddings = await embedTexts(chunks);

    // reindex 등으로 이미 청크가 있으면 지우고 새로 넣는다.
    await supabase.from("knowledge_chunks").delete().eq("source_id", sourceId).eq("organization_id", organizationId);

    const rows = chunks.map((content, index) => ({
      organization_id: organizationId,
      source_id: sourceId,
      folder_id: folderId ?? null,
      chunk_index: index,
      content,
      embedding: embeddings[index],
      keywords: extractKeywords(content),
    }));

    const { error: insertError } = await supabase.from("knowledge_chunks").insert(rows);
    if (insertError) throw insertError;

    // match_knowledge_chunks(_hybrid) 둘 다 source.status = 'indexed'인 것만
    // 검색 대상으로 잡는다 — 다른 값(예: "referenced")으로 두면 검색에 영영 안 잡힌다.
    await supabase
      .from("knowledge_sources")
      .update({ status: "indexed", is_referenced: true, resolution_rate: 100 })
      .eq("id", sourceId)
      .eq("organization_id", organizationId);

    return { source_id: sourceId, chunks: rows.length, status: "indexed" };
  } catch (err) {
    await supabase
      .from("knowledge_sources")
      .update({ status: "failed" })
      .eq("id", sourceId)
      .eq("organization_id", organizationId)
      .then(() => {});
    throw err;
  }
}
