import { NextRequest } from "next/server";
import { runAdmin } from "../../../lib/org/adminRoute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  return runAdmin(request, async ({ organizationId, supabase, query }) => {
    let q = supabase.from("services").select("*").eq("organization_id", organizationId);
    if (query.get("include_inactive") !== "true") q = q.eq("is_active", true);
    const { data, error } = await q.order("created_at", { ascending: true });
    if (error) throw error;
    return { items: data ?? [] };
  });
}
