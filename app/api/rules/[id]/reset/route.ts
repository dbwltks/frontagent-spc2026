import { NextRequest } from "next/server";
import { HttpError, runAdmin } from "../../../../../lib/org/adminRoute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 기본(빌트인) 규칙 정의가 파이썬 백엔드와 함께 사라져, 현재는 복원할 기본값이 없다.
export function POST(request: NextRequest) {
  return runAdmin(request, async () => {
    throw new HttpError("이 규칙은 기본값으로 되돌릴 수 없습니다.", 400);
  });
}
