import OpenAI from "openai";
import { createSupabaseServiceClient } from "../supabase/service";

let client: OpenAI | null = null;
function getClient() {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY가 설정되지 않았습니다.");
    client = new OpenAI({ apiKey });
  }
  return client;
}

const EMBEDDING_MODEL = "text-embedding-3-small"; // knowledge_chunks.embedding이 vector(1536)이라 이 모델로 고정

export async function embedText(text: string): Promise<number[]> {
  const openai = getClient();
  const res = await openai.embeddings.create({ model: EMBEDDING_MODEL, input: text });
  return res.data[0].embedding;
}

// 지식베이스 인입(청크 여러 개)용 배치 임베딩 — 청크마다 API 호출하는 대신
// 한 번에 묶어 보낸다. OpenAI 배치 상한을 고려해 100개씩 쪼갠다.
const EMBED_BATCH_SIZE = 100;

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const openai = getClient();
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += EMBED_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBED_BATCH_SIZE);
    const res = await openai.embeddings.create({ model: EMBEDDING_MODEL, input: batch });
    out.push(...res.data.map((d) => d.embedding));
  }
  return out;
}

// 한국어 토큰은 조사가 그대로 붙어 나온다("입주청소는", "베란다도") — 길이
// 순으로 긴 조사부터 먼저 떼어낸다. 완벽한 형태소 분석은 아니지만(실제 단어가
// 조사와 같은 글자로 끝나는 경우 과하게 깎일 수 있음), 하이브리드 검색의
// 키워드/본문 ILIKE 매칭이 "입주청소는" 같은 조사 달린 토큰 때문에 저장된
// 키워드("입주청소")나 본문("입주 청소")과 전혀 안 맞아 떨어지던 문제가 더
// 치명적이라 이 정도 휴리스틱으로도 값어치가 있다.
const TRAILING_PARTICLES = [
  "이에요", "예요", "입니다", "습니다", "으로는", "에서는", "한테서", "에게서",
  "까지는", "부터는", "이라서", "이라도", "라서", "라도", "에서", "부터", "까지",
  "한테", "에게", "이나", "이랑", "랑", "하고", "의", "은", "는", "이", "가",
  "을", "를", "에", "로", "와", "과", "도", "만", "나", "요",
].sort((a, b) => b.length - a.length);

function stripTrailingParticle(token: string): string {
  for (const particle of TRAILING_PARTICLES) {
    if (token.endsWith(particle) && token.length - particle.length >= 2) {
      return token.slice(0, -particle.length);
    }
  }
  return token;
}

// 아주 단순한 키워드 추출 — match_knowledge_chunks_hybrid가 벡터 검색과
// 결합할 풀텍스트 키워드를 요구해서, 2글자 이상 토큰만 뽑아 넘긴다.
// 청크 인입 시 knowledge_chunks.keywords 채우는 데도 재사용한다(하이브리드
// 스코어링이 이 컬럼을 직접 참조함).
export function extractKeywords(query: string): string[] {
  return query
    .split(/\s+/)
    .map((token) => token.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((token) => token.length >= 2)
    .map(stripTrailingParticle)
    .filter((token) => token.length >= 2)
    .slice(0, 10);
}

export type KnowledgeMatch = {
  id: string;
  content: string;
  metadata: Record<string, unknown> | null;
  similarity?: number;
};

// match_knowledge_semantic_cache는 threshold를 자기가 걸러주지 않고 그냥
// 제일 가까운 1개를 돌려준다(파라미터는 있지만 함수 본문에서 안 씀) — 그래서
// 호출자가 직접 유사도를 비교해서 캐시 히트/미스를 판단해야 한다.
// 0.93이었을 때 "베란다 청소도 되나요?"가 몇 주 전 캐싱된 전혀 다른 질문의
// 결과(심지어 다른 서비스 항목 설명)를 잘못 재사용하는 사고가 실제로
// 있었다 — 서비스 카탈로그처럼 문장 구조가 거의 똑같은 짧은 템플릿 텍스트들은
// 임베딩 유사도가 쉽게 0.9를 넘는다. 오탐 risk를 줄이려고 0.97로 올렸다.
const SEMANTIC_CACHE_THRESHOLD = 0.97;

export async function searchKnowledge(
  organizationId: string,
  query: string,
  opts: { folderId?: string; matchCount?: number } = {},
): Promise<KnowledgeMatch[]> {
  const supabase = createSupabaseServiceClient();
  const queryEmbedding = await embedText(query);
  const folderId = opts.folderId ?? null;

  const { data: cached } = await supabase
    .rpc("match_knowledge_semantic_cache", {
      query_embedding: queryEmbedding,
      match_organization_id: organizationId,
      match_folder_id: folderId,
    })
    .maybeSingle();

  if (cached && (cached as { similarity: number }).similarity >= SEMANTIC_CACHE_THRESHOLD) {
    return (cached as { result: KnowledgeMatch[] }).result;
  }

  const { data, error } = await supabase.rpc("match_knowledge_chunks_hybrid", {
    query_embedding: queryEmbedding,
    query_keywords: extractKeywords(query),
    match_organization_id: organizationId,
    match_folder_id: folderId,
    match_count: opts.matchCount ?? 5,
  });

  if (error) throw new Error(`지식 검색 실패: ${error.message}`);
  const results = (data ?? []) as KnowledgeMatch[];

  if (results.length > 0) {
    // 캐시 저장 실패는 검색 결과 자체엔 영향 없으니 무시한다.
    void supabase
      .from("knowledge_semantic_cache")
      .insert({ organization_id: organizationId, folder_id: folderId, query_embedding: queryEmbedding, result: results })
      .then(() => {});
  }

  return results;
}
