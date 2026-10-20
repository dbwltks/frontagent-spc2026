import { NextRequest, NextResponse } from "next/server";
import { OrganizationAccessError, resolvePublicOrganization } from "../../../../lib/org/resolveOrganization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 브라우저가 Deepgram WebSocket(wss://api.deepgram.com/v1/listen)에 직접 붙을 때
// 쓸 자격증명을 내려준다.
//
// 원래는 여기서 단기 토큰(짧은 만료)을 새로 발급해서 영구 키를 절대 클라이언트에
// 안 보내는 게 맞다 — Deepgram Management API(POST /v1/projects/{id}/keys)로
// 가능한데, 지금 가진 DEEPGRAM_API_KEY가 "keys:write" 권한이 없어서(계정 소유자
// 권한 필요) 당장은 안 된다. 그래서 임시로 영구 키를 그대로 내려주고 있다 —
// Deepgram 콘솔에서 제한된 권한의 키를 새로 만들어 교체하기 전까지는 이 키가
// 통화를 쓰는 누구에게나 노출된다는 걸 인지하고 있어야 한다.
export async function GET(request: NextRequest) {
  const organizationId = request.nextUrl.searchParams.get("organization_id");
  if (!organizationId) {
    return NextResponse.json({ error: "organization_id가 필요합니다." }, { status: 400 });
  }

  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "DEEPGRAM_API_KEY가 설정되지 않았습니다." }, { status: 500 });
  }

  try {
    await resolvePublicOrganization(organizationId);
    return NextResponse.json({
      api_key: apiKey,
      language: "ko",
      model: "nova-3",
      sample_rate: 16000,
    });
  } catch (err) {
    if (err instanceof OrganizationAccessError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
