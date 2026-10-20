import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { createSupabaseServiceClient } from "../../supabase/service";

// LLM tool-calling(registry.ts)과 태스크플로우 "function" 노드(taskFlowCompiler.ts)가
// 같은 실제 동작을 공유하도록 순수 함수로 분리해뒀다 — 둘 다 이 파일을 통해서만 부른다.

export async function checkAvailability(
  organizationId: string,
  params: { serviceId?: string | null; startAt: string; endAt: string },
) {
  const supabase = createSupabaseServiceClient();
  const start = new Date(params.startAt);
  const end = new Date(params.endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return { available: false, reason: "시작/종료 시각이 올바르지 않습니다." };
  }

  const { data: settings } = await supabase
    .from("booking_settings")
    .select("min_notice_minutes, max_days_ahead, is_active")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .maybeSingle();

  if (settings) {
    const minNoticeMs = (settings.min_notice_minutes ?? 0) * 60_000;
    if (start.getTime() < Date.now() + minNoticeMs) {
      return { available: false, reason: `최소 ${settings.min_notice_minutes}분 전에는 예약해야 합니다.` };
    }
    const maxAheadMs = (settings.max_days_ahead ?? 30) * 86_400_000;
    if (start.getTime() > Date.now() + maxAheadMs) {
      return { available: false, reason: `최대 ${settings.max_days_ahead}일 이내로만 예약 가능합니다.` };
    }
  }

  let conflictQuery = supabase
    .from("reservations")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .in("status", ["requested", "confirmed"])
    .lt("start_at", end.toISOString())
    .gt("end_at", start.toISOString());
  if (params.serviceId) conflictQuery = conflictQuery.eq("service_id", params.serviceId);

  const { count, error } = await conflictQuery;
  if (error) return { available: false, reason: `확인 중 오류: ${error.message}` };
  if ((count ?? 0) > 0) return { available: false, reason: "해당 시간대는 이미 예약이 있습니다." };

  return { available: true };
}

export async function createReservation(
  organizationId: string,
  params: {
    serviceId?: string | null;
    serviceItemId?: string | null;
    customerName: string;
    customerPhone?: string | null;
    startAt: string;
    endAt: string;
    memo?: string | null;
    conversationId?: string | null;
  },
) {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("reservations")
    .insert({
      organization_id: organizationId,
      conversation_id: params.conversationId ?? null,
      service_id: params.serviceId ?? null,
      service_item_id: params.serviceItemId ?? null,
      customer_name: params.customerName,
      customer_phone: params.customerPhone ?? null,
      start_at: params.startAt,
      end_at: params.endAt,
      memo: params.memo ?? null,
      status: "requested",
      source_channel: "web_chat",
      created_by: "ai",
    })
    .select("id, status, start_at, end_at")
    .single();

  if (error) return { created: false, reason: error.message };
  return { created: true, reservation: data };
}

export async function listServices(organizationId: string) {
  const supabase = createSupabaseServiceClient();
  const { data } = await supabase
    .from("service_items")
    .select("name, base_price, duration_minutes")
    .eq("organization_id", organizationId)
    .eq("is_available", true);
  if (!data || data.length === 0) return "등록된 서비스가 없습니다.";
  return data.map((i) => `${i.name}(${Number(i.base_price).toLocaleString()}원, 약 ${i.duration_minutes}분)`).join(", ");
}

