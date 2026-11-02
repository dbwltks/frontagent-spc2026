import { NextRequest } from "next/server";
import { HttpError, must, runAdmin } from "../../../../../../lib/org/adminRoute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ itemId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { itemId } = await params;
  return runAdmin(request, async ({ organizationId, supabase }) => {
    const { data, error } = await supabase
      .from("service_item_options")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("service_item_id", itemId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return { items: data ?? [] };
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  const { itemId } = await params;
  return runAdmin(request, async ({ organizationId, supabase, body }) => {
    if (typeof body.option_value !== "string" || !body.option_value.trim()) throw new HttpError("option_value가 필요합니다.");
    const result = await supabase
      .from("service_item_options")
      .insert({
        organization_id: organizationId,
        service_item_id: itemId,
        option_group: body.option_group ?? "옵션",
        option_value: body.option_value.trim(),
        description: body.description ?? null,
        additional_price: body.additional_price ?? 0,
        additional_duration: body.additional_duration ?? 0,
        is_available: body.is_available ?? true,
      })
      .select("*")
      .single();
    return { option: must(result) };
  });
}
