import { NextRequest, NextResponse } from "next/server";
import { OrganizationAccessError, resolvePublicOrganization } from "../../../../lib/org/resolveOrganization";
import { createSupabaseServiceClient } from "../../../../lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// realtime(WebRTC) 모드는 만들지 않기로 결정했으므로 항상 pipeline을 반환한다.
// organization_ai_settings.voice_mode 컬럼/설정 UI는 미래를 위해 남겨두되,
// 이 엔드포인트는 그 값을 무시하고 고정 응답한다.
//
// stt_mode만 voice_stt_provider를 보고 실제로 갈린다 — "batch"(녹음 다 끝나고
// 업로드, 기존 방식) vs "streaming"(말하는 도중 Deepgram에 실시간 전송, A/B
// 테스트용으로 추가). 둘 다 그 뒤 Jev→LLM→TTS 파이프라인은 동일하다.
export async function GET(request: NextRequest) {
  const organizationId = request.nextUrl.searchParams.get("organization_id");
  if (!organizationId) {
    return NextResponse.json({ error: "organization_id가 필요합니다." }, { status: 400 });
  }

  try {
    await resolvePublicOrganization(organizationId);
    const supabase = createSupabaseServiceClient();
    const { data: settings } = await supabase
      .from("organization_ai_settings")
      .select("voice_stt_provider")
      .eq("organization_id", organizationId)
      .maybeSingle();

    const sttMode = settings?.voice_stt_provider === "deepgram_streaming" ? "streaming" : "batch";
    return NextResponse.json({ mode: "pipeline", stt_mode: sttMode });
  } catch (err) {
    if (err instanceof OrganizationAccessError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
