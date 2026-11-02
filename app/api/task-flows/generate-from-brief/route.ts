import { NextResponse } from "next/server";

export const runtime = "nodejs";

// 템플릿/브리프 기반 자동 생성 로직은 아직 Next로 이전되지 않았다.
export function POST() {
  return NextResponse.json(
    { error: "작업 플로우 자동 생성은 아직 지원되지 않습니다. 플로우를 직접 만들어 주세요." },
    { status: 501 },
  );
}
