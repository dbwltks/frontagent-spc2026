import { NextRequest } from "next/server";
import { runAdmin } from "../../../../lib/org/adminRoute";
import { toServiceAdminItem } from "../../../../lib/org/serviceAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  return runAdmin(request, async ({ organizationId, supabase }) => {
    const base = supabase.from("services").select("*").eq("organization_id", organizationId);
    const { data, error } = await base.or("approval_status.eq.needs_review,sync_status.eq.needs_review").order("updated_at", { ascending: false });
    if (error) throw error;
    return { items: (data ?? []).map(toServiceAdminItem) };
  });
}
