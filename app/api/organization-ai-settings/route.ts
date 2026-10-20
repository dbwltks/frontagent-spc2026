import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "../../../lib/supabase/service";
import { OrganizationAccessError, resolveAdminOrganization } from "../../../lib/org/resolveOrganization";
import {
  DEFAULT_ORGANIZATION_AI_SETTINGS,
  SETTINGS_OPTIONS,
  sanitizeSettingsPatch,
} from "../../../lib/ai/settingsOptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function loadOrCreateSettings(organizationId: string) {
  const supabase = createSupabaseServiceClient();

  const { data: existing, error } = await supabase
    .from("organization_ai_settings")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw error;
  if (existing) return existing;

  // 아직 조직에 설정 row가 없으면(구 파이썬 스키마 마이그레이션 전 생성된 조직 등)
  // 기본값(ElevenLabs TTS, pipeline 모드)으로 하나 만들어 응답한다.
  const { data: created, error: insertError } = await supabase
    .from("organization_ai_settings")
    .insert({ organization_id: organizationId, ...DEFAULT_ORGANIZATION_AI_SETTINGS })
    .select("*")
    .single();
  if (insertError) throw insertError;
  return created;
}

export async function GET(request: NextRequest) {
  const organizationId = request.nextUrl.searchParams.get("organization_id");
  if (!organizationId) {
    return NextResponse.json({ error: "organization_id가 필요합니다." }, { status: 400 });
  }

  try {
    await resolveAdminOrganization(organizationId);
    const settings = await loadOrCreateSettings(organizationId);
    return NextResponse.json({ settings, options: SETTINGS_OPTIONS });
  } catch (err) {
    if (err instanceof OrganizationAccessError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const organizationId = request.nextUrl.searchParams.get("organization_id");
  if (!organizationId) {
    return NextResponse.json({ error: "organization_id가 필요합니다." }, { status: 400 });
  }

  try {
    await resolveAdminOrganization(organizationId);
    await loadOrCreateSettings(organizationId); // row가 없으면 먼저 만들어둔다

    const body = await request.json();
    const patch = sanitizeSettingsPatch(body);

    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("organization_ai_settings")
      .update(patch)
      .eq("organization_id", organizationId)
      .select("*")
      .single();
    if (error) throw error;

    return NextResponse.json({ settings: data, options: SETTINGS_OPTIONS });
  } catch (err) {
    if (err instanceof OrganizationAccessError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
