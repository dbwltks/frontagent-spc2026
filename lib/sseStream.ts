export interface SseEvent {
  event: string;
  data: Record<string, unknown>;
}

/** SSE 응답 body를 이벤트 단위로 파싱하는 async generator */
export async function* parseSseStream(body: ReadableStream<Uint8Array>): AsyncGenerator<SseEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const parseBlock = (raw: string): SseEvent | null => {
    const lines = raw.split(/\r?\n/);
    const eventName = lines.find((l) => l.startsWith("event:"))?.slice(6).trim() ?? "message";
    const payload = lines
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trimStart())
      .join("\n");
    if (!payload) return null;
    try {
      return { event: eventName, data: JSON.parse(payload) as Record<string, unknown> };
    } catch {
      return null;
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = blocks.pop() ?? "";
      for (const block of blocks) {
        const ev = parseBlock(block);
        if (ev) yield ev;
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) {
      const ev = parseBlock(buffer);
      if (ev) yield ev;
    }
  } finally {
    reader.releaseLock();
  }
}
