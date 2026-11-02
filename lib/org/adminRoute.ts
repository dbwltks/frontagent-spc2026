/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "../supabase/service";
import { OrganizationAccessError, resolveAdminOrganization } from "./resolveOrganization";

export const SERVICE_SELECT = "*";

type Ctx = {
  organizationId: string;
  supabase: ReturnType<typeof createSupabaseServiceClient>;
  body: Record<string, any>;
  query: URLSearchParams;
};

// 관리자 콘솔 라우트 공통 래퍼: organization_id(쿼리 또는 body)를 읽고, 로그인한 유저가
// 해당 조직 멤버인지 검증한 뒤 서비스롤 클라이언트로 핸들러를 실행한다.
// 핸들러가 던지는 에러는 { error } JSON으로 변환한다.
export async function runAdmin(
  request: NextRequest,
  handler: (ctx: Ctx) => Promise<Response | unknown>,
  opts: { organizationId?: string } = {},
) {
  const query = request.nextUrl.searchParams;
  let body: Record<string, any> = {};
  if (request.method !== "GET" && request.method !== "DELETE") {
    body = (await request.json().catch(() => ({}))) ?? {};
  }

  const organizationId = opts.organizationId ?? query.get("organization_id") ?? body.organization_id;
  if (typeof organizationId !== "string" || !organizationId) {
    return NextResponse.json({ error: "organization_id가 필요합니다." }, { status: 400 });
  }

  try {
    await resolveAdminOrganization(organizationId);
    const result = await handler({ organizationId, supabase: createSupabaseServiceClient(), body, query });
    return result instanceof Response ? result : NextResponse.json(result);
  } catch (err) {
    if (err instanceof OrganizationAccessError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error(`[admin-route] ${request.method} ${request.nextUrl.pathname} 실패:`, err);
    const message = err instanceof Error ? err.message : (err as { message?: string })?.message || "서버 오류";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export class HttpError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export function must(result: { data: any; error: { message: string } | null }, notFound = "찾을 수 없습니다."): any {
  if (result.error) throw new Error(result.error.message);
  if (result.data == null) throw new HttpError(notFound, 404);
  return result.data;
}

// body에서 허용된 키만 골라 update/insert 페이로드를 만든다.
export function pick(body: Record<string, any>, keys: string[]) {
  const out: Record<string, unknown> = {};
  for (const key of keys) if (body[key] !== undefined) out[key] = body[key];
  return out;
}
