import { NextRequest } from "next/server";
import { runAdmin } from "../../../lib/org/adminRoute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  return runAdmin(request, async ({ organizationId, supabase, query }) => {
    const limit = Math.min(Math.max(Number(query.get("limit")) || 200, 1), 2000);
    const { data, error } = await supabase
      .from("agent_runs")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return { items: data ?? [] };
  });
}
