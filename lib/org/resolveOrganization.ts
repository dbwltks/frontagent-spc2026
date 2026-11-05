import { createSupabaseServiceClient } from "../supabase/service";
import { createSupabaseServerClient } from "../supabase/server";

export class OrganizationAccessError extends Error {}

// 관리자 콘솔에 들어올 수 있는 역할. 그 외(member 등)는 일반 멤버로 취급한다.
const ADMIN_ROLES = new Set(["owner", "admin"]);

// 공개 위젯 라우트(/api/voice/*, /api/chat)용 — 인증 없이 organization_id가
// 실존하는 조직인지만 확인한다. organizations/organization_members는 RLS가
// 꺼져있어(advisor 확인됨) DB가 접근을 막아주지 않으므로, 여기서 직접
// 존재 여부를 검증하는 게 사실상 유일한 방어선이다.
export async function resolvePublicOrganization(organizationId: string) {
  if (!organizationId) throw new OrganizationAccessError("organization_id가 필요합니다.");

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("id", organizationId)
    .maybeSingle();

  if (error) throw new OrganizationAccessError(error.message);
  if (!data) throw new OrganizationAccessError("존재하지 않는 조직입니다.");
  return data;
}

// 관리자 콘솔 라우트용 — 로그인한 유저가 이 organization_id의 멤버인지 확인한다.
export async function resolveAdminOrganization(organizationId: string) {
  if (!organizationId) throw new OrganizationAccessError("organization_id가 필요합니다.");

  const server = await createSupabaseServerClient();
  // getUser()는 매번 Auth 서버를 왕복하지만, 이 프로젝트의 JWT는 비대칭 키(ES256)라
  // getClaims()가 공개키(JWKS, 캐시됨)로 서명·만료를 로컬에서 검증한다 — 왕복 한 번이 사라진다.
  const { data: claimsData, error: claimsError } = await server.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (claimsError || !userId) throw new OrganizationAccessError("로그인이 필요합니다.");

  const service = createSupabaseServiceClient();
  const { data: membership, error } = await service
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new OrganizationAccessError(error.message);
  if (!membership) throw new OrganizationAccessError("이 조직에 접근 권한이 없습니다.");
  // 일반 멤버(member 등)는 조직에 속해 있어도 관리자 콘솔 데이터에 접근할 수 없다.
  if (!ADMIN_ROLES.has(membership.role)) throw new OrganizationAccessError("관리자 권한이 필요합니다.");

  return { userId, role: membership.role as string };
}
