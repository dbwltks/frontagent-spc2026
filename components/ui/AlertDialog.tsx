"use client";

import * as Radix from "@radix-ui/react-alert-dialog";
import type { ReactNode } from "react";

export function AlertDialog({
  trigger,
  title,
  description,
  confirmLabel = "확인",
  cancelLabel = "취소",
  variant = "danger",
  onConfirm,
}: {
  trigger: ReactNode;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "dark";
  onConfirm: () => void;
}) {
  return (
    <Radix.Root>
      <Radix.Trigger asChild>{trigger}</Radix.Trigger>
      <Radix.Portal>
        <Radix.Overlay className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-[2px]" />
        <Radix.Content className="fixed left-1/2 top-1/2 z-[200] w-[90vw] max-w-[380px] -translate-x-1/2 -translate-y-1/2 rounded-[20px] bg-white shadow-[0_8px_40px_rgba(0,0,0,0.15)]">
          <div className="px-6 pt-6 pb-2">
            <Radix.Title className="text-[18px] font-bold leading-tight text-gray-900">
              {title}
            </Radix.Title>
            {description && (
              <Radix.Description className="mt-2 text-[14px] leading-relaxed text-gray-500">
                {description}
              </Radix.Description>
            )}
          </div>
          <div className="px-6 pt-4 pb-6 flex gap-2.5">
            <Radix.Cancel className="flex-1 rounded-[12px] bg-gray-100 py-3.5 text-[15px] font-bold text-gray-700 transition-colors hover:bg-gray-200">
              {cancelLabel}
            </Radix.Cancel>
            <Radix.Action
              onClick={onConfirm}
              className={`flex-1 rounded-[12px] py-3.5 text-[15px] font-bold transition-colors ${
                variant === "danger"
                  ? "bg-red-500 text-white hover:bg-red-600"
                  : "bg-gray-900 text-white hover:bg-gray-800"
              }`}
            >
              {confirmLabel}
            </Radix.Action>
          </div>
        </Radix.Content>
      </Radix.Portal>
    </Radix.Root>
  );
}
