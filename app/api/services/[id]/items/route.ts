import { NextRequest } from "next/server";
import { HttpError, must, runAdmin } from "../../../../../lib/org/adminRoute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  return runAdmin(request, async ({ organizationId, supabase }) => {
    const { data, error } = await supabase
      .from("service_items")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("service_id", id)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return { items: data ?? [] };
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  return runAdmin(request, async ({ organizationId, supabase, body }) => {
    if (typeof body.name !== "string" || !body.name.trim()) throw new HttpError("name이 필요합니다.");
    const result = await supabase
      .from("service_items")
      .insert({
        organization_id: organizationId,
        service_id: id,
        name: body.name.trim(),
        description: body.description ?? null,
        base_price: body.base_price ?? 0,
        duration_minutes: body.duration_minutes ?? 60,
        is_available: body.is_available ?? true,
      })
      .select("*")
      .single();
    return { item: must(result) };
  });
}
