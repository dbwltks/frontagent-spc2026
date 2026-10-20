import { createSupabaseServiceClient } from "../supabase/service";
import { createSupabaseServerClient } from "../supabase/server";

export class OrganizationAccessError extends Error {}

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
  const { data: userData, error: userError } = await server.auth.getUser();
  if (userError || !userData.user) throw new OrganizationAccessError("로그인이 필요합니다.");

  const service = createSupabaseServiceClient();
  const { data: membership, error } = await service
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (error) throw new OrganizationAccessError(error.message);
  if (!membership) throw new OrganizationAccessError("이 조직에 접근 권한이 없습니다.");

  return { userId: userData.user.id, role: membership.role as string };
}
