import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "../../../../lib/supabase/service";
import { OrganizationAccessError, resolvePublicOrganization } from "../../../../lib/org/resolveOrganization";
import { synthesizeSpeech } from "../../../../lib/ai/tts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const organizationId = typeof body?.organization_id === "string" ? body.organization_id : null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";

  if (!organizationId || !text) {
    return NextResponse.json({ error: "organization_id, text가 필요합니다." }, { status: 400 });
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
  const { data: settings } = await supabase
    .from("organization_ai_settings")
    .select("elevenlabs_voice_id, elevenlabs_model")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!settings?.elevenlabs_voice_id) {
    return NextResponse.json({ error: "이 조직에 ElevenLabs voice_id가 설정되지 않았습니다." }, { status: 500 });
  }

  try {
    const { audio, contentType } = await synthesizeSpeech(text, {
      voiceId: settings.elevenlabs_voice_id,
      modelId: settings.elevenlabs_model ?? undefined,
    });
    return new Response(new Uint8Array(audio), { headers: { "Content-Type": contentType } });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
