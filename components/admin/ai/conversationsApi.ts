import { getAgentApiBaseUrl, readAgentApiError } from "../../../lib/agentApiBase";
import type { ConversationMessage } from "./types";

type ConversationMessageRecord = {
  id: string;
  organization_id: string;
  conversation_id: string;
  sender_type: string;
  sender_name?: string | null;
  message: string;
  metadata?: Record<string, unknown>;
  created_at?: string | null;
};

export function parseUtcTimestamp(value: string) {
  const hasTimezone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(value);
  return new Date(hasTimezone ? value : `${value}Z`);
}

function formatAgentBrandText(text: string) {
  return text.replace(/\bfront agent\b/gi, "Callbee").replace(/\balf voice\b/gi, "Callbee");
}

function normalizeAgentSenderName(
  senderName: string | null | undefined,
  senderType: string,
) {
  if (senderType === "admin") return senderName ?? "관리자";
  if (senderType === "customer") return senderName;
  if (!senderName || /^front agent$/i.test(senderName.trim()) || /^alf voice$/i.test(senderName.trim())) {
    return "Callbee";
  }
  return formatAgentBrandText(senderName);
}

function mapMessageRecord(record: ConversationMessageRecord): ConversationMessage {
  return {
    id: record.id,
    conversationId: record.conversation_id,
    senderType: record.sender_type as ConversationMessage["senderType"],
    senderName: normalizeAgentSenderName(record.sender_name, record.sender_type),
    message: formatAgentBrandText(record.message),
    createdAt: record.created_at,
  };
}

export async function fetchConversationMessages(organizationId: string, conversationId: string) {
  const response = await fetch(
    `${getAgentApiBaseUrl()}/conversations/${encodeURIComponent(conversationId)}/messages?organization_id=${encodeURIComponent(organizationId)}`,
  );

  if (!response.ok) {
    throw new Error(await readAgentApiError(response));
  }

  const payload = (await response.json()) as { items?: ConversationMessageRecord[] };
  return (payload.items ?? []).map(mapMessageRecord);
}
