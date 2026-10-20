import OpenAI from "openai";

let client: OpenAI | null = null;
function getClient() {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY가 설정되지 않았습니다.");
    client = new OpenAI({ apiKey });
  }
  return client;
}

// v1: 비-스트리밍 호출. 클립이 짧아(한 턴) 왕복 지연이 크지 않다 —
// 스트리밍 partial transcript는 이후 최적화 단계에서 붙인다.
export async function transcribeAudio(
  file: File,
  model = "gpt-4o-mini-transcribe",
): Promise<{ text: string }> {
  const openai = getClient();
  const result = await openai.audio.transcriptions.create({
    file,
    model,
  });
  return { text: (result.text ?? "").trim() };
}

const HANGUL_RE = /[가-힣]/;

// Whisper 계열 STT는 무음/노이즈 입력에도 빈 문자열 대신 그럴듯한 문장을
// 환각으로 지어내는 경우가 있다(알려진 버릇, 예: "Malogoszcz."). 이 서비스는
// 한국어 전용 상담이라, 한글이 전혀 없는 짧은 transcript는 실제 발화가
// 아니라 환각일 가능성이 높다 — 이런 경우도 "무음"으로 취급한다.
export function looksLikeHallucination(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  return trimmed.length <= 12 && !HANGUL_RE.test(trimmed);
}
