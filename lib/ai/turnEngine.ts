import { openai } from "@ai-sdk/openai";
import { stepCountIs, streamText, type ToolSet } from "ai";
import { createSupabaseServiceClient } from "../supabase/service";
import { buildTools } from "./tools/registry";
import { advanceTaskSession, getActiveTaskSession, loadEnabledFlows, startTaskFlow, type FlowStepResult } from "./taskFlowCompiler";
import { CANNED_REPLIES, classifyTaskFlowChoice, classifyTurnIntent, isDecisionModelAvailable } from "./decision";
import { searchKnowledge } from "./embeddings";

export type TurnEvent =
  | { type: "trace"; step: string; detail: string }
  | { type: "knowledge_start"; queries: string[] }
  | { type: "delta"; text: string }
  | { type: "ai_disabled"; message: string }
  | { type: "done"; answer: string; conversationId: string; shouldEndSession: boolean }
  | { type: "error"; message: string };

type RunTurnOptions = {
  organizationId: string;
  sessionId: string;
  channel: string;
  userMessage: string;
  signal?: AbortSignal;
};

const AI_DISABLED_MESSAGE = "죄송합니다, 지금은 상담원이 직접 응대 중입니다. 잠시만 기다려주세요.";

const STYLE_GUIDE: Record<string, string> = {
  friendly_short: "친근하고 따뜻한 말투로, 짧고 간결하게 답하라.",
  professional_short: "전문적이고 격식있는 말투로, 짧고 간결하게 답하라.",
  casual_short: "편안하고 캐주얼한 말투로, 짧고 간결하게 답하라.",
};

async function loadOrCreateConversation(organizationId: string, sessionId: string, channel: string) {
  const supabase = createSupabaseServiceClient();
  const { data: existing, error } = await supabase
    .from("conversations")
    .select("id, ai_enabled")
    .eq("organization_id", organizationId)
    .eq("session_id", sessionId)
    .maybeSingle();
  if (error) throw error;
  if (existing) return existing;

  const { data: created, error: insertError } = await supabase
    .from("conversations")
    .insert({ organization_id: organizationId, session_id: sessionId, channel })
    .select("id, ai_enabled")
    .single();
  if (insertError) throw insertError;
  return created;
}

function composeSystemPrompt(voiceResponseStyle: string | null, rules: { name: string; instruction: string }[]) {
  const lines = [
    "너는 고객 응대 AI 상담원이다. 한국어로 답한다.",
    STYLE_GUIDE[voiceResponseStyle ?? "friendly_short"],
    "모르는 내용은 search_knowledge로 검색하고, 지어내지 마라.",
    "예약 요청은 반드시 check_availability로 먼저 확인한 뒤 create_reservation을 호출하라.",
  ];
  for (const rule of rules) lines.push(`[규칙: ${rule.name}] ${rule.instruction}`);
  return lines.join("\n");
}

