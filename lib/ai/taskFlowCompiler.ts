import { tool } from "ai";
import { z } from "zod";
import { createSupabaseServiceClient } from "../supabase/service";
import { callRegisteredFunction } from "./tools/functionRegistry";

type TaskFlow = {
  id: string;
  name: string;
  description: string | null;
  trigger_intent: string | null;
  trigger_description: string | null;
  trigger_examples: string[] | null;
};

type TaskNode = {
  id: string;
  flow_id: string;
  node_key: string;
  node_type: "message" | "instruction" | "function" | string;
  label: string | null;
  config: Record<string, unknown> | null;
};

type TaskEdge = {
  id: string;
  flow_id: string;
  source_node_key: string;
  target_node_key: string;
  edge_type: "single" | "branch" | "fallback" | "condition" | string;
  condition_type: string | null;
  condition_config: Record<string, unknown> | null;
  is_failure_edge: boolean | null;
  priority: number | null;
};

type TaskSession = {
  id: string;
  organization_id: string;
  session_id: string;
  flow_id: string;
  current_node_key: string | null;
  variables: Record<string, unknown>;
  status: string;
};

// {{memory.foo}} / {{foo}} 둘 다 variables에서 찾아 치환한다.
function interpolate(template: string, variables: Record<string, unknown>): string {
  return template.replace(/\{\{\s*(?:memory\.)?([\w.]+)\s*\}\}/g, (_, key: string) => {
    const value = key.split(".").reduce<unknown>((acc, part) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[part] : undefined), variables);
    if (value === undefined || value === null) return "";
    return typeof value === "object" ? JSON.stringify(value) : String(value);
  });
}

function readPath(variables: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, part) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[part] : undefined), variables);
}

function evaluateCondition(condition: Record<string, unknown> | null, variables: Record<string, unknown>): boolean {
  if (!condition) return true;
  const field = condition.field as string | undefined;
  const op = (condition.op as string | undefined) ?? "eq";
  if (!field) return true;
  // interpolate()와 동일하게 "reservation_result.ok" 같은 점 경로도 지원한다.
  const actual = readPath(variables, field);
  const expected = condition.value;

  switch (op) {
    case "eq":
      return String(actual) === String(expected);
    case "neq":
      return String(actual) !== String(expected);
    case "exists":
      return actual !== undefined && actual !== null && actual !== "";
    case "not_exists":
      return actual === undefined || actual === null || actual === "";
    case "gt":
      return Number(actual) > Number(expected);
    case "gte":
      return Number(actual) >= Number(expected);
    case "lt":
      return Number(actual) < Number(expected);
    case "lte":
      return Number(actual) <= Number(expected);
    case "contains":
      return typeof actual === "string" && actual.includes(String(expected));
    default:
      return true;
  }
}

async function loadGraph(flowId: string) {
  const supabase = createSupabaseServiceClient();
  const [{ data: nodes, error: nodesError }, { data: edges, error: edgesError }] = await Promise.all([
    supabase.from("task_nodes").select("id, flow_id, node_key, node_type, label, config").eq("flow_id", flowId),
    supabase
      .from("task_edges")
      .select("id, flow_id, source_node_key, target_node_key, edge_type, condition_type, condition_config, is_failure_edge, priority")
      .eq("flow_id", flowId),
  ]);
  if (nodesError) throw nodesError;
  if (edgesError) throw edgesError;
  return { nodes: (nodes ?? []) as TaskNode[], edges: (edges ?? []) as TaskEdge[] };
}

// instruction 노드는 항상 사용자 응답을 기다린다. message 노드는 보통
// 자동으로 지나가지만, save_to_memory가 걸려있으면(예: fail_retry — 미리
// 만들어둔 문구를 보여주고 바로 다음 답을 받아야 하는 경우) 그 노드도
// 멈춰서 사용자 입력을 받는다 — LLM 재질문 호출 없이 고정/보간 문구만으로
// "되묻기"가 끝나는 경로를 만들기 위함이다.
function waitsForUserInput(node: TaskNode): boolean {
  if (node.node_type === "instruction") return true;
  return Boolean((node.config as Record<string, unknown> | null)?.save_to_memory);
}

