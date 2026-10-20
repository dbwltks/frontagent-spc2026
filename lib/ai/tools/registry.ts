import { tool } from "ai";
import { z } from "zod";
import { searchKnowledge } from "../embeddings";
import { buildStartTaskFlowTool } from "../taskFlowCompiler";
import { checkAvailability, createReservation } from "./functionRegistry";

type BuildToolsOptions = {
  organizationId: string;
  sessionId: string;
  conversationId?: string | null;
};

// search_knowledge/check_availability/create_reservation은 고정 tool로 항상 제공하고,
// start_task_flow는 조직에 활성화된 태스크플로우가 있을 때만 동적으로 추가한다
// (없으면 LLM에게 존재하지 않는 도구를 보여줄 이유가 없다).
export async function buildTools({ organizationId, sessionId, conversationId }: BuildToolsOptions) {
  const search_knowledge = tool({
    description: "고객 질문에 답하는 데 필요한 정보를 지식베이스(FAQ, 정책, 서비스 안내 등)에서 검색한다.",
    inputSchema: z.object({
      query: z.string().describe("검색할 질문/키워드"),
    }),
    execute: async ({ query }) => {
      const matches = await searchKnowledge(organizationId, query, { matchCount: 5 });
      return {
        results: matches.map((m) => ({ content: m.content, metadata: m.metadata })),
      };
    },
  });

  const check_availability = tool({
    description: "특정 서비스의 특정 시간대가 예약 가능한지 확인한다. 예약을 만들기 전에 반드시 먼저 호출한다.",
    inputSchema: z.object({
      serviceId: z.string().uuid().nullable().describe("서비스 ID (모르면 null)"),
      startAt: z.string().describe("예약 시작 시각, ISO 8601"),
      endAt: z.string().describe("예약 종료 시각, ISO 8601"),
    }),
    execute: ({ serviceId, startAt, endAt }) => checkAvailability(organizationId, { serviceId, startAt, endAt }),
  });

  const create_reservation = tool({
    description: "고객 예약을 실제로 생성한다. check_availability로 가능 여부를 확인한 뒤에만 호출한다.",
    inputSchema: z.object({
      serviceId: z.string().uuid().nullable(),
      customerName: z.string().describe("예약자 이름"),
      customerPhone: z.string().nullable(),
      startAt: z.string().describe("예약 시작 시각, ISO 8601"),
      endAt: z.string().describe("예약 종료 시각, ISO 8601"),
      memo: z.string().nullable(),
    }),
    execute: ({ serviceId, customerName, customerPhone, startAt, endAt, memo }) =>
      createReservation(organizationId, { serviceId, customerName, customerPhone, startAt, endAt, memo, conversationId }),
  });

  const start_task_flow = await buildStartTaskFlowTool(organizationId, sessionId);

  return {
    search_knowledge,
    check_availability,
    create_reservation,
    ...(start_task_flow ? { start_task_flow } : {}),
  };
}