export async function* runTurn({ organizationId, sessionId, channel, userMessage, signal }: RunTurnOptions): AsyncGenerator<TurnEvent> {
  const supabase = createSupabaseServiceClient();

  // conversation 조회(없으면 생성)도 이 배치 안에 넣는다 — 이전엔 이게 아래
  // Promise.all보다 먼저, 혼자 순차로 한 번 더 왕복했다. conversation.id가
  // 꼭 있어야만 하는 두 가지(대화 히스토리 조회, 고객 메시지 기록)만 이
  // 배치가 끝난 뒤 별도로 처리하고, 나머지(설정/규칙/활성 세션/플로우 목록/
  // Jev 분류)는 전부 conversation.id 없이도 되는 것들이라 여기서 같이 날린다.
  const [conversation, settingsRow, rulesRows, activeSession, enabledFlows, intent] = await Promise.all([
    loadOrCreateConversation(organizationId, sessionId, channel),
    supabase
      .from("organization_ai_settings")
      .select("llm_model, voice_response_style, greeting_message")
      .eq("organization_id", organizationId)
      .maybeSingle()
      .then(({ data }) => data),
    supabase
      .from("rules")
      .select("name, instruction")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .then(({ data }) => data ?? []),
    getActiveTaskSession(organizationId, sessionId),
    // "task" 분류로 갈 때 쓸 플로우 목록도 여기서 같이 당겨둔다 — 안 쓰더라도
    // 저렴한 읽기라, 순차로 또 왕복하는 것보다 미리 받아두는 게 낫다.
    loadEnabledFlows(organizationId),
    // Jev(판단 전용 모델)로 이번 턴이 인사/감사/잡담/지식검색/업무처리 중
    // 뭔지 미리 분류해둔다 — LLM한테 "tool을 쓸지 말지" 자체를 고민시키는
    // 라운드트립(수 초)을 없애는 게 목적. 키가 없거나 실패하면 null로
    // 폴백해서 기존처럼 LLM이 tool 전체를 보고 알아서 판단하게 둔다.
    isDecisionModelAvailable()
      ? classifyTurnIntent(userMessage, true).catch((err) => {
          console.error("[classifyTurnIntent] 실패:", err);
          return null;
        })
      : Promise.resolve(null),
  ]);

  if (conversation.ai_enabled === false) {
    yield { type: "ai_disabled", message: AI_DISABLED_MESSAGE };
    return;
  }

  const [history, tools] = await Promise.all([
    supabase
      .from("conversation_messages")
      .select("sender_type, message")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) =>
        (data ?? [])
          .reverse()
          .filter((m) => m.sender_type === "customer" || m.sender_type === "ai")
          .map((m) => ({ role: (m.sender_type === "customer" ? "user" : "assistant") as "user" | "assistant", content: m.message })),
      ),
    buildTools({ organizationId, sessionId, conversationId: conversation.id }),
    supabase.from("conversation_messages").insert({
      organization_id: organizationId,
      conversation_id: conversation.id,
      sender_type: "customer",
      message: userMessage,
    }),
  ]);

  const systemPrompt = composeSystemPrompt(settingsRow?.voice_response_style ?? null, rulesRows);
  const startedAt = Date.now();
  let answer = "";
  let errorMessage: string | null = null;
  // 인사/감사처럼 LLM 생성이 필요 없는 턴은 아래에서 캔 응답으로 바로 끝내고
  // LLM 호출 자체를 스킵한다 — "일반 응답은 1초 평균" 요구를 맞추기 위한 지름길.
  let cannedHandled = false;

  // 이미 진행 중인 태스크플로우(예: 예약 시나리오)가 있으면 그 그래프가 이번
  // 턴을 이끈다 — 일반 tool-calling 루프를 처음부터 다시 타지 않는다.
  let flowStep: FlowStepResult | null = null;
  if (activeSession) {
    try {
      const gen = advanceTaskSession(activeSession, userMessage);
      let next = await gen.next();
      while (!next.done) {
        // 느린 function 노드(예: finalize_reservation) 직전에 미리 나온
        // "잠시만요" 필러 — answer엔 안 쌓는다(대화 기록엔 실제 답만 남긴다).
        yield { type: "delta", text: next.value.text };
        next = await gen.next();
      }
      flowStep = next.value;
      for (const reply of flowStep.scriptedReplies) {
        const chunk = answer ? ` ${reply}` : reply;
        answer += chunk;
        yield { type: "delta", text: chunk };
      }
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
    }
  }

  let effectiveTools: ToolSet = tools;
  let ragContext: string | undefined;

  // 완전히 새 턴(진행 중인 플로우 없음)이면 Jev의 사전 분류로 경로를 좁힌다 —
  // "task"로 분류되면 여기서 바로 플로우를 시작해서, 위 활성 세션 재개 케이스와
  // 동일하게 flowStep을 채운다(= LLM의 start_task_flow tool-calling 라운드트립을
  // 또 하나 없앤다).
  if (!activeSession && intent) {
    yield { type: "trace", step: "intent_classification", detail: `${intent.choice} (${(intent.confidence * 100).toFixed(0)}%)` };

    if (intent.choice === "chat_greeting" || intent.choice === "chat_thanks") {
      // 인사말은 조직이 직접 지정해둔 문구가 있으면 그걸 그대로 쓰고(랜덤 분기
      // 없이 일관된 멘트가 필요한 경우가 많다), 없으면 기본 캔 응답 중 하나를 고른다.
      const customGreeting = intent.choice === "chat_greeting" ? settingsRow?.greeting_message : null;
      const replies = CANNED_REPLIES[intent.choice];
      const reply = customGreeting?.trim() || replies[Math.floor(Math.random() * replies.length)];
      answer = reply;
      cannedHandled = true;
      yield { type: "delta", text: reply };
    } else if (intent.choice === "chat_other") {
      effectiveTools = {};
    } else if (intent.choice === "knowledge") {
      try {
        const matches = await searchKnowledge(organizationId, userMessage, { matchCount: 5 });
        yield { type: "knowledge_start", queries: [userMessage] };
        ragContext = matches.map((m) => `- ${m.content}`).join("\n") || "(관련 내용 없음)";
        effectiveTools = Object.fromEntries(Object.entries(tools).filter(([name]) => name !== "search_knowledge"));
      } catch {
        // 사전 검색 실패 시 안전하게 전체 tools로 폴백(LLM이 직접 search_knowledge를 부르게).
      }
    } else if (intent.choice === "task") {
      try {
        const flowChoice = await classifyTaskFlowChoice(userMessage, enabledFlows);
        // Jev가 criteria에 없는 값을 돌려줄 리는 없지만(hallucination 방어),
        // flow_id가 실제 목록에 있는지 한 번 더 확인하고서야 세션을 만든다 —
        // 아니면 task_sessions.flow_id FK 제약을 어겨 insert가 그냥 실패한다.
        if (flowChoice && flowChoice.choice !== "none" && enabledFlows.some((f) => f.id === flowChoice.choice)) {
          yield { type: "trace", step: "task_flow_routing", detail: `${flowChoice.choice} (${(flowChoice.confidence * 100).toFixed(0)}%)` };
          // "그걸로 예약할게요"처럼 방금 턴만 보면 서비스가 뭔지 알 수 없는
          // 지시대명사 트리거가 흔하다 — 직전 사용자 발화 몇 개를 같이 묶어서
          // 플로우 시작 컨텍스트로 넘기면, finalizeReservation이 몇 턴 전에
          // 언급된 서비스명까지 보고 추출할 수 있다.
          const recentUserContext = [...history.filter((h) => h.role === "user").slice(-2).map((h) => h.content), userMessage].join(" ");
          const started = await startTaskFlow(organizationId, sessionId, flowChoice.choice, recentUserContext);
          if (started.started) {
            for (const filler of started.fillers) yield { type: "delta", text: filler };
            flowStep = started.step;
            for (const reply of flowStep.scriptedReplies) {
              const chunk = answer ? ` ${reply}` : reply;
              answer += chunk;
              yield { type: "delta", text: chunk };
            }
            // 이미 직접 시작했으니 LLM이 start_task_flow를 또 부를 필요는 없다.
            effectiveTools = Object.fromEntries(Object.entries(tools).filter(([name]) => name !== "start_task_flow"));
          }
        }
      } catch (err) {
        console.error("[classifyTaskFlowChoice] 실패:", err);
        // 실패해도 effectiveTools는 전체 그대로라 LLM이 직접 start_task_flow를 판단할 수 있다.
      }
    }
  }

  // flowStep이 있는데 직전에 추가로 할 말(systemDirectives)이 없으면(순수 메시지
  // 노드로 끝났거나 완료됨) 이미 scriptedReplies로 답을 다 했으니 LLM을 또 안 돌린다.
  const needsLlmTurn = !cannedHandled && (!flowStep || flowStep.systemDirectives.length > 0);

  if (!errorMessage && needsLlmTurn) {
    try {
      const effectiveSystemPrompt = flowStep?.systemDirectives.length
        ? `${systemPrompt}\n\n[진행 중인 업무 처리 지시]\n${flowStep.systemDirectives.join("\n")}`
        : ragContext
          ? `${systemPrompt}\n\n[검색된 지식베이스 내용]\n${ragContext}`
          : systemPrompt;

      const result = streamText({
        model: openai(settingsRow?.llm_model ?? "gpt-6-luna"),
        system: effectiveSystemPrompt,
        messages: [...history, { role: "user", content: userMessage }],
        tools: effectiveTools,
        stopWhen: stepCountIs(4),
        abortSignal: signal,
        // reasoningEffort 기본값이 "medium"이라 채팅/tool-calling처럼 즉답이
        // 필요한 용도엔 불필요하게 느리다. "none"/"minimal"은 gpt-6-luna가
        // 지원 안 해서(SDK가 조용히 무시하고 medium으로 폴백함) "low"가 실제로
        // 쓸 수 있는 최솟값이다.
        providerOptions: { openai: { reasoningEffort: "low" } },
      });

      for await (const part of result.fullStream) {
        if (part.type === "text-delta") {
          answer += part.text;
          yield { type: "delta", text: part.text };
        } else if (part.type === "tool-call") {
          if (part.toolName === "search_knowledge") {
            const query = (part.input as { query?: string } | undefined)?.query;
            yield { type: "knowledge_start", queries: query ? [query] : [] };
          } else {
            yield { type: "trace", step: part.toolName, detail: "실행 중" };
          }
        } else if (part.type === "tool-error") {
          console.error(`[tool-error] ${part.toolName}:`, part.error);
        } else if (part.type === "error") {
          errorMessage = part.error instanceof Error ? part.error.message : String(part.error);
        }
      }
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
    }
  }

  if (errorMessage) {
    await supabase.from("agent_runs").insert({
      organization_id: organizationId,
      session_id: sessionId,
      user_message: userMessage,
      status: "error",
      error_message: errorMessage,
    });
    yield { type: "error", message: errorMessage };
    return;
  }

  // 턴이 끝난 뒤의 기록(AI 메시지 저장/대화 갱신/로그)은 응답을 이미 다 보낸
  // 뒤라 클라이언트 체감 지연과 무관하다 — 병렬로만 처리하고 await한다.
  await Promise.all([
    supabase.from("conversation_messages").insert({
      organization_id: organizationId,
      conversation_id: conversation.id,
      sender_type: "ai",
      message: answer,
    }),
    supabase.from("conversations").update({ last_message: answer, last_message_at: new Date().toISOString() }).eq("id", conversation.id),
    supabase.from("agent_runs").insert({
      organization_id: organizationId,
      session_id: sessionId,
      user_message: userMessage,
      final_response: answer,
      status: "success",
    }),
    supabase.from("ai_usage_logs").insert({
      organization_id: organizationId,
      conversation_id: conversation.id,
      session_id: sessionId,
      channel,
      feature: "chat",
      provider: "openai",
      model: settingsRow?.llm_model ?? "gpt-6-luna",
      metadata: { elapsed_ms: Date.now() - startedAt },
    }),
  ]);

  yield { type: "done", answer, conversationId: conversation.id, shouldEndSession: false };
}