function findStartNode(nodes: TaskNode[], edges: TaskEdge[]): TaskNode | null {
  const targetKeys = new Set(edges.map((e) => e.target_node_key));
  const withoutIncoming = nodes.filter((n) => !targetKeys.has(n.node_key));
  return withoutIncoming[0] ?? nodes[0] ?? null;
}

function findNextNodeKey(currentNode: TaskNode, edges: TaskEdge[], variables: Record<string, unknown>): string | null {
  const outgoing = edges
    .filter((e) => e.source_node_key === currentNode.node_key)
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

  if (outgoing.length > 0) {
    const matched = outgoing.find((e) => e.edge_type !== "fallback" && evaluateCondition(e.condition_config, variables));
    if (matched) return matched.target_node_key;
    const fallback = outgoing.find((e) => e.edge_type === "fallback");
    if (fallback) return fallback.target_node_key;
  }

  // 엣지가 아직 안 이어진 플로우(generate-from-brief 직후 등)는 노드 자체의
  // config에 있는 next_step_mode/next_node_key/branch_*를 폴백으로 쓴다.
  const config = currentNode.config ?? {};
  const nextMode = config.next_step_mode as string | undefined;
  if (nextMode === "end") return null;
  if (nextMode === "branch") {
    const matches = evaluateCondition((config.branch_condition as Record<string, unknown>) ?? null, variables);
    const key = matches ? (config.branch_node_key as string | undefined) : (config.fallback_node_key as string | undefined);
    return key ?? null;
  }
  return (config.next_node_key as string | undefined) ?? null;
}

async function renderNode(
  node: TaskNode,
  session: TaskSession,
): Promise<{ reply: string | null; systemDirective: string | null }> {
  const config = node.config ?? {};

  if (node.node_type === "message") {
    const template = (config.text as string) ?? (config.message as string) ?? node.label ?? "";
    return { reply: interpolate(template, session.variables), systemDirective: null };
  }

  if (node.node_type === "function") {
    const functionName = config.function_name as string | undefined;
    if (!functionName) return { reply: null, systemDirective: `[태스크 오류: function_name 누락 — ${node.node_key}]` };

    const rawParams = (config.params as Record<string, unknown>) ?? {};
    const params: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(rawParams)) {
      params[key] = typeof value === "string" ? interpolate(value, session.variables) : value;
    }

    const result = await callRegisteredFunction(functionName, params, session.organization_id);
    const saveAs = config.save_as as string | undefined;
    if (saveAs) session.variables[saveAs] = result;

    // narrate:false면 결과를 LLM한테 넘기지 않는다 — 뒤에 이어지는 message/
    // instruction 노드가 이미 {{memory.x}}로 결과를 직접 참조해 안내하는
    // 경우(예: 성공/실패 분기별 전용 메시지 노드)엔 중복 안내가 생기기 때문이다.
    if (config.narrate === false) return { reply: null, systemDirective: null };

    return { reply: null, systemDirective: `[함수 ${functionName} 결과] ${JSON.stringify(result)} — 이 결과를 바탕으로 자연스럽게 다음 안내를 하라.` };
  }

  // instruction 노드 — 이번 턴 system prompt에 지시를 추가하고, LLM이 자유롭게 답하게 한다.
  const instruction = (config.instruction as string) ?? node.label ?? "";
  return { reply: null, systemDirective: interpolate(instruction, session.variables) };
}

export type FlowStepResult = {
  systemDirectives: string[];
  scriptedReplies: string[];
  sessionCompleted: boolean;
};

// function 노드 중 느린 것(구조화 추출+DB 조회가 들어가는 finalize_reservation
// 등)은 config.filler_text를 걸어두면 그 함수를 실제로 호출하기 "직전"에
// 먼저 내보낸다 — 제너레이터라 호출부가 await 없이 즉시 받아 클라이언트로
// 흘려보낼 수 있다("잠시만요" 체감 지연 가리기).
export type FlowEvent = { type: "filler"; text: string };

