import type { SupabaseClient } from "@supabase/supabase-js";

// 모든 조직에 기본 제공되는 규칙. 조직별로 켜고 끄거나 문구를 바꾸면
// builtin_rule_overrides에 저장되고, "기본값으로 되돌리기"는 그 행을 지운다.
export const BUILTIN_RULES = [
  { key: "tone_polite", name: "존댓말 사용", instruction: "고객에게 항상 정중한 존댓말로 답하고, 반말이나 지나치게 가벼운 표현은 쓰지 않는다." },
  { key: "answer_concise", name: "간결한 답변", instruction: "답변은 핵심만 두세 문장 안으로 짧게 한다. 필요한 경우에만 항목을 나열한다." },
  { key: "no_guessing", name: "추측 금지", instruction: "확인되지 않은 가격, 일정, 정책은 추측해서 말하지 않고 모른다고 안내한 뒤 담당자 확인을 제안한다." },
  { key: "no_sensitive_info", name: "개인정보 보호", instruction: "주민등록번호, 카드번호, 비밀번호 같은 민감한 정보는 요청하거나 되풀이해 말하지 않는다." },
] as const;

export const BUILTIN_ID_PREFIX = "builtin:";

type OverrideRow = {
  id: string;
  builtin_key: string;
  name: string | null;
  instruction: string | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

// 기본 규칙 + 조직 오버라이드를 합친 목록. id는 "builtin:<key>"로 노출한다.
export async function loadBuiltinRules(supabase: SupabaseClient, organizationId: string) {
  const { data, error } = await supabase
    .from("builtin_rule_overrides")
    .select("id, builtin_key, name, instruction, is_active, created_at, updated_at")
    .eq("organization_id", organizationId);
  if (error) throw error;

  const overrides = new Map((data as OverrideRow[] | null)?.map((row) => [row.builtin_key, row]));
  return BUILTIN_RULES.map((rule) => {
    const override = overrides.get(rule.key);
    return {
      id: `${BUILTIN_ID_PREFIX}${rule.key}`,
      name: override?.name || rule.name,
      instruction: override?.instruction || rule.instruction,
      is_active: override?.is_active ?? true,
      is_builtin: true,
      created_at: override?.created_at ?? null,
      updated_at: override?.updated_at ?? null,
    };
  });
}
