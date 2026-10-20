import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "../../../../../lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 프론트가 fire-and-forget으로 호출하는 통화 종료 로깅. 실패해도 통화 흐름에
// 영향 없게 항상 200을 준다 — 대신 서버 로그로만 에러를 남긴다.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const organizationId = body?.organization_id as string | undefined;
  const sessionId = body?.session_id as string | undefined;

  if (organizationId && sessionId) {
    try {
      const supabase = createSupabaseServiceClient();
      await supabase
        .from("conversations")
        .update({ call_ended_at: new Date().toISOString() })
        .eq("organization_id", organizationId)
        .eq("session_id", sessionId);
    } catch (err) {
      console.error("voice/call/end 로깅 실패:", err);
    }
  }

  return NextResponse.json({ ok: true });
}
