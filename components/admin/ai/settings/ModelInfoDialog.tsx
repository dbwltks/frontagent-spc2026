"use client";

import { Info } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogBody, DialogHeader } from "@/components/ui/Dialog";
import {
  estimateTurnCostUsd,
  LLM_MODEL_INFO,
  STT_MODEL_INFO,
  TTS_MODEL_INFO,
  TURN_INPUT_TOKENS,
  TURN_OUTPUT_TOKENS,
  type ModelGroup,
  type ModelInfo,
} from "../../../../lib/ai/modelCatalog";

function formatUsd(value: number) {
  if (value < 0.01) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(2)}`;
}

function ModelRow({ model, active, extra }: { model: ModelInfo; active: boolean; extra?: string }) {
  return (
    <div className={`rounded-[18px] p-4 ${active ? "bg-blue-50 ring-1 ring-blue-200" : "bg-[#f7f7f7]"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[14px] font-extrabold text-gray-900">{model.name}</span>
        <span className="font-mono text-[11px] font-bold text-gray-400">{model.id}</span>
        {model.recommended && (
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-bold text-green-700">추천</span>
        )}
        {active && (
          <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[11px] font-bold text-white">사용 중</span>
        )}
      </div>
      <p className="mt-1.5 text-[13px] font-semibold leading-relaxed text-gray-600">{model.summary}</p>
      <dl className="mt-3 grid gap-x-4 gap-y-1 text-[12px] font-bold sm:grid-cols-[auto_1fr]">
        <dt className="text-gray-400">가격</dt>
        <dd className="text-gray-800">{model.price}</dd>
        <dt className="text-gray-400">속도</dt>
        <dd className="text-gray-800">{model.speed}</dd>
        {extra && (
          <>
            <dt className="text-gray-400">상담 1턴</dt>
            <dd className="text-gray-800">{extra}</dd>
          </>
        )}
      </dl>
    </div>
  );
}

function Groups({ groups, activeIds }: { groups: ModelGroup[]; activeIds: string[] }) {
  return (
    <>
      {groups.map((group) => (
        <section key={group.title} className="space-y-3">
          <div>
            <h3 className="text-[14px] font-extrabold text-gray-900">{group.title}</h3>
            {group.note && <p className="mt-0.5 text-[12px] font-semibold text-gray-400">{group.note}</p>}
          </div>
          {group.models.map((model) => (
            <ModelRow key={model.id} model={model} active={activeIds.includes(model.id)} />
          ))}
        </section>
      ))}
    </>
  );
}

// 카드 제목 옆의 "모델 비교" 버튼 + 가격/속도 안내 창. 읽기 전용이라 선택은 기존 드롭다운에서 한다.
export function ModelInfoButton({
  kind,
  activeIds,
}: {
  kind: "llm" | "voice";
  activeIds: string[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Info className="h-3.5 w-3.5" />
        모델 비교
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} size="lg">
        <DialogHeader
          title={kind === "llm" ? "응답 모델 비교" : "음성 모델 비교 (STT · TTS)"}
          description={
            kind === "llm"
              ? `상담 1턴은 입력 ${TURN_INPUT_TOKENS.toLocaleString()}토큰 · 출력 ${TURN_OUTPUT_TOKENS}토큰으로 가정한 예상 비용입니다.`
              : "가격은 공급사 공식 가격표, 속도는 이 프로젝트에서 직접 호출해 잰 값입니다. 실제 환경에서는 달라질 수 있습니다."
          }
          onClose={() => setOpen(false)}
        />
        <DialogBody className="max-h-[70vh] space-y-5 overflow-y-auto pr-1">
          {kind === "llm" ? (
            <div className="space-y-3">
              {LLM_MODEL_INFO.map((model) => (
                <ModelRow
                  key={model.id}
                  model={model}
                  active={activeIds.includes(model.id)}
                  extra={`약 ${formatUsd(estimateTurnCostUsd(model))}`}
                />
              ))}
            </div>
          ) : (
            <>
              <div className="space-y-5">
                <h2 className="text-[13px] font-extrabold text-blue-600">STT (음성 → 텍스트)</h2>
                <Groups groups={STT_MODEL_INFO} activeIds={activeIds} />
              </div>
              <div className="space-y-5">
                <h2 className="text-[13px] font-extrabold text-blue-600">TTS (텍스트 → 음성)</h2>
                <Groups groups={TTS_MODEL_INFO} activeIds={activeIds} />
              </div>
            </>
          )}
        </DialogBody>
      </Dialog>
    </>
  );
}
