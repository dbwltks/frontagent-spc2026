// Jev(TypeSafe System One) — 문장을 생성하지 않고 정해둔 선택지 중 하나를
// 고르는 "판단 전용" 모델. 0.4초/$0.0004 수준이라, LLM한테 tool 선택만
// 맡기려고 통째로 한 스텝 태우는 것보다 훨씬 싸고 빠르다.
// TYPESAFE_API_KEY가 없으면 이 모듈을 쓰는 쪽에서 그냥 건너뛰고 기존
// tool-calling 경로로 폴백해야 한다 — 이 함수는 그 판단에 필요한 신호만 준다.

const TYPESAFE_ENDPOINT = "https://api.typesafe.ai/v1/systemone";

export type ChoiceCriteria = Record<string, string>;

export type ChoiceResult = {
  choice: string;
  confidence: number;
  probabilities: Record<string, number>;
};

export function isDecisionModelAvailable() {
  return Boolean(process.env.TYPESAFE_API_KEY);
}

export async function decideChoice(params: {
  state: string;
  instructions: string;
  criteria: ChoiceCriteria;
  model?: string;
}): Promise<ChoiceResult> {
  const apiKey = process.env.TYPESAFE_API_KEY;
  if (!apiKey) throw new Error("TYPESAFE_API_KEY가 설정되지 않았습니다.");

  const response = await fetch(TYPESAFE_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: params.model ?? "jev-latest",
      state: params.state,
      questions: {
        decision: { type: "choice", instructions: params.instructions, criteria: params.criteria },
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Jev 판단 요청 실패 (HTTP ${response.status}): ${detail.slice(0, 300)}`);
  }

  // 실제 응답은 { model, answers: { decision: {...} }, usage } 형태로 온다 —
  // 문서상 예시들은 이 "answers" 래퍼를 안 보여줘서 처음엔 빠뜨렸었다.
  const data = (await response.json()) as { answers: { decision: ChoiceResult } };
  return data.answers.decision;
}

// 이번 사용자 발화가 지식검색/업무처리/잡담 중 뭘 요구하는지 빠르게 분류한다.
// runTurn이 이 결과로 이번 턴에 어떤 tool을 열어줄지(또는 아예 tool 없이
// 바로 답할지)를 정해서, LLM이 "tool을 쓸지 말지" 자체를 고민하는 라운드
// 트립을 없앤다.
export async function classifyTurnIntent(userMessage: string, hasEnabledTaskFlows: boolean) {
  const criteria: ChoiceCriteria = {
    // chat을 greeting/thanks/other로 더 쪼갠 이유: 인사·감사는 LLM 생성 없이
    // 미리 써둔 답 중 하나를 즉시 내보낼 수 있어서(= LLM 호출 자체를 스킵),
    // 분류 단계에서부터 구분해둬야 turnEngine이 그 지름길을 탈 수 있다.
    // 이것도 Jev가 직접 고르는 것이지 키워드 매칭이 아니다.
    chat_greeting: "인사말 — 안녕하세요, 안녕히계세요, 처음뵙겠습니다 등",
    chat_thanks: "감사 인사 — 고맙습니다, 감사합니다, 수고하세요 등",
    chat_other: "그 외 잡담, 맞장구, 애매한 말 등 정보 검색이나 업무 처리가 필요 없는 대화",
    knowledge: "요금, 정책, 서비스 안내, 영업시간 등 정보를 물어보는 질문",
  };
  if (hasEnabledTaskFlows) {
    criteria.task = "예약, 신청, 취소 등 실제 업무 처리를 요청함";
  }

  return decideChoice({
    state: userMessage,
    instructions: "이 고객 발화가 어떤 종류인지 하나만 골라라.",
    criteria,
  });
}

// chat_greeting/chat_thanks로 분류된 턴은 LLM을 아예 안 태우고 이 중 하나를
// 무작위로 골라 바로 내보낸다 — 매번 같은 문장이면 어색해서 몇 개씩 돌려쓴다.
export const CANNED_REPLIES: Record<string, string[]> = {
  chat_greeting: [
    "안녕하세요! 무엇을 도와드릴까요?",
    "안녕하세요, 반갑습니다. 어떤 게 궁금하세요?",
    "네, 안녕하세요! 편하게 말씀해 주세요.",
  ],
  chat_thanks: [
    "네, 감사합니다! 더 궁금하신 점 있으시면 말씀해 주세요.",
    "별말씀을요! 또 필요하신 거 있으면 말씀해 주세요.",
    "네, 좋은 하루 되세요!",
  ],
};

// "task" 의도로 분류된 뒤, 활성화된 플로우 중 어떤 걸 시작할지도 Jev가 직접
// 고르게 한다 — 이것도 LLM tool-calling 라운드트립(flow_id 선택) 하나를 없앤다.
// 어떤 플로우에도 안 맞을 수 있어서 "none" 선택지를 항상 같이 넣는다.
export async function classifyTaskFlowChoice(
  userMessage: string,
  flows: { id: string; name: string; trigger_description: string | null }[],
) {
  if (flows.length === 0) return null;

  const criteria: ChoiceCriteria = { none: "위 어떤 업무와도 맞지 않는 요청" };
  for (const flow of flows) {
    criteria[flow.id] = `${flow.name}: ${flow.trigger_description ?? ""}`;
  }

  return decideChoice({
    state: userMessage,
    instructions: "이 고객 요청을 처리할 업무 플로우를 하나 골라라. 맞는 게 없으면 none을 골라라.",
    criteria,
  });
}