// "다음주 수요일" 같은 상대 날짜 표현을 모델이 암산(요일 계산)하게 두면
// reasoningEffort를 낮췄을 때 특히 자주 틀린다 — 오늘부터 3주치 날짜-요일
// 대응표를 직접 계산해서 프롬프트에 박아주면 모델은 계산 대신 표에서
// "다음주"+"수요일"에 해당하는 줄을 찾기만 하면 돼서 훨씬 안정적이다.
function buildCalendarHint(): string {
  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
  const today = new Date();
  const isoDow = (today.getDay() + 6) % 7; // 월=0 ... 일=6
  const daysUntilThisSun = 6 - isoDow;
  const lines: string[] = [];
  for (let i = 0; i < 21; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const week = i <= daysUntilThisSun ? "이번주" : i <= daysUntilThisSun + 7 ? "다음주" : "다다음주";
    const special = i === 0 ? "=오늘" : i === 1 ? "=내일" : i === 2 ? "=모레" : "";
    lines.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}(${dayNames[d.getDay()]},${week}${special ? "," + special : ""})`);
  }
  return lines.join(" ");
}

// 복잡한 다중 필드 memory_updates 프로토콜(원래 운영 플로우가 쓰던 방식) 대신,
// 자유 텍스트 3개(서비스/희망일시/연락처)를 한 번의 structured output 호출로
// 구조화해서 바로 예약까지 끝낸다 — 태스크플로우 그래프 자체는 단순하게
// 유지하면서(질문 3개 + 함수 1개) 실제 파싱/검증은 이 함수 안에 모아둔다.
export async function finalizeReservation(
  organizationId: string,
  params: { serviceText?: string; datetimeText?: string; contactText?: string },
) {
  const supabase = createSupabaseServiceClient();
  const { data: items } = await supabase
    .from("service_items")
    .select("id, service_id, name, base_price, duration_minutes")
    .eq("organization_id", organizationId)
    .eq("is_available", true);

  const catalogue = (items ?? [])
    .map((i) => `- ${i.name} (id="${i.id}", ${i.duration_minutes}분, ${Number(i.base_price).toLocaleString()}원)`)
    .join("\n");
  const today = new Date().toISOString().slice(0, 10);

  // follow_up_message를 이 호출 안에서 같이 만들어두는 이유: 추출이 실패하면
  // 원래 taskFlowCompiler가 fail_retry(고정 문구) 다음에 ask_all(instruction)을
  // 다시 띄워 LLM이 "뭐가 빠졌는지"를 자연스럽게 되묻는 문장을 또 한 번
  // 생성했었다 — 재시도 한 턴에 LLM이 2번(추출+재질문) 불리는 구조였다.
  // missing/이미 아는 정보를 이 호출이 이미 다 보고 있으니, 되물을 문장도
  // 여기서 바로 만들면 재시도 턴도 LLM 호출 1번으로 끝난다.
  const { object } = await generateObject({
    model: openai("gpt-6-luna"),
    schema: z.object({
      service_item_id: z.string().uuid().nullable().describe("카탈로그에서 가장 가까운 서비스의 id, 못 찾으면 null"),
      duration_minutes: z.number().nullable(),
      start_at: z.string().nullable().describe("ISO 8601 날짜+시간. 상대 표현(내일/다음주 등)은 오늘 날짜 기준으로 절대값 변환"),
      customer_name: z.string().nullable(),
      customer_phone: z.string().nullable().describe("숫자와 하이픈만 남겨 정규화"),
      missing: z.array(z.enum(["service", "datetime", "name", "phone"])).describe("아직 확인 안 된 항목"),
      follow_up_message: z
        .string()
        .describe(
          "missing이 비어있지 않을 때, 고객에게 자연스럽게 되물을 한국어 문장. 이미 확인된 정보는 다시 묻지 말고 missing 항목만 구체적으로 물어라. 연도 없는 날짜는 되묻지 마라. missing이 비어있으면 빈 문자열.",
        ),
    }),
    system: `오늘 날짜는 ${today}이다. 아래는 예약 가능한 서비스 카탈로그다:\n${catalogue || "(카탈로그 없음)"}\n\n아래는 상대 날짜 표현 변환용 참고표다(계산하지 말고 여기서 찾아라):\n${buildCalendarHint()}`,
    prompt: `고객이 말한 내용에서 예약에 필요한 정보를 추출해라.\n서비스: ${params.serviceText ?? "(미확인)"}\n희망 일시: ${params.datetimeText ?? "(미확인)"}\n이름/연락처: ${params.contactText ?? "(미확인)"}`,
    // 구조화 추출도 reasoningEffort 기본값(medium)이면 체감상 이 함수 전체에서
    // 가장 느린 구간이 된다 — streamText 쪽과 똑같이 "low"로 낮춘다.
    providerOptions: { openai: { reasoningEffort: "low" } },
  });

  if (object.missing.length > 0 || !object.start_at || !object.customer_name) {
    return {
      ok: false,
      reason: "정보 부족",
      missing: object.missing,
      follow_up_message: object.follow_up_message || "예약을 위해 서비스, 날짜/시간, 성함과 연락처를 알려주시겠어요?",
    };
  }

  const start = new Date(object.start_at);
  if (Number.isNaN(start.getTime())) {
    return {
      ok: false,
      reason: "날짜/시간을 이해하지 못했습니다.",
      follow_up_message: "날짜와 시간을 다시 한번 말씀해 주시겠어요? 예: '11월 5일 오후 2시'",
    };
  }
  const durationMin = object.duration_minutes ?? 60;
  const end = new Date(start.getTime() + durationMin * 60_000);
  const matchedItem = (items ?? []).find((i) => i.id === object.service_item_id);

  const availability = await checkAvailability(organizationId, {
    serviceId: matchedItem?.service_id ?? null,
    startAt: start.toISOString(),
    endAt: end.toISOString(),
  });
  if (!availability.available) {
    return { ok: false, reason: availability.reason, follow_up_message: `${availability.reason} 다른 날짜나 시간을 알려주시겠어요?` };
  }

  const created = await createReservation(organizationId, {
    serviceId: matchedItem?.service_id ?? null,
    serviceItemId: object.service_item_id,
    customerName: object.customer_name,
    customerPhone: object.customer_phone,
    startAt: start.toISOString(),
    endAt: end.toISOString(),
  });

  if (!created.created) return { ok: false, reason: created.reason, follow_up_message: `예약 처리 중 문제가 있었어요. 다시 한번 말씀해 주시겠어요?` };
  return { ok: true, reservation: created.reservation, start_at: start.toISOString() };
}

type RegisteredFunction = (organizationId: string, params: Record<string, unknown>) => Promise<unknown>;

// 태스크플로우 "function" 노드의 config.function_name이 이 키와 매칭된다.
const REGISTRY: Record<string, RegisteredFunction> = {
  check_reservation_availability: (organizationId, params) =>
    checkAvailability(organizationId, {
      serviceId: params.serviceId as string | undefined,
      startAt: params.startAt as string,
      endAt: params.endAt as string,
    }),
  create_reservation: (organizationId, params) =>
    createReservation(organizationId, {
      serviceId: params.serviceId as string | undefined,
      customerName: params.customerName as string,
      customerPhone: params.customerPhone as string | undefined,
      startAt: params.startAt as string,
      endAt: params.endAt as string,
      memo: params.memo as string | undefined,
    }),
  list_services: (organizationId) => listServices(organizationId),
  finalize_reservation: (organizationId, params) =>
    finalizeReservation(organizationId, {
      serviceText: params.serviceText as string | undefined,
      datetimeText: params.datetimeText as string | undefined,
      contactText: params.contactText as string | undefined,
    }),
};

export async function callRegisteredFunction(name: string, params: Record<string, unknown>, organizationId: string) {
  const fn = REGISTRY[name];
  if (!fn) return { error: `등록되지 않은 함수입니다: ${name}` };
  try {
    return await fn(organizationId, params);
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
