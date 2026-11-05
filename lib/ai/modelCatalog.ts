// 설정 화면의 "모델 비교" 창이 보여주는 참고 정보.
// 가격과 설명은 공급사 공식 문서(2026-11 확인)만 옮겼고, 공식 문서에 없는 항목은 비워 둔다.
// `measured`는 이 프로젝트 계정에서 직접 호출해 잰 값이라 화면에서 따로 "실측"으로 표시한다.
// 가격이 바뀌면 여기만 고친다. 선택 가능한 목록 자체는 settingsOptions.ts가 정한다.

export const OPENAI_PRICING_URL = "https://developers.openai.com/api/docs/pricing";
export const OPENAI_MODELS_URL = "https://developers.openai.com/api/docs/models";
export const ELEVENLABS_MODELS_URL = "https://elevenlabs.io/docs/overview/models";
export const ELEVENLABS_PRICING_URL = "https://elevenlabs.io/pricing/api";

export type ModelInfo = {
  id: string;
  name: string;
  /** 공식 가격표의 가격 */
  price: string;
  /** 공식 문서의 설명. 없으면 비운다. */
  summary?: string;
  /** 공식 문서가 밝힌 속도/지연. 없으면 비운다. */
  officialSpeed?: string;
  /** 이 프로젝트에서 직접 잰 값 */
  measured?: string;
  /** 우리 용도(한국어 상담)에서 추천하는 모델 */
  recommended?: boolean;
};

export type ModelGroup = { title: string; note?: string; sources: { label: string; url: string }[]; models: ModelInfo[] };

// 상담 1턴을 입력 3,000토큰 + 출력 150토큰으로 가정한 대략의 비용 계산에 쓴다.
export const TURN_INPUT_TOKENS = 3000;
export const TURN_OUTPUT_TOKENS = 150;

export type LlmModelInfo = ModelInfo & { inputPerM: number; outputPerM: number };

export const LLM_SOURCES = [
  { label: "OpenAI 가격표", url: OPENAI_PRICING_URL },
  { label: "OpenAI 모델 목록", url: OPENAI_MODELS_URL },
];

export const LLM_MODEL_INFO: LlmModelInfo[] = [
  {
    id: "gpt-6-luna",
    name: "GPT-6 Luna",
    price: "입력 $0.10 · 출력 $0.50 / 100만 토큰",
    inputPerM: 0.1,
    outputPerM: 0.5,
    summary: "공식 설명: 집중된 대량 작업을 위한 가장 효율적인 모델.",
    recommended: true,
  },
  {
    id: "gpt-6.1-terra",
    name: "GPT-6.1 Terra",
    price: "입력 $1 · 출력 $5 / 100만 토큰",
    inputPerM: 1,
    outputPerM: 5,
    summary: "공식 설명: 시각 추론, 컴퓨터 사용, 자연스러운 글쓰기를 위한 빠르고 효율적인 모델.",
  },
  {
    id: "gpt-6-sol",
    name: "GPT-6 Sol",
    price: "입력 $2 · 출력 $10 / 100만 토큰",
    inputPerM: 2,
    outputPerM: 10,
    summary: "공식 가격표에만 등재되어 있고 모델 설명은 없습니다.",
  },
  {
    id: "gpt-6.1-sol",
    name: "GPT-6.1 Sol",
    price: "입력 $2 · 출력 $10 / 100만 토큰",
    inputPerM: 2,
    outputPerM: 10,
    summary: "공식 설명: 복잡한 작업에서 Astra에 가까운 성능을 더 낮은 비용으로.",
  },
  {
    id: "gpt-6-astra",
    name: "GPT-6 Astra",
    price: "입력 $10 · 출력 $50 / 100만 토큰",
    inputPerM: 10,
    outputPerM: 50,
    summary: "공식 설명: 복잡한 추론과 코딩을 위한 플래그십 모델.",
  },
];

