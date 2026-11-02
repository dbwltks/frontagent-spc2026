import { NextRequest } from "next/server";
import { runAdmin } from "../../../lib/org/adminRoute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  return runAdmin(request, async ({ organizationId, supabase, query }) => {
    const limit = Math.min(Math.max(Number(query.get("limit")) || 100, 1), 500);
    const { data, error } = await supabase
      .from("reservations")
      .select("*")
      .eq("organization_id", organizationId)
      .order("start_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return { items: data ?? [] };
  });
}
