// tiktoken 없이 문자 수 기반으로 청킹한다(한국어는 토큰당 문자수 변동이 커서
// 정확한 토큰 카운트보다 "적당히 겹치는 문단 단위"가 실용적으로 충분하다).
const CHUNK_SIZE = 1500;
const CHUNK_OVERLAP = 200;

export function chunkText(rawText: string): string[] {
  const text = rawText.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!text) return [];

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const hardEnd = Math.min(start + CHUNK_SIZE, text.length);
    let cut = hardEnd;

    if (hardEnd < text.length) {
      // 문단/문장 경계 근처에서 자르기 — 최소 절반 이상 채운 지점 이후에서만 찾는다.
      const searchFrom = start + Math.floor(CHUNK_SIZE * 0.5);
      const paragraphBreak = text.lastIndexOf("\n\n", hardEnd);
      const sentenceBreak = text.lastIndexOf(". ", hardEnd);
      const boundary = Math.max(paragraphBreak, sentenceBreak);
      if (boundary > searchFrom) cut = boundary + 1;
    }

    const chunk = text.slice(start, cut).trim();
    if (chunk) chunks.push(chunk);
    if (cut >= text.length) break;

    const next = cut - CHUNK_OVERLAP;
    start = next > start ? next : cut;
  }

  return chunks;
}
