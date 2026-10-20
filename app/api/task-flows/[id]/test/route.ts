import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "../../../../../lib/supabase/service";
import { OrganizationAccessError, resolveAdminOrganization } from "../../../../../lib/org/resolveOrganization";
import { advanceTaskSession, type FlowStepResult } from "../../../../../lib/ai/taskFlowCompiler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 빌더 테스트 버튼은 필러 텍스트를 보여줄 스트리밍 대상이 없는 단발 요청이라
// (SSE가 아니라 평범한 JSON 응답), 제너레이터를 그냥 끝까지 돌리고 필러는
// 일반 응답 메시지처럼 합쳐서 보여준다.
async function drain(gen: AsyncGenerator<{ type: "filler"; text: string }, FlowStepResult>) {
  const fillers: string[] = [];
  let next = await gen.next();
  while (!next.done) {
    fillers.push(next.value.text);
    next = await gen.next();
  }
  return { fillers, result: next.value };
}

// 빌더의 "테스트" 버튼용 드라이런. session_id를 호출마다 새로 만들어 보내는
// 프론트 구현(testTaskFlow)에 맞춰, 매 호출을 "이 세션의 첫 턴"으로 취급한다 —
// 시작 노드부터 먼저 전진시키고, 그 결과가 곧바로 instruction 노드에서 멈추면
// 같은 호출에 온 message를 그 자리에서 바로 소비해 한 번 더 전진시킨다.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: flowId } = await params;
  const body = await request.json().catch(() => null);
  const organizationId = typeof body?.organization_id === "string" ? body.organization_id : null;
  const sessionId = typeof body?.session_id === "string" ? body.session_id : `task_test_${Date.now()}`;
  const message = typeof body?.message === "string" ? body.message : "";

  if (!organizationId) return NextResponse.json({ error: "organization_id가 필요합니다." }, { status: 400 });

  try {
    await resolveAdminOrganization(organizationId);
    const supabase = createSupabaseServiceClient();

    const { data: created, error } = await supabase
      .from("task_sessions")
      .insert({ organization_id: organizationId, session_id: sessionId, flow_id: flowId, variables: {}, status: "running" })
      .select("id, organization_id, session_id, flow_id, current_node_key, variables, status")
      .single();
    if (error) throw error;

    let session = { ...created, variables: (created.variables as Record<string, unknown>) ?? {} };
    const first = await drain(advanceTaskSession(session));
    let step = first.result;
    let fillers = first.fillers;

    if (!step.sessionCompleted && step.systemDirectives.length > 0 && message) {
      const { data: refreshed } = await supabase
        .from("task_sessions")
        .select("id, organization_id, session_id, flow_id, current_node_key, variables, status")
        .eq("id", session.id)
        .single();
      if (refreshed) {
        session = { ...refreshed, variables: (refreshed.variables as Record<string, unknown>) ?? session.variables };
      }
      const second = await drain(advanceTaskSession(session, message));
      fillers = [...fillers, ...second.fillers];
      step = {
        scriptedReplies: [...step.scriptedReplies, ...second.result.scriptedReplies],
        systemDirectives: [...step.systemDirectives, ...second.result.systemDirectives],
        sessionCompleted: second.result.sessionCompleted,
      };
    }

    const { data: finalSession } = await supabase
      .from("task_sessions")
      .select("current_node_key, variables, status")
      .eq("id", session.id)
      .single();

    return NextResponse.json({
      status: finalSession?.status ?? "active",
      response_messages: [...fillers, ...step.scriptedReplies, ...step.systemDirectives.map((d) => `[LLM 지시] ${d}`)],
      current_node_key: finalSession?.current_node_key ?? null,
      task_session_id: session.id,
      variables: finalSession?.variables ?? {},
      error: null,
    });
  } catch (err) {
    if (err instanceof OrganizationAccessError) return NextResponse.json({ error: err.message }, { status: 403 });
    return NextResponse.json(
      { status: "error", response_messages: [], current_node_key: null, task_session_id: null, variables: {}, error: (err as Error).message },
      { status: 500 },
    );
  }
}
