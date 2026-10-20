// lib/sseStream.ts(파서)와 정확히 맞는 서버 쪽 SSE writer.
// 각 이벤트는 "event: <name>\ndata: <json>\n\n" 블록으로 인코딩한다.
export function createSseResponse(
  producer: (send: (event: string, data: unknown) => void, signal: AbortSignal) => Promise<void>,
  { signal }: { signal?: AbortSignal } = {},
): Response {
  const encoder = new TextEncoder();
  const controller = new AbortController();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(streamController) {
      const send = (event: string, data: unknown) => {
        if (controller.signal.aborted) return;
        const block = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        streamController.enqueue(encoder.encode(block));
      };

      try {
        await producer(send, controller.signal);
      } catch (err) {
        if (!controller.signal.aborted) {
          send("error", { message: err instanceof Error ? err.message : String(err) });
        }
      } finally {
        try {
          streamController.close();
        } catch {
          // 이미 abort로 닫혔으면 무시
        }
      }
    },
    cancel() {
      controller.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
