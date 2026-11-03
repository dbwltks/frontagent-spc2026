// 조직 AI 설정 화면이 쓰는 드롭다운 카탈로그. 제공자를 OpenAI(LLM/STT)+ElevenLabs(TTS)로
// 좁히기로 한 결정에 맞춰, DB가 아니라 코드에 고정값으로 둔다 — 나중에 제공자가
// 늘어나면 여기만 넓히면 된다.
export const SETTINGS_OPTIONS = {
  // 저렴/빠름 → 고성능 순. GPT-6 계열만 노출한다(OpenAI Responses API 호출로 확인).
  llm_models: ["gpt-6-luna", "gpt-6.1-terra", "gpt-6-sol", "gpt-6.1-sol", "gpt-6-astra"],
  // 음성은 pipeline(STT→LLM→TTS)만 지원한다. realtime은 만들지 않기로 한 결정.
  voice_modes: ["pipeline"],
  stt_providers: ["openai", "deepgram_streaming"],
  stt_models_by_provider: {
    openai: ["gpt-transcribe"],
    // 브라우저가 Deepgram에 WebSocket으로 직접 붙어 말하는 도중 실시간 전사한다
    // (batch 업로드 방식과 나란히 A/B 테스트하려고 추가 — voice_stt_provider로 토글).
    deepgram_streaming: ["nova-3"],
  },
  tts_providers: ["openai", "elevenlabs"],
  tts_models_by_provider: {
    openai: ["gpt-4o-mini-tts"],
    elevenlabs: ["eleven_flash_v2_5", "eleven_v3", "eleven_turbo_v2_5", "eleven_multilingual_v2"],
  },
  // OpenAI TTS는 모델별 voice 이름으로 고르고, ElevenLabs는 voice_id를 직접 입력한다.
  tts_voices_by_model: {
    "gpt-4o-mini-tts": ["marin", "cedar", "alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer", "verse"],
  },
  elevenlabs_models: ["eleven_flash_v2_5", "eleven_v3", "eleven_turbo_v2_5", "eleven_multilingual_v2"],
  realtime_models: [],
  realtime_voices: [],
  voice_response_styles: ["friendly_short", "professional_short", "casual_short"],
} as const;

export const DEFAULT_ORGANIZATION_AI_SETTINGS = {
  llm_provider: "openai",
  llm_model: "gpt-6-luna",
  decision_model: null as string | null,
  voice_enabled: true,
  voice_mode: "pipeline" as const,
  voice_stt_provider: "openai",
  voice_stt_model: "gpt-transcribe",
  voice_tts_provider: "elevenlabs",
  voice_tts_model: "eleven_flash_v2_5",
  voice_tts_voice: "",
  elevenlabs_model: "eleven_flash_v2_5",
  elevenlabs_voice_id: null as string | null,
  realtime_model: "gpt-realtime-2",
  realtime_voice: "marin",
  voice_response_style: "friendly_short" as const,
  monthly_budget_limit_cents: null as number | null,
  monthly_token_limit: null as number | null,
  // null이면 turnEngine이 기본 캔 인사말(여러 개 중 랜덤) 중 하나를 쓴다 —
  // 조직이 직접 첫 인사를 지정하고 싶을 때만 채운다.
  greeting_message: null as string | null,
  company_name: null as string | null,
};

export type OrganizationAiSettingsPatch = Partial<
  Record<
    | "llm_provider"
    | "llm_model"
    | "decision_model"
    | "voice_enabled"
    | "voice_stt_provider"
    | "voice_stt_model"
    | "voice_tts_provider"
    | "voice_tts_model"
    | "voice_tts_voice"
    | "elevenlabs_model"
    | "elevenlabs_voice_id"
    | "voice_response_style"
    | "monthly_budget_limit_cents"
    | "monthly_token_limit"
    | "greeting_message"
    | "company_name",
    unknown
  >
>;

// voice_mode는 pipeline 고정 결정(realtime 미지원)이라 PATCH로 바꿀 수 없게 한다.
export function sanitizeSettingsPatch(body: Record<string, unknown>): OrganizationAiSettingsPatch {
  const allowedKeys = [
    "llm_provider",
    "llm_model",
    "decision_model",
    "voice_enabled",
    "voice_stt_provider",
    "voice_stt_model",
    "voice_tts_provider",
    "voice_tts_model",
    "voice_tts_voice",
    "elevenlabs_model",
    "elevenlabs_voice_id",
    "voice_response_style",
    "monthly_budget_limit_cents",
    "monthly_token_limit",
    "greeting_message",
    "company_name",
  ] as const;

  const patch: OrganizationAiSettingsPatch = {};
  for (const key of allowedKeys) {
    if (key in body) patch[key] = body[key];
  }
  // 회사명/인사말은 프롬프트에 그대로 들어가므로 공백을 정리하고 길이를 제한한다. 비면 null(기본값).
  for (const [key, max] of [["company_name", 60], ["greeting_message", 300]] as const) {
    if (key in patch) {
      const value = typeof patch[key] === "string" ? (patch[key] as string).trim().slice(0, max) : "";
      patch[key] = value || null;
    }
  }
  return patch;
}
