/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from "next/server";
import { HttpError, must, runAdmin } from "../../../../../lib/org/adminRoute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: NextRequest) {
  return runAdmin(request, async ({ organizationId, supabase, body }) => {
    const itemId = body.service_item_id;
    const optionIds: string[] = Array.isArray(body.option_ids) ? body.option_ids : [];
    if (typeof itemId !== "string") throw new HttpError("service_item_id가 필요합니다.");

    const item = must(
      await supabase.from("service_items").select("*").eq("id", itemId).eq("organization_id", organizationId).maybeSingle(),
      "서비스 아이템을 찾을 수 없습니다.",
    );
    let options: Array<Record<string, any>> = [];
    if (optionIds.length) {
      const { data, error } = await supabase
        .from("service_item_options")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("service_item_id", itemId)
        .in("id", optionIds);
      if (error) throw error;
      options = data ?? [];
    }

    const basePrice = Number(item.base_price ?? 0);
    const baseDuration = Number(item.duration_minutes ?? 0);
    const optionsPrice = options.reduce((s, o) => s + Number(o.additional_price ?? 0), 0);
    const optionsDuration = options.reduce((s, o) => s + Number(o.additional_duration ?? 0), 0);

    return {
      organization_id: organizationId,
      service_item_id: itemId,
      option_ids: options.map((o) => o.id),
      base_price: basePrice,
      options_price: optionsPrice,
      total_price: basePrice + optionsPrice,
      base_duration_minutes: baseDuration,
      options_duration_minutes: optionsDuration,
      total_duration_minutes: baseDuration + optionsDuration,
      ordered_summary: {
        item: item.name,
        options: options.map((o) => ({ group: o.option_group, value: o.option_value, price: o.additional_price })),
      },
    };
  });
}
