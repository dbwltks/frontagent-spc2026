import { NextRequest } from "next/server";
import OpenAI from "openai";
import { HttpError, runAdmin } from "../../../../lib/org/adminRoute";
import { createFlowFromTemplate, FLOW_TEMPLATES, getFlowTemplate } from "../../../../lib/ai/taskFlowTemplates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Plan = {
  template_key: string;
  name: string;
  description: string;
  trigger_description: string;
  trigger_examples: string[];
  allowed_channels: string[];
  required_slots: string[];
  assistant_tone_hint?: string;
  reasoning?: string;
};

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && v.trim() !== "").map((v) => v.trim()) : [];

// 자연어 브리프를 읽고 가장 맞는 템플릿을 고른 뒤, 이름/트리거 문구를 브리프에 맞게 다듬는다.
async function planFromBrief(brief: string, model: string): Promise<Plan> {
  if (!process.env.OPENAI_API_KEY) throw new HttpError("OPENAI_API_KEY가 설정되지 않았습니다.", 500);

  const catalog = FLOW_TEMPLATES.map(
    (t) => `- ${t.template_key}: ${t.name} — ${t.description} (수집 항목: ${t.required_slots.join(", ") || "없음"})`,
  ).join("\n");

  const client = new OpenAI();
  const completion = await client.chat.completions.create({
    model,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          `당신은 고객응대 챗봇의 업무 플로우 설계자입니다. 사용자의 브리프를 읽고 아래 템플릿 중 가장 알맞은 하나를 고르세요.\n${catalog}\n\n` +
          `JSON으로만 답하세요: {"template_key": string, "name": string, "description": string, "trigger_description": string, ` +
          `"trigger_examples": string[3~5], "allowed_channels": string[] (web_chat|web_call|phone 중), "required_slots": string[], ` +
          `"assistant_tone_hint": string, "reasoning": string}. 모든 문구는 한국어로 작성합니다.`,
      },
      { role: "user", content: brief },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new HttpError("플로우 계획을 만들지 못했습니다.", 502);
  const parsed = JSON.parse(raw) as Partial<Plan>;

  const template = getFlowTemplate(parsed.template_key ?? "");
  if (!template) throw new HttpError("브리프에 맞는 템플릿을 찾지 못했습니다. 템플릿을 직접 선택해 주세요.", 422);

  return {
    template_key: template.template_key,
    name: parsed.name?.trim() || template.name,
    description: parsed.description?.trim() || template.description,
    trigger_description: parsed.trigger_description?.trim() || template.trigger_description,
    trigger_examples: strings(parsed.trigger_examples).length ? strings(parsed.trigger_examples) : template.trigger_examples,
    allowed_channels: strings(parsed.allowed_channels).length ? strings(parsed.allowed_channels) : template.allowed_channels,
    required_slots: strings(parsed.required_slots).length ? strings(parsed.required_slots) : template.required_slots,
    assistant_tone_hint: parsed.assistant_tone_hint,
    reasoning: parsed.reasoning,
  };
}

export function POST(request: NextRequest) {
  return runAdmin(request, async ({ organizationId, supabase, body }) => {
    const brief = typeof body.brief === "string" ? body.brief.trim() : "";
    if (!brief) throw new HttpError("brief가 필요합니다.");

    const { data: settings } = await supabase
      .from("organization_ai_settings")
      .select("llm_model")
      .eq("organization_id", organizationId)
      .maybeSingle();

    const plan = await planFromBrief(brief, settings?.llm_model ?? "gpt-4.1-mini");
    const template = getFlowTemplate(plan.template_key)!;

    const result = await createFlowFromTemplate({
      organizationId,
      template,
      overwrite: body.overwrite === true,
      isEnabled: body.is_enabled !== false,
      overrides: {
        name: plan.name,
        description: plan.description,
        triggerDescription: plan.trigger_description,
        triggerExamples: plan.trigger_examples,
        allowedChannels: plan.allowed_channels,
      },
    });

    return { organization_id: organizationId, plan, result };
  });
}
