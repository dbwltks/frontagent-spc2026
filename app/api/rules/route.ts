import { NextRequest } from "next/server";
import { HttpError, must, runAdmin } from "../../../lib/org/adminRoute";
import { loadBuiltinRules } from "../../../lib/ai/builtinRules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  return runAdmin(request, async ({ organizationId, supabase }) => {
    const { data, error } = await supabase
      .from("rules")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return { items: [...(await loadBuiltinRules(supabase, organizationId)), ...(data ?? [])] };
  });
}

export function POST(request: NextRequest) {
  return runAdmin(request, async ({ organizationId, supabase, body }) => {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const instruction = typeof body.instruction === "string" ? body.instruction.trim() : "";
    if (!name || !instruction) throw new HttpError("name, instruction이 필요합니다.");
    const result = await supabase
      .from("rules")
      .insert({ organization_id: organizationId, name, instruction, is_active: body.is_active ?? true })
      .select("*")
      .single();
    return must(result);
  });
}
