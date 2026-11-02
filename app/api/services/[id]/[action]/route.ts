import { NextRequest } from "next/server";
import { HttpError, must, pick, runAdmin } from "../../../../../lib/org/adminRoute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FIELDS = ["name", "description", "price", "duration_minutes"];

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; action: string }> }) {
  const { id, action } = await params;
  return runAdmin(request, async ({ organizationId, supabase, body }) => {
    const now = new Date().toISOString();
    const current = must(
      await supabase.from("services").select("*").eq("id", id).eq("organization_id", organizationId).maybeSingle(),
      "서비스를 찾을 수 없습니다.",
    );

    let patch: Record<string, unknown>;
    switch (action) {
      case "approve":
        patch = {
          ...pick(body, [...FIELDS, "is_active"]),
          approval_status: "approved",
          sync_status: "synced",
          approved_at: now,
          pending_payload: null,
          rejected_reason: null,
        };
        if (patch.is_active === undefined) patch.is_active = true;
        break;
      case "reject":
        patch = { approval_status: "rejected", is_active: false, rejected_reason: body.reason ?? null };
        break;
      case "apply-pending": {
        const pending = (current.pending_payload ?? {}) as Record<string, unknown>;
        patch = { ...pick(pending, FIELDS), ...pick(body, FIELDS), pending_payload: null, sync_status: "synced", approved_at: now };
        break;
      }
      case "ignore-pending":
        patch = { pending_payload: null, sync_status: "synced" };
        break;
      case "deactivate":
        patch = { is_active: false, is_reservable: false };
        break;
      default:
        throw new HttpError("지원하지 않는 작업입니다.", 404);
    }

    const updated = await supabase
      .from("services")
      .update({ ...patch, updated_at: now })
      .eq("id", id)
      .eq("organization_id", organizationId)
      .select("*")
      .single();
    return { ok: true, service: must(updated) };
  });
}
