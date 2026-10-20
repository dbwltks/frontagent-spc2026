import { NextRequest, NextResponse } from "next/server";
import { OrganizationAccessError, resolvePublicOrganization } from "../../../lib/org/resolveOrganization";
import { runTurn } from "../../../lib/ai/turnEngine";
import { createSseResponse } from "../../../lib/sse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const organizationId = typeof body?.organization_id === "string" ? body.organization_id : null;
  const sessionId = typeof body?.session_id === "string" ? body.session_id : null;
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const channel = typeof body?.channel === "string" ? body.channel : "web_chat";

  if (!organizationId || !sessionId || !message) {
    return NextResponse.json({ error: "organization_id, session_id, message가 필요합니다." }, { status: 400 });
  }

  try {
    await resolvePublicOrganization(organizationId);
  } catch (err) {
    if (err instanceof OrganizationAccessError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }

  return createSseResponse(async (send, signal) => {
    for await (const event of runTurn({ organizationId, sessionId, channel, userMessage: message, signal })) {
      switch (event.type) {
        case "trace":
          send("trace", { step: event.step, detail: event.detail });
          break;
        case "knowledge_start":
          send("knowledge_start", { queries: event.queries });
          break;
        case "delta":
          send("delta", { delta: event.text });
          break;
        case "ai_disabled":
          send("ai_disabled", { message: event.message });
          break;
        case "error":
          send("error", { message: event.message });
          break;
        case "done":
          send("result", {
            message: event.answer,
            conversation_id: event.conversationId,
            should_end_session: event.shouldEndSession,
          });
          break;
      }
    }
  }, { signal: request.signal });
}
