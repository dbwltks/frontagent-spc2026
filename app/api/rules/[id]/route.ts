import { NextRequest } from "next/server";
import { BUILTIN_ID_PREFIX, BUILTIN_RULES, loadBuiltinRules } from "../../../../lib/ai/builtinRules";
import { HttpError, must, pick, runAdmin } from "../../../../lib/org/adminRoute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function builtinKey(id: string) {
  if (!id.startsWith(BUILTIN_ID_PREFIX)) return null;
  const key = id.slice(BUILTIN_ID_PREFIX.length);
  if (!BUILTIN_RULES.some((rule) => rule.key === key)) throw new HttpError("기본 규칙을 찾을 수 없습니다.", 404);
  return key;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  return runAdmin(request, async ({ organizationId, supabase, body }) => {
    const key = builtinKey(id);
    const now = new Date().toISOString();

    if (key) {
      // 기본 규칙은 조직별 오버라이드 행으로 저장한다(없으면 만든다).
      const { error } = await supabase
        .from("builtin_rule_overrides")
        .upsert(
          { organization_id: organizationId, builtin_key: key, ...pick(body, ["name", "instruction", "is_active"]), updated_at: now },
          { onConflict: "organization_id,builtin_key" },
        );
      if (error) throw error;
      const rules = await loadBuiltinRules(supabase, organizationId);
      return rules.find((rule) => rule.id === id);
    }

    const result = await supabase
      .from("rules")
      .update({ ...pick(body, ["name", "instruction", "is_active"]), updated_at: now })
      .eq("id", id)
      .eq("organization_id", organizationId)
      .select("*")
      .maybeSingle();
    return must(result, "규칙을 찾을 수 없습니다.");
  });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { id } = await params;
  return runAdmin(request, async ({ organizationId, supabase }) => {
    if (builtinKey(id)) throw new HttpError("기본 규칙은 삭제할 수 없습니다. 비활성화해 주세요.");
    const { error } = await supabase.from("rules").delete().eq("id", id).eq("organization_id", organizationId);
    if (error) throw error;
    return { ok: true };
  });
}
