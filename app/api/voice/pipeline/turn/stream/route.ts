import { NextRequest, NextResponse } from "next/server";
import { OrganizationAccessError, resolvePublicOrganization } from "../../../../../../lib/org/resolveOrganization";
import { looksLikeHallucination, transcribeAudio } from "../../../../../../lib/ai/stt";
import { runTurn } from "../../../../../../lib/ai/turnEngine";
import { createSseResponse } from "../../../../../../lib/sse";
import { ClauseSplitter, getCachedFillerAudio, synthesizeSpeech } from "../../../../../../lib/ai/tts";
import { createSupabaseServiceClient } from "../../../../../../lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const organizationIdRaw = formData.get("organization_id");
  const sessionIdRaw = formData.get("session_id");
  const audio = formData.get("audio");
  const transcriptRaw = formData.get("transcript");
  const organizationId = typeof organizationIdRaw === "string" ? organizationIdRaw : null;
  const sessionId = typeof sessionIdRaw === "string" ? sessionIdRaw : null;
  // 스트리밍 STT 모드에서는 브라우저가 Deepgram으로 이미 직접 전사를 끝내고
  // 그 결과 텍스트만 보낸다 — 이때는 audio 없이 transcript로 바로 들어온다.
  const clientTranscript = typeof transcriptRaw === "string" ? transcriptRaw.trim() : null;

  if (!organizationId || !sessionId || (!(audio instanceof File) && !clientTranscript)) {
    return NextResponse.json({ error: "organization_id, session_id와 (audio 또는 transcript)가 필요합니다." }, { status: 400 });
  }

  try {
    await resolvePublicOrganization(organizationId);

    const supabase = createSupabaseServiceClient();
    const { data: settings } = await supabase
      .from("organization_ai_settings")
      .select("elevenlabs_voice_id, elevenlabs_model, voice_stt_model")
      .eq("organization_id", organizationId)
      .maybeSingle();

    const voiceId = settings?.elevenlabs_voice_id ?? process.env.ELEVENLABS_VOICE_ID ?? null;
    const elevenlabsModel = settings?.elevenlabs_model ?? undefined;

    // SSE를 열기 전에 STT를 동기로 끝낸다 — 무음이면 순수 422 JSON(기존 계약)으로
    // 응답하고, 말이 있으면 그때 SSE를 열어 turn_start/transcript를 바로 보낸다.
    // transcript가 이미 왔으면(스트리밍 STT 모드) 이 구간 자체가 통째로 생략된다.
    const sttStartedAt = Date.now();
    const transcript = clientTranscript ?? (await transcribeAudio(audio as File, settings?.voice_stt_model ?? undefined)).text;
    const sttElapsedMs = Date.now() - sttStartedAt;

    if (!transcript || looksLikeHallucination(transcript)) {
      return NextResponse.json({ error: "음성이 감지되지 않았습니다. 마이크 가까이에서 1초 이상 말씀해 주세요." }, { status: 422 });
    }

    return createSseResponse(
      async (send, signal) => {
        send("turn_start", { elapsed_ms: 0 });
        send("transcript", { text: transcript, elapsed_ms: sttElapsedMs });

        const clauseSplitter = new ClauseSplitter();
        let audioIndex = 0;

        // STT는 끝났지만 LLM+RAG+TTS 처리가 아직 남은 구간(수 초)을 가리는
        // 필러 음성 — 캐싱돼 있어서 사실상 즉시 나간다. 실제 지연을 줄이는 게
        // 아니라 "듣고 있다"는 반응을 바로 줘서 체감 지연을 없애는 트릭이다.
        if (voiceId) {
          try {
            const { audio: fillerBuf, contentType: fillerType } = await getCachedFillerAudio(voiceId, elevenlabsModel, "네, 확인해볼게요.");
            if (!signal.aborted) {
              send("audio", { audio_base64: fillerBuf.toString("base64"), content_type: fillerType, index: audioIndex });
              audioIndex += 1;
            }
          } catch (err) {
            console.error("필러 음성 실패:", err);
          }
        }

        const speakClause = async (clause: string) => {
          if (!voiceId || signal.aborted || !clause.trim()) return;
          try {
            const { audio: buf, contentType } = await synthesizeSpeech(clause, { voiceId, modelId: elevenlabsModel });
            if (signal.aborted) return;
            send("audio", { audio_base64: buf.toString("base64"), content_type: contentType, index: audioIndex });
            audioIndex += 1;
          } catch (err) {
            console.error("TTS 실패:", err);
          }
        };

        for await (const event of runTurn({ organizationId, sessionId, channel: "web_call", userMessage: transcript, signal })) {
          if (signal.aborted) return;
          switch (event.type) {
            case "trace":
              send("trace", { step: event.step, detail: event.detail });
              break;
            case "knowledge_start":
              send("knowledge_start", { queries: event.queries });
              break;
            case "delta": {
              send("delta", { delta: event.text });
              const clauses = clauseSplitter.push(event.text);
              for (const clause of clauses) await speakClause(clause);
              break;
            }
            case "ai_disabled":
              send("ai_disabled", { message: event.message });
              return;
            case "error":
              send("error", { message: event.message });
              return;
            case "done": {
              const rest = clauseSplitter.flush();
              if (rest) await speakClause(rest);
              send("audio_end", {});
              send("result", {
                transcript,
                answer: event.answer,
                should_end_session: event.shouldEndSession,
                conversation_id: event.conversationId,
              });
              break;
            }
          }
        }
      },
      { signal: request.signal },
    );
  } catch (err) {
    if (err instanceof OrganizationAccessError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