export function estimateTurnCostUsd(model: LlmModelInfo) {
  return (TURN_INPUT_TOKENS * model.inputPerM + TURN_OUTPUT_TOKENS * model.outputPerM) / 1_000_000;
}

export const STT_MODEL_INFO: ModelGroup[] = [
  {
    title: "OpenAI",
    note: "공식 가격표에 속도 수치는 없습니다.",
    sources: [{ label: "OpenAI 가격표", url: OPENAI_PRICING_URL }],
    models: [
      {
        id: "gpt-transcribe",
        name: "gpt-transcribe",
        price: "분당 $0.0045 (통화 1시간 약 $0.27)",
        summary: "같은 가격표의 gpt-4o-transcribe는 분당 약 $0.006(추정)입니다.",
        measured: "한국어 한 문장(약 5초) 1.2초",
        recommended: true,
      },
    ],
  },
];

export const TTS_MODEL_INFO: ModelGroup[] = [
  {
    title: "ElevenLabs",
    note: "공식 지연 수치는 애플리케이션·네트워크 지연을 뺀 중앙값입니다. 목소리는 Voice ID로 고릅니다.",
    sources: [
      { label: "ElevenLabs 모델 문서", url: ELEVENLABS_MODELS_URL },
      { label: "ElevenLabs API 가격", url: ELEVENLABS_PRICING_URL },
    ],
    models: [
      {
        id: "eleven_flash_v2_5",
        name: "Flash v2.5",
        price: "1천 글자당 $0.04",
        summary: "공식 설명: 빠르고 저렴한 모델. 실시간 에이전트용. 32개 언어(한국어 포함). 숫자·날짜·금액은 기본으로 정규화되지 않습니다.",
        officialSpeed: "중앙값 약 100ms",
        measured: "한국어 한 문장 전체 합성 약 0.4초",
        recommended: true,
      },
      {
        id: "eleven_v4_turbo",
        name: "v4 Turbo",
        price: "1천 글자당 $0.04",
        summary: "공식 설명: v4의 실시간 버전. 높은 품질과 표현력, 90개 이상 언어. 실시간 음성 에이전트용.",
        officialSpeed: "중앙값 약 100ms",
        measured: "한국어 한 문장 전체 합성 약 1.0초",
      },
      {
        id: "eleven_v3_conversational",
        name: "v3 Conversational",
        price: "1천 글자당 $0.04",
        summary: "공식 설명: 이전 세대의 표현력 있는 실시간 대화용 모델. 70개 이상 언어.",
        officialSpeed: "중앙값 약 165ms",
        measured: "한국어 한 문장 전체 합성 약 1.0초",
      },
      {
        id: "eleven_multilingual_v2",
        name: "Multilingual v2",
        price: "1천 글자당 $0.08",
        summary: "공식 설명: 이전 세대. 자연스럽고 일관되며 긴 글에 안정적. 29개 언어. Flash보다 글자당 비용이 높습니다.",
        officialSpeed: "Flash보다 높음 (수치 미공개)",
        measured: "한국어 한 문장 전체 합성 약 0.7초",
      },
      {
        id: "eleven_v4",
        name: "v4",
        price: "1천 글자당 $0.08",
        summary: "공식 설명: 가장 높은 품질과 감정 표현. 90개 이상 언어. 캐릭터 보이스, 오디오북 등 콘텐츠용.",
        measured: "한국어 한 문장 전체 합성 약 1.7초",
      },
    ],
  },
  {
    title: "OpenAI",
    note: "공식 가격표에 속도 수치는 없습니다.",
    sources: [{ label: "OpenAI 가격표", url: OPENAI_PRICING_URL }],
    models: [
      {
        id: "gpt-4o-mini-tts",
        name: "gpt-4o-mini-tts",
        price: "텍스트 입력 $0.60 · 음성 출력 $12 / 100만 토큰",
        summary: "목소리는 이름(marin, cedar 등 13종)으로 고릅니다.",
        measured: "짧은 영어 문장 1회 약 2.1초 (참고용)",
      },
    ],
  },
];
