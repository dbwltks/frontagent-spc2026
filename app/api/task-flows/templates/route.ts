import { NextResponse } from "next/server";

export const runtime = "nodejs";

// 템플릿 정의는 예전 파이썬 백엔드에만 있었다. Next로 이전되기 전까지는 빈 목록을 돌려준다.
export function GET() {
  return NextResponse.json({ items: [] });
}
