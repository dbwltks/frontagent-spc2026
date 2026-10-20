import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "../../../../../lib/supabase/service";
import { OrganizationAccessError, resolvePublicOrganization } from "../../../../../lib/org/resolveOrganization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: conversationId } = await params;
  const organizationId = request.nextUrl.searchParams.get("organization_id");

  if (!organizationId) {
    return NextResponse.json({ error: "organization_id가 필요합니다." }, { status: 400 });
  }

  try {
    await resolvePublicOrganization(organizationId);
  } catch (err) {
    if (err instanceof OrganizationAccessError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("conversation_messages")
    .select("id, sender_type, sender_name, message, created_at")
    .eq("organization_id", organizationId)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ items: data ?? [] });
}
