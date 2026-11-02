/* eslint-disable @typescript-eslint/no-explicit-any */
import { createSupabaseServiceClient } from "../supabase/service";

// 관리자 콘솔의 "템플릿으로 생성" / "브리프로 생성"이 쓰는 플로우 템플릿 카탈로그.
// 노드/엣지 형식은 taskFlowCompiler.ts가 실행하는 그대로다:
//  - message: 고정 문구(config.text), instruction: LLM 지시 + 사용자 답을 받는다(save_to_memory),
//  - function: functionRegistry 함수 호출(config.function_name/params/save_as),
//  - 엣지는 single / condition({field, op, value}) / fallback.

type TemplateNode = {
  node_key: string;
  node_type: "message" | "instruction" | "function";
  label: string;
  config: Record<string, unknown>;
};
type TemplateEdge = {
  source_node_key: string;
  target_node_key: string;
  edge_type?: "single" | "condition" | "fallback";
  condition_type?: string;
  condition_config?: Record<string, unknown>;
  priority?: number;
};
export type FlowTemplate = {
  template_key: string;
  name: string;
  description: string;
  trigger_intent: string;
  trigger_description: string;
  trigger_examples: string[];
  allowed_channels: string[];
  required_slots: string[];
  nodes: TemplateNode[];
  edges: TemplateEdge[];
};

const reservationFlow: FlowTemplate = {
  template_key: "reservation",
  name: "예약 접수",
  description: "서비스, 희망 일시, 연락처를 차례로 묻고 예약을 만든다.",
  trigger_intent: "reservation",
  trigger_description: "고객이 예약을 하거나 예약 가능 여부를 문의할 때",
  trigger_examples: ["예약하고 싶어요", "내일 오후에 예약 가능한가요?", "상담 예약 잡아주세요"],
  allowed_channels: ["web_chat", "web_call", "phone"],
  required_slots: ["service", "datetime", "contact"],
  nodes: [
    {
      node_key: "ask_service",
      node_type: "instruction",
      label: "서비스 질문",
      config: { instruction: "어떤 서비스를 예약하실지 짧고 친절하게 물어보세요.", save_to_memory: "service_text" },
    },
    {
      node_key: "ask_datetime",
      node_type: "instruction",
      label: "희망 일시 질문",
      config: { instruction: "희망하시는 날짜와 시간을 물어보세요.", save_to_memory: "datetime_text" },
    },
    {
      node_key: "ask_contact",
      node_type: "instruction",
      label: "연락처 질문",
      config: { instruction: "예약자 성함과 연락처를 물어보세요.", save_to_memory: "contact_text" },
    },
    {
      node_key: "finalize",
      node_type: "function",
      label: "예약 확정",
      config: {
        function_name: "finalize_reservation",
        params: { serviceText: "{{service_text}}", datetimeText: "{{datetime_text}}", contactText: "{{contact_text}}" },
        save_as: "reservation_result",
        narrate: false,
        filler_text: "잠시만요, 예약 가능한 시간을 확인하고 있어요.",
      },
    },
    {
      node_key: "done",
      node_type: "instruction",
      label: "예약 완료 안내",
      config: { instruction: "예약이 접수되었음을 알리고 예약 정보(서비스/일시)를 한 번 요약해 주세요. 확정 여부는 매장 확인 후 안내된다고 말해 주세요." },
    },
    {
      node_key: "failed",
      node_type: "instruction",
      label: "예약 실패 안내",
      config: { instruction: "예약 처리 중 문제가 있었다고 사과하고, 희망 일시를 다시 말씀해 달라고 안내하세요.", save_to_memory: "datetime_text" },
    },
  ],
  edges: [
    { source_node_key: "ask_service", target_node_key: "ask_datetime" },
    { source_node_key: "ask_datetime", target_node_key: "ask_contact" },
    { source_node_key: "ask_contact", target_node_key: "finalize" },
    {
      source_node_key: "finalize",
      target_node_key: "done",
      edge_type: "condition",
      condition_type: "equals",
      condition_config: { field: "reservation_result.ok", op: "eq", value: "true" },
      priority: 200,
    },
    { source_node_key: "finalize", target_node_key: "failed", edge_type: "fallback", condition_type: "fallback", priority: 100 },
  ],
};

const inquiryFlow: FlowTemplate = {
  template_key: "inquiry",
  name: "문의 접수",
  description: "문의 내용과 연락처를 받아 담당자 확인 후 연락드린다고 안내한다.",
  trigger_intent: "inquiry",
  trigger_description: "고객이 상담 요청, 견적 문의, 담당자 연결을 원할 때",
  trigger_examples: ["상담 받고 싶어요", "담당자랑 통화하고 싶어요", "견적 문의드려요"],
  allowed_channels: ["web_chat", "web_call", "phone"],
  required_slots: ["inquiry", "contact"],
  nodes: [
    {
      node_key: "ask_inquiry",
      node_type: "instruction",
      label: "문의 내용 질문",
      config: { instruction: "어떤 내용이 궁금하신지 구체적으로 물어보세요.", save_to_memory: "inquiry_text" },
    },
    {
      node_key: "ask_contact",
      node_type: "instruction",
      label: "연락처 질문",
      config: { instruction: "담당자가 연락드릴 수 있도록 성함과 연락처를 물어보세요.", save_to_memory: "contact_text" },
    },
    {
      node_key: "done",
      node_type: "instruction",
      label: "접수 완료 안내",
      config: { instruction: "문의가 접수되었고 담당자가 확인 후 연락드릴 것이라고 안내하세요. {{inquiry_text}}" },
    },
  ],
  edges: [
    { source_node_key: "ask_inquiry", target_node_key: "ask_contact" },
    { source_node_key: "ask_contact", target_node_key: "done" },
  ],
};

