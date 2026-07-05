"use client";

import type { User } from "@supabase/supabase-js";
import { MoreVertical } from "lucide-react";
import { useState } from "react";
import { Dropdown } from "@/components/ui/Dropdown";
import { getOrganizationId } from "../../../lib/organization";
import { deleteConversation } from "./conversationsApi";

export function ConversationHistoryMenu({
  conversationId,
  user,
  historyLabel,
  onDeleted,
}: {
  conversationId: string;
  user: User;
  historyLabel: string;
  onDeleted: () => void;
}) {
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    if (
      !window.confirm(
        `${historyLabel}을(를) 삭제하시겠습니까?\n삭제된 내역은 복구할 수 없습니다.`,
      )
    ) {
      return;
    }

    setIsDeleting(true);
    try {
      const organizationId = getOrganizationId(user);
      await deleteConversation(organizationId, conversationId);
      onDeleted();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "삭제에 실패했습니다.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Dropdown
      align="end"
      trigger={
        <button
          type="button"
          disabled={isDeleting}
          aria-label="더보기"
          className="rounded-full p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-40"
        >
          <MoreVertical className="h-5 w-5" />
        </button>
      }
      items={[
        {
          label: historyLabel,
          onClick: handleDelete,
          icon: "delete",
          variant: "danger",
        },
      ]}
    />
  );
}
