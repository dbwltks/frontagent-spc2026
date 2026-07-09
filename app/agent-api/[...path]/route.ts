import { NextRequest } from "next/server";

const AGENT_BASE = process.env.AGENT_API_PROXY_TARGET?.trim() || "https://api.light-code.dev";

async function proxy(req: NextRequest, params: { path: string[] }) {
  const path = params.path.join("/");
  const search = req.nextUrl.search;
  const url = `${AGENT_BASE}/${path}${search}`;

  const reqHeaders = new Headers(req.headers);
  reqHeaders.delete("host");

  const hasBody = req.method !== "GET" && req.method !== "HEAD";

  const upstreamRes = await fetch(url, {
    method: req.method,
    headers: reqHeaders,
    body: hasBody ? req.body : undefined,
    // @ts-expect-error - Node.js fetch requires duplex for streaming body
    duplex: hasBody ? "half" : undefined,
  });

  const isSSE =
    upstreamRes.headers.get("content-type")?.includes("text/event-stream") ?? false;

  if (!isSSE || !upstreamRes.body) {
    return new Response(upstreamRes.body, {
      status: upstreamRes.status,
      headers: upstreamRes.headers,
    });
  }

  // SSE를 청크 단위로 즉시 전달 (Next.js rewrite는 버퍼링하므로 Route Handler로 우회)
  const upstreamReader = upstreamRes.body.getReader();
  const stream = new ReadableStream({
    async pull(controller) {
      try {
        const { done, value } = await upstreamReader.read();
        if (done) {
          controller.close();
        } else {
          controller.enqueue(value);
        }
      } catch (e) {
        controller.error(e);
      }
    },
    cancel() {
      upstreamReader.cancel();
    },
  });

  return new Response(stream, {
    status: upstreamRes.status,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      "X-Content-Type-Options": "nosniff",
      Connection: "keep-alive",
    },
  });
}

const handler = (req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) =>
  params.then((p) => proxy(req, p));

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;

export const dynamic = "force-dynamic";
