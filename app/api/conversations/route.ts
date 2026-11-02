import { NextRequest } from "next/server";
import { runAdmin } from "../../../lib/org/adminRoute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  return runAdmin(request, async ({ organizationId, supabase, query }) => {
    const limit = Math.min(Math.max(Number(query.get("limit")) || 100, 1), 500);
    let q = supabase.from("conversations").select("*").eq("organization_id", organizationId);
    const channel = query.get("channel");
    if (channel) q = q.eq("channel", channel);
    const { data, error } = await q.order("last_message_at", { ascending: false, nullsFirst: false }).limit(limit);
    if (error) throw error;
    return { items: data ?? [] };
  });
}
