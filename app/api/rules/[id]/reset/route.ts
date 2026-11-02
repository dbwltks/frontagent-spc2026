import { NextRequest } from "next/server";
import { BUILTIN_ID_PREFIX, loadBuiltinRules } from "../../../../../lib/ai/builtinRules";
import { HttpError, runAdmin } from "../../../../../lib/org/adminRoute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 기본 규칙의 오버라이드를 지워 기본 문구/활성 상태로 되돌린다.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return runAdmin(request, async ({ organizationId, supabase }) => {
    if (!id.startsWith(BUILTIN_ID_PREFIX)) throw new HttpError("기본 규칙만 되돌릴 수 있습니다.");
    const { error } = await supabase
      .from("builtin_rule_overrides")
      .delete()
      .eq("organization_id", organizationId)
      .eq("builtin_key", id.slice(BUILTIN_ID_PREFIX.length));
    if (error) throw error;
    const rule = (await loadBuiltinRules(supabase, organizationId)).find((r) => r.id === id);
    if (!rule) throw new HttpError("기본 규칙을 찾을 수 없습니다.", 404);
    return rule;
  });
}
