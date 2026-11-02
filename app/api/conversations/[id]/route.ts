import { NextRequest } from "next/server";
import { runAdmin } from "../../../../lib/org/adminRoute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return runAdmin(request, async ({ organizationId, supabase }) => {
    // 메시지를 먼저 지운 뒤 대화를 지운다(FK가 cascade가 아닐 수 있다).
    await supabase.from("conversation_messages").delete().eq("conversation_id", id).eq("organization_id", organizationId);
    const { error } = await supabase.from("conversations").delete().eq("id", id).eq("organization_id", organizationId);
    if (error) throw error;
    return { ok: true, conversation_id: id };
  });
}