// 활성 세션 하나를 한 턴만큼 전진시킨다 — message/function 노드는 자동으로
// 이어서 처리하고(사용자 입력을 안 기다리는 단계들), instruction 노드에서
// system directive를 만들어내면 그 턴은 거기서 멈추고 LLM이 자유 응답한다.
//
// incomingUserMessage가 있으면(= 플로우가 이미 instruction 노드에서 사용자
// 응답을 기다리던 중이라는 뜻) 그 노드는 다시 렌더링(재질문)하지 않고,
// save_to_memory가 설정돼 있으면 사용자의 원문을 그대로 저장한 뒤 다음
// 노드로 넘어간다 — 구조화 추출까지는 v1 범위 밖이라 원문 저장이 한계다.
export async function* advanceTaskSession(session: TaskSession, incomingUserMessage?: string): AsyncGenerator<FlowEvent, FlowStepResult> {
  const supabase = createSupabaseServiceClient();
  const { nodes, edges } = await loadGraph(session.flow_id);
  const nodeByKey = new Map(nodes.map((n) => [n.node_key, n]));

  const systemDirectives: string[] = [];
  const scriptedReplies: string[] = [];
  let currentKey = session.current_node_key ?? findStartNode(nodes, edges)?.node_key ?? null;
  let guard = 0;

  if (incomingUserMessage && currentKey) {
    const waitingNode = nodeByKey.get(currentKey);
    if (waitingNode && waitsForUserInput(waitingNode)) {
      const saveAs = (waitingNode.config as Record<string, unknown> | null)?.save_to_memory as string | undefined;
      if (saveAs) {
        // 이 키에 이미 값이 있으면(= fail_retry로 같은 질문을 또 받는 두 번째
        // 라운드) 거기에 이어붙인다. 처음이면 플로우를 시작시킨 원문 메시지
        // (trigger_message — "한 번에 다 말하는" 경우 서비스/날짜/연락처가
        // 전부 그 안에 있을 수 있다)부터 깔고 이번 답을 이어붙인다 — LLM이
        // 대화 맥락상 이미 아는 내용을 또 안 묻고 건너뛰어도, 실제 구조화
        // 추출(finalizeReservation)은 두 메시지를 합쳐서 전체 맥락을 본다.
        const prior = (session.variables[saveAs] as string | undefined) ?? (session.variables.trigger_message as string | undefined) ?? "";
        session.variables[saveAs] = prior ? `${prior} ${incomingUserMessage}` : incomingUserMessage;
      }
      currentKey = waitingNode ? findNextNodeKey(waitingNode, edges, session.variables) : currentKey;
    }
  }

  while (currentKey && guard < 10) {
    guard += 1;
    const node = nodeByKey.get(currentKey);
    if (!node) break;

    if (node.node_type === "function") {
      const fillerText = (node.config as Record<string, unknown> | null)?.filler_text as string | undefined;
      if (fillerText) yield { type: "filler", text: fillerText };
    }

    const { reply, systemDirective } = await renderNode(node, session);
    if (reply) scriptedReplies.push(reply);
    if (systemDirective) systemDirectives.push(systemDirective);

    // 방금 질문(또는 되묻기 문구)을 던진 것 — 사용자 응답을 받아야 다음으로
    // 넘어갈 수 있으니, current_node_key를 이 노드 자체에 그대로 두고 멈춘다.
    // (재개 시 위쪽 incomingUserMessage 분기가 이 노드 기준으로 다음을 계산한다.)
    if (waitsForUserInput(node)) {
      const { error: pauseError } = await supabase
        .from("task_sessions")
        .update({ status: "waiting_user_input", current_node_key: currentKey, variables: session.variables })
        .eq("id", session.id);
      if (pauseError) console.error("[advanceTaskSession] pause update 실패:", pauseError);
      return { systemDirectives, scriptedReplies, sessionCompleted: false };
    }

    const nextKey = findNextNodeKey(node, edges, session.variables);

    if (!nextKey) {
      // current_node_key는 NOT NULL이라 null로 못 지운다 — 끝난 지점(마지막 노드)을 그대로 남긴다.
      const { error: completeError } = await supabase
        .from("task_sessions")
        .update({ status: "completed", current_node_key: currentKey, variables: session.variables })
        .eq("id", session.id);
      if (completeError) console.error("[advanceTaskSession] complete update 실패:", completeError);
      return { systemDirectives, scriptedReplies, sessionCompleted: true };
    }

    currentKey = nextKey;
  }

  if (currentKey) {
    // task_sessions_status_check 제약 — 'active'는 허용 안 되고 running/waiting_user_input/
    // approval_waiting/completed/cancelled/handoff/failed/expired만 가능하다.
    await supabase
      .from("task_sessions")
      .update({ status: "waiting_user_input", current_node_key: currentKey, variables: session.variables })
      .eq("id", session.id);
  }

  return { systemDirectives, scriptedReplies, sessionCompleted: false };
}