const welcomeFlow: FlowTemplate = {
  template_key: "welcome",
  name: "첫 인사 안내",
  description: "처음 방문한 고객에게 서비스 목록을 안내한다.",
  trigger_intent: "welcome",
  trigger_description: "고객이 이용 방법이나 제공 서비스가 무엇인지 물을 때",
  trigger_examples: ["뭘 할 수 있나요?", "어떤 서비스가 있어요?", "이용 방법 알려주세요"],
  allowed_channels: ["web_chat", "web_call", "phone"],
  required_slots: [],
  nodes: [
    {
      node_key: "list",
      node_type: "function",
      label: "서비스 목록 조회",
      config: { function_name: "list_services", save_as: "services", narrate: true },
    },
  ],
  edges: [],
};

export const FLOW_TEMPLATES: FlowTemplate[] = [reservationFlow, inquiryFlow, welcomeFlow];

export function getFlowTemplate(key: string) {
  return FLOW_TEMPLATES.find((t) => t.template_key === key);
}

export function summarizeTemplate(t: FlowTemplate) {
  return {
    template_key: t.template_key,
    name: t.name,
    description: t.description,
    trigger_intent: t.trigger_intent,
    trigger_description: t.trigger_description,
    trigger_examples: t.trigger_examples,
    node_count: t.nodes.length,
    edge_count: t.edges.length,
  };
}

export type GenerateOverrides = {
  name?: string;
  description?: string;
  triggerDescription?: string | null;
  triggerExamples?: string[] | null;
  allowedChannels?: string[] | null;
};

// 템플릿으로 task_flows/task_nodes/task_edges를 만든다. 같은 trigger_intent의 플로우가
// 이미 있으면 overwrite=false일 때는 건너뛰고, true일 때는 기존 플로우를 지우고 다시 만든다.
export async function createFlowFromTemplate(params: {
  organizationId: string;
  template: FlowTemplate;
  overwrite: boolean;
  isEnabled: boolean;
  overrides?: GenerateOverrides;
}) {
  const { organizationId, template, overwrite, isEnabled, overrides } = params;
  const supabase = createSupabaseServiceClient();

  const { data: existing, error: existingError } = await supabase
    .from("task_flows")
    .select("id, name")
    .eq("organization_id", organizationId)
    .eq("trigger_intent", template.trigger_intent);
  if (existingError) throw existingError;

  if (existing?.length) {
    if (!overwrite) {
      return {
        template_key: template.template_key,
        flow_id: existing[0].id,
        name: existing[0].name,
        trigger_intent: template.trigger_intent,
        node_count: 0,
        edge_count: 0,
        created: false,
        skipped: true,
        skip_reason: "같은 트리거의 플로우가 이미 있습니다.",
      };
    }
    const { error } = await supabase.from("task_flows").delete().in("id", existing.map((f) => f.id));
    if (error) throw error;
  }

  const { data: flow, error: flowError } = await supabase
    .from("task_flows")
    .insert({
      organization_id: organizationId,
      name: overrides?.name ?? template.name,
      description: overrides?.description ?? template.description,
      trigger_intent: template.trigger_intent,
      trigger_description: overrides?.triggerDescription ?? template.trigger_description,
      trigger_examples: overrides?.triggerExamples ?? template.trigger_examples,
      allowed_channels: overrides?.allowedChannels ?? template.allowed_channels,
      filters: {},
      is_enabled: isEnabled,
    })
    .select("id, name")
    .single();
  if (flowError) throw flowError;

  try {
    const { error: nodesError } = await supabase.from("task_nodes").insert(
      template.nodes.map((n, i) => ({
        flow_id: flow.id,
        node_key: n.node_key,
        node_type: n.node_type,
        label: n.label,
        config: n.config,
        position_x: i * 280,
        position_y: 0,
        timeout_seconds: 10,
        retry_limit: 0,
      })),
    );
    if (nodesError) throw nodesError;

    if (template.edges.length) {
      const { error: edgesError } = await supabase.from("task_edges").insert(
        template.edges.map((e) => ({
          flow_id: flow.id,
          source_node_key: e.source_node_key,
          target_node_key: e.target_node_key,
          edge_type: e.edge_type ?? "single",
          condition_type: e.condition_type ?? "always",
          condition_config: e.condition_config ?? {},
          is_failure_edge: e.edge_type === "fallback",
          priority: e.priority ?? 100,
        })),
      );
      if (edgesError) throw edgesError;
    }
  } catch (err) {
    // 노드/엣지 생성이 실패하면 반쪽짜리 플로우가 남지 않도록 플로우를 지운다.
    await supabase.from("task_flows").delete().eq("id", flow.id);
    throw err;
  }

  return {
    template_key: template.template_key,
    flow_id: flow.id,
    name: flow.name,
    trigger_intent: template.trigger_intent,
    node_count: template.nodes.length,
    edge_count: template.edges.length,
    created: true,
    skipped: false,
    skip_reason: null,
  };
}
