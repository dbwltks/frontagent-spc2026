// 설정 화면의 "모델 비교" 창이 보여주는 참고 정보. 가격은 공급사 공식 가격표(2026-11 확인),
// 속도는 이 프로젝트 계정에서 직접 호출해 잰 값이다. 가격이 바뀌면 여기만 고친다.
// 선택 가능한 목록 자체는 settingsOptions.ts가 정하고, 이 파일은 설명만 덧붙인다.

export type ModelInfo = {
  id: string;
  name: string;
  /** 사람이 읽는 가격 문구 */
  price: string;
  /** 속도 설명(측정값이면 측정 조건이 notes에 있다) */
  speed: string;
  summary: string;
  recommended?: boolean;
};

export type ModelGroup = { title: string; note?: string; models: ModelInfo[] };

// 상담 1턴을 입력 3,000토큰 + 출력 150토큰으로 가정한 대략의 비용 계산에 쓴다.
export const TURN_INPUT_TOKENS = 3000;
export const TURN_OUTPUT_TOKENS = 150;

export type LlmModelInfo = ModelInfo & { inputPerM: number; outputPerM: number };

export const LLM_MODEL_INFO: LlmModelInfo[] = [
  {
    id: "gpt-6-luna",
    name: "GPT-6 Luna",
    price: "입력 $0.10 · 출력 $0.50 / 100만 토큰",
    inputPerM: 0.1,
    outputPerM: 0.5,
    speed: "가장 빠른 편",
    summary: "가장 저렴한 효율 모델. 상담처럼 짧고 반복적인 대량 응답에 맞고, 기본값으로 추천합니다.",
    recommended: true,
  },
  {
    id: "gpt-6.1-terra",
    name: "GPT-6.1 Terra",
    price: "입력 $1 · 출력 $5 / 100만 토큰",
    inputPerM: 1,
    outputPerM: 5,
    speed: "빠름",
    summary: "빠르고 효율적인 중간 모델. 문장이 더 자연스러워야 할 때 Luna 다음 후보입니다.",
  },
  {
    id: "gpt-6-sol",
    name: "GPT-6 Sol",
    price: "입력 $2 · 출력 $10 / 100만 토큰",
    inputPerM: 2,
    outputPerM: 10,
    speed: "보통",
    summary: "복잡한 판단과 긴 맥락에 강한 고성능 모델.",
  },
  {
    id: "gpt-6.1-sol",
    name: "GPT-6.1 Sol",
    price: "입력 $2 · 출력 $10 / 100만 토큰",
    inputPerM: 2,
    outputPerM: 10,
    speed: "보통",
    summary: "Astra에 가까운 성능을 더 낮은 가격에. 복잡한 업무 처리에 적합합니다.",
  },
  {
    id: "gpt-6-astra",
    name: "GPT-6 Astra",
    price: "입력 $10 · 출력 $50 / 100만 토큰",
    inputPerM: 10,
    outputPerM: 50,
    speed: "느린 편",
    summary: "최상위 플래그십. 비용이 Luna의 100배라 일반 상담에는 과합니다.",
  },
];

export function estimateTurnCostUsd(model: LlmModelInfo) {
  return (
    (TURN_INPUT_TOKENS * model.inputPerM + TURN_OUTPUT_TOKENS * model.outputPerM) / 1_000_000
  );
}

export const STT_MODEL_INFO: ModelGroup[] = [
  {
    title: "OpenAI",
    note: "속도는 한국어 한 문장(약 5초) 기준 실측입니다.",
    models: [
      {
        id: "gpt-transcribe",
        name: "gpt-transcribe",
        price: "분당 $0.0045 (통화 1시간 약 $0.27)",
        speed: "약 1.2초",
        summary: "OpenAI 최신 음성 인식. 구형 gpt-4o-transcribe보다 싸고 속도는 비슷합니다.",
        recommended: true,
      },
    ],
  },
  {
    title: "Deepgram (실시간 스트리밍)",
    note: "말하는 도중 실시간으로 받아 적어 체감 지연이 줄어듭니다. 별도 키가 필요합니다.",
    models: [
      {
        id: "nova-3",
        name: "Nova-3",
        price: "가격 미확인 (Deepgram 요금제 확인 필요)",
        speed: "실시간 스트리밍",
        summary: "브라우저가 직접 연결해 말하는 중에 전사합니다.",
      },
    ],
  },
];

export const TTS_MODEL_INFO: ModelGroup[] = [
  {
    title: "ElevenLabs",
    note: "속도는 한국어 한 문장을 합성하는 데 걸린 전체 시간(2회 평균)입니다. 목소리는 Voice ID로 고릅니다.",
    models: [
      {
        id: "eleven_flash_v2_5",
        name: "Flash v2.5",
        price: "1천 글자당 $0.04",
        speed: "약 0.4초",
        summary: "가장 빠르고 저렴한 실시간용. 숫자·날짜는 한글로 풀어 쓰는 편이 자연스럽습니다.",
        recommended: true,
      },
      {
        id: "eleven_v4_turbo",
        name: "v4 Turbo",
        price: "1천 글자당 $0.04",
        speed: "약 1.0초",
        summary: "v4의 실시간 버전. Flash와 같은 가격에 더 풍부한 표현을 기대할 수 있습니다.",
      },
      {
        id: "eleven_v3_conversational",
        name: "v3 Conversational",
        price: "1천 글자당 $0.04",
        speed: "약 1.0초",
        summary: "v3의 실시간 대화용 버전.",
      },
      {
        id: "eleven_multilingual_v2",
        name: "Multilingual v2",
        price: "1천 글자당 $0.08",
        speed: "약 0.7초",
        summary: "안정적이고 긴 문장에 강합니다. Flash의 2배 가격입니다.",
      },
      {
        id: "eleven_v4",
        name: "v4",
        price: "1천 글자당 $0.08",
        speed: "약 1.7초",
        summary: "최고 품질과 감정 표현. 실시간 상담에는 느립니다.",
      },
    ],
  },
  {
    title: "OpenAI",
    note: "속도는 짧은 영어 문장 1회 측정이라 참고용입니다.",
    models: [
      {
        id: "gpt-4o-mini-tts",
        name: "gpt-4o-mini-tts",
        price: "입력 $0.60 · 음성 출력 $12 / 100만 토큰",
        speed: "약 2.1초",
        summary: "OpenAI 음성 합성. 목소리 13종 중에서 고르며 ElevenLabs보다 느립니다.",
      },
    ],
  },
];