export async function getActiveTaskSession(organizationId: string, sessionId: string): Promise<TaskSession | null> {
  const supabase = createSupabaseServiceClient();
  const { data } = await supabase
    .from("task_sessions")
    .select("id, organization_id, session_id, flow_id, current_node_key, variables, status")
    .eq("organization_id", organizationId)
    .eq("session_id", sessionId)
    .eq("status", "waiting_user_input")
    .maybeSingle();
  if (!data) return null;
  return { ...data, variables: (data.variables as Record<string, unknown>) ?? {} };
}

export async function loadEnabledFlows(organizationId: string): Promise<TaskFlow[]> {
  const supabase = createSupabaseServiceClient();
  const { data } = await supabase
    .from("task_flows")
    .select("id, name, description, trigger_intent, trigger_description, trigger_examples")
    .eq("organization_id", organizationId)
    .eq("is_enabled", true);
  return (data ?? []) as TaskFlow[];
}

// task_sessions row를 만들고 첫 스텝까지 전진시킨다 — LLM tool과 Jev 직접
// 라우팅(turnEngine.ts) 둘 다 이 함수 하나만 공유한다.
export async function startTaskFlow(organizationId: string, sessionId: string, flowId: string, initialMessage?: string) {
  const supabase = createSupabaseServiceClient();
  const { nodes, edges } = await loadGraph(flowId);
  const startNode = findStartNode(nodes, edges);

  // trigger_message — 플로우를 시작시킨 원문 메시지. "한 번에 다 말하는" 식
  // 요청(서비스+날짜+연락처를 첫 마디에 전부 담음)이면 여기에 전부 들어있어,
  // 이후 instruction 노드의 save_to_memory 로직이 이 값부터 깔고 시작한다.
  const initialVariables = initialMessage ? { trigger_message: initialMessage } : {};

  const { data: created, error } = await supabase
    .from("task_sessions")
    .insert({
      organization_id: organizationId,
      session_id: sessionId,
      flow_id: flowId,
      current_node_key: startNode?.node_key ?? null,
      variables: initialVariables,
      status: "running",
    })
    .select("id, organization_id, session_id, flow_id, current_node_key, variables, status")
    .single();
  if (error) {
    console.error("[startTaskFlow] insert 실패:", flowId, error);
    return { started: false as const, reason: error.message };
  }

  const session: TaskSession = { ...created, variables: initialVariables };
  const gen = advanceTaskSession(session);
  const fillers: string[] = [];
  let next = await gen.next();
  while (!next.done) {
    fillers.push(next.value.text);
    next = await gen.next();
  }
  return { started: true as const, step: next.value, fillers };
}

// LLM이 상황에 맞는 플로우를 골라 시작하는 tool. Jev로 이미 분류가 됐을
// 때(turnEngine.ts)는 이 tool 자체를 안 열어주고 직접 startTaskFlow를 부르니,
// 이 tool은 Jev 분류가 애매했거나 꺼져있을 때의 폴백 경로로만 쓰인다.
export async function buildStartTaskFlowTool(organizationId: string, sessionId: string) {
  const flows = await loadEnabledFlows(organizationId);
  if (flows.length === 0) return null;

  const catalogue = flows
    .map((f) => `- flow_id="${f.id}" (${f.name}): ${f.trigger_description ?? f.description ?? ""} 예시: ${(f.trigger_examples ?? []).join(" / ")}`)
    .join("\n");

  return tool({
    description: `아래 사전 정의된 업무 플로우 중 사용자 요청과 맞는 게 있으면 시작한다. 목록에 없는 요청이면 절대 호출하지 마라.\n${catalogue}`,
    inputSchema: z.object({ flow_id: z.string().describe("시작할 플로우의 flow_id") }),
    execute: async ({ flow_id }) => {
      const result = await startTaskFlow(organizationId, sessionId, flow_id);
      if (!result.started) return result;
      return {
        started: true,
        scripted_replies: result.step.scriptedReplies,
        directives: result.step.systemDirectives,
        completed: result.step.sessionCompleted,
      };
    },
  });
}
