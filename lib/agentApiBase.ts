// 백엔드는 Next Route Handler(app/api/*)로 통합됐으므로 기본값은 같은 도메인의 /api다.
// 별도 서버를 붙이고 싶을 때만 NEXT_PUBLIC_AGENT_API_URL로 덮어쓴다.
const DEFAULT_AGENT_API_URL = "/api";

export function getAgentApiBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_AGENT_API_URL?.trim().replace(/\/$/, "");
  // /agent-api는 폐기된 Python 백엔드 프록시 경로라서, 환경변수에 남아 있어도 /api로 돌린다.
  if (!configured || configured === "/agent-api") return DEFAULT_AGENT_API_URL;
  return configured;
}

export async function readAgentApiJson<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error(
      `API가 JSON 대신 HTML을 반환했습니다 (${response.url}). NEXT_PUBLIC_AGENT_API_URL이 /api 또는 올바른 API 주소인지 확인해 주세요.`,
    );
  }

  return (await response.json()) as T;
}

export async function readAgentApiError(response: Response) {
  const fallback = `HTTP ${response.status}`;

  // body는 한 번만 읽을 수 있으므로 text로 먼저 읽고 JSON 파싱을 시도한다.
  let text = "";
  try {
    text = await response.text();
  } catch {
    return fallback;
  }
  if (!text) return fallback;

  try {
    const payload = JSON.parse(text) as { detail?: unknown; message?: unknown; error?: unknown };
    const detail = payload.detail ?? payload.message ?? payload.error;

    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) return detail.map((item) => JSON.stringify(item)).join(", ");
    if (detail) return JSON.stringify(detail);
    return fallback;
  } catch {
    // JSON이 아닌 응답(HTML 에러 페이지 등)은 앞부분만 보여준다.
    return `${fallback}: ${text.replace(/\s+/g, " ").slice(0, 200)}`;
  }
}
