import { NextRequest } from "next/server";
import { must, pick, runAdmin } from "../../../../lib/org/adminRoute";
import type { createSupabaseServiceClient } from "../../../../lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ orgId: string }> };

const DEFAULT_WEEKLY_HOURS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((day) => ({
  day,
  enabled: day !== "sat" && day !== "sun",
  start: "09:00",
  end: "18:00",
}));

async function loadOrCreate(supabase: ReturnType<typeof createSupabaseServiceClient>, organizationId: string) {
  const { data, error } = await supabase
    .from("booking_settings")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw error;
  if (data) return data;
  return must(
    await supabase
      .from("booking_settings")
      .insert({ organization_id: organizationId, weekly_hours: DEFAULT_WEEKLY_HOURS })
      .select("*")
      .single(),
  );
}

export async function GET(request: NextRequest, { params }: Params) {
  const { orgId } = await params;
  return runAdmin(request, ({ organizationId, supabase }) => loadOrCreate(supabase, organizationId), {
    organizationId: orgId,
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { orgId } = await params;
  return runAdmin(
    request,
    async ({ organizationId, supabase, body }) => {
      await loadOrCreate(supabase, organizationId);
      const result = await supabase
        .from("booking_settings")
        .update({
          ...pick(body, [
            "name", "timezone", "slot_interval_minutes", "min_notice_minutes", "max_days_ahead",
            "requires_approval", "allow_customer_cancel", "is_active", "weekly_hours", "exceptions",
          ]),
          updated_at: new Date().toISOString(),
        })
        .eq("organization_id", organizationId)
        .select("*")
        .single();
      return must(result);
    },
    { organizationId: orgId },
  );
}
