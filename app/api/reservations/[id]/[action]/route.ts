import { NextRequest } from "next/server";
import { HttpError, must, runAdmin } from "../../../../../lib/org/adminRoute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIONS: Record<string, { status: string; stamp: "confirmed_at" | "cancelled_at" }> = {
  confirm: { status: "confirmed", stamp: "confirmed_at" },
  reject: { status: "rejected", stamp: "cancelled_at" },
  cancel: { status: "cancelled", stamp: "cancelled_at" },
};

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; action: string }> }) {
  const { id, action } = await params;
  const spec = ACTIONS[action];
  return runAdmin(request, async ({ organizationId, supabase }) => {
    if (!spec) throw new HttpError("지원하지 않는 작업입니다.", 404);
    const now = new Date().toISOString();
    const result = await supabase
      .from("reservations")
      .update({ status: spec.status, [spec.stamp]: now, updated_at: now })
      .eq("id", id)
      .eq("organization_id", organizationId)
      .select("*")
      .maybeSingle();
    return { reservation: must(result, "예약을 찾을 수 없습니다.") };
  });
}
