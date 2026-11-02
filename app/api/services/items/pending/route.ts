import { NextRequest } from "next/server";
import { runAdmin } from "../../../../../lib/org/adminRoute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  return runAdmin(request, async ({ organizationId, supabase, query }) => {
    let q = supabase.from("service_items").select("*").eq("organization_id", organizationId);
    q =
      query.get("include_needs_review") === "true"
        ? q.or("approval_status.eq.pending,approval_status.eq.needs_review,sync_status.eq.needs_review")
        : q.eq("approval_status", "pending");
    const serviceId = query.get("service_id");
    if (serviceId) q = q.eq("service_id", serviceId);
    const { data: items, error } = await q.order("created_at", { ascending: true });
    if (error) throw error;

    if (query.get("include_options") !== "true" || !items?.length) return { items: items ?? [] };

    const { data: options, error: optError } = await supabase
      .from("service_item_options")
      .select("*")
      .eq("organization_id", organizationId)
      .in("service_item_id", items.map((i) => i.id));
    if (optError) throw optError;
    return { items: items.map((i) => ({ ...i, options: (options ?? []).filter((o) => o.service_item_id === i.id) })) };
  });
}
