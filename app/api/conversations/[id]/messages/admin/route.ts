import { NextRequest } from "next/server";
import { HttpError, must, runAdmin } from "../../../../../../lib/org/adminRoute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return runAdmin(request, async ({ organizationId, supabase, body }) => {
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message) throw new HttpError("message가 필요합니다.");

    const inserted = await supabase
      .from("conversation_messages")
      .insert({
        organization_id: organizationId,
        conversation_id: id,
        sender_type: "admin",
        sender_name: body.sender_name ?? "관리자",
        message,
      })
      .select("*")
      .single();
    const row = must(inserted);

    await supabase
      .from("conversations")
      .update({ last_message: message, last_message_at: new Date().toISOString() })
      .eq("id", id)
      .eq("organization_id", organizationId);

    return row;
  });
}
