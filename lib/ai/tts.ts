const ELEVENLABS_API_BASE = "https://api.elevenlabs.io/v1";

export type SynthesizeOptions = {
  voiceId: string;
  modelId?: string;
};

// ElevenLabs REST 스트리밍 엔드포인트를 절(clause) 단위로 호출한다. 텍스트가
// 짧아서(한두 문장) 응답 전체를 버퍼링해도 지연에 미치는 영향이 작다 —
// 진짜 저지연이 더 필요해지면 여기를 청크 단위 파이프로 바꾸면 된다.
export async function synthesizeSpeech(
  text: string,
  { voiceId, modelId = "eleven_flash_v2_5" }: SynthesizeOptions,
): Promise<{ audio: Buffer; contentType: string }> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY가 설정되지 않았습니다.");
  if (!voiceId) throw new Error("ElevenLabs voice_id가 설정되지 않았습니다.");

  const response = await fetch(`${ELEVENLABS_API_BASE}/text-to-speech/${voiceId}/stream?output_format=mp3_44100_128`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: modelId,
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`ElevenLabs TTS 실패 (HTTP ${response.status}): ${detail.slice(0, 300)}`);
  }

  const audio = Buffer.from(await response.arrayBuffer());
  return { audio, contentType: "audio/mpeg" };
}

// STT 끝나고 LLM+TTS 처리(수 초)가 진행되는 동안 들려줄 짧은 필러 음성을
// (voiceId, model, 문구)별로 프로세스 메모리에 캐싱해둔다 — 처음 한 번만
// 실제 ElevenLabs 호출이 나가고, 그 다음부터는 즉시 재사용돼 체감 지연을
// 실질적으로 0에 가깝게 만든다(진짜 지연을 줄이는 게 아니라 가리는 트릭).
const fillerCache = new Map<string, Promise<{ audio: Buffer; contentType: string }>>();

export function getCachedFillerAudio(voiceId: string, modelId: string | undefined, phrase: string) {
  const key = `${voiceId}::${modelId ?? "default"}::${phrase}`;
  let entry = fillerCache.get(key);
  if (!entry) {
    entry = synthesizeSpeech(phrase, { voiceId, modelId });
    entry.catch(() => fillerCache.delete(key)); // 실패하면 캐시에 안 남겨서 다음 턴에 재시도되게 한다.
    fillerCache.set(key, entry);
  }
  return entry;
}

// 스트리밍 답변 텍스트를 절 단위로 잘라 TTS 호출 횟수를 최소화하면서도
// 체감 지연(time-to-first-audio)을 줄인다. 첫 절은 더 짧게 끊는다.
const CLAUSE_END = /[.!?。！？\n]/;

export class ClauseSplitter {
  private buffer = "";
  private emittedFirst = false;

  push(delta: string): string[] {
    this.buffer += delta;
    const clauses: string[] = [];

    while (true) {
      const maxLen = this.emittedFirst ? 80 : 20;
      const endMatch = this.buffer.split("").findIndex((ch, i) => i > 0 && CLAUSE_END.test(ch));
      if (endMatch !== -1 && endMatch < this.buffer.length - 1) {
        const clause = this.buffer.slice(0, endMatch + 1).trim();
        this.buffer = this.buffer.slice(endMatch + 1);
        if (clause) {
          clauses.push(clause);
          this.emittedFirst = true;
        }
        continue;
      }
      if (this.buffer.length >= maxLen) {
        const breakAt = this.buffer.lastIndexOf(" ", maxLen);
        const cut = breakAt > 0 ? breakAt : maxLen;
        const clause = this.buffer.slice(0, cut).trim();
        this.buffer = this.buffer.slice(cut);
        if (clause) {
          clauses.push(clause);
          this.emittedFirst = true;
        }
        continue;
      }
      break;
    }
    return clauses;
  }

  flush(): string | null {
    const rest = this.buffer.trim();
    this.buffer = "";
    return rest || null;
  }
}
