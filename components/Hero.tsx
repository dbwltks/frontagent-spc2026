"use client";

import { useEffect, useState } from "react";
import {
  Bot,
  Phone,
  type LucideIcon,
} from "lucide-react";
import HeroGradient from "./HeroGradient";

const avatarClass =
  "flex h-[44px] w-[44px] items-center justify-center overflow-hidden rounded-full text-[20px] leading-[1] sm:h-[64px] sm:w-[64px] sm:text-[30px]";
const heroTextAreaClass =
  "mx-auto flex min-h-0 w-full max-w-[1600px] items-center justify-center gap-0 px-[24px]";
const heroCenterClass =
  "flex w-full items-center justify-center bg-white [font-family:'Pretendard',-apple-system,sans-serif]";
const heroInnerClass =
  "mt-[160px] max-[600px]:mt-[100px] flex w-full min-w-0 max-w-[1600px] flex-col items-center text-center";
const headlineClass =
  "m-0 w-full max-w-[1600px] text-center text-[clamp(42px,6.4vw,78px)] font-bold leading-[1.22] tracking-[-0.03em] text-[#191919] [overflow-wrap:break-word] [word-break:keep-all] max-[600px]:text-[38px] max-[600px]:leading-[1.24]";
const headlinePillClass =
  "mx-[6px] inline-flex items-center justify-center gap-[5px] rounded-full bg-[#d3e4f7] px-[0.16em] pt-[0.06em] pb-[0.1em] align-middle font-extrabold leading-[1.08] text-[#191919]";
const subheadlineClass =
  "mt-[28px] mb-[20px] text-[20px] font-medium tracking-[-0.01em] text-[#5c5c5c] max-[600px]:text-[14px]";
const uiGradientInnerClass = "w-full rounded-[48px]";
const uiPreviewWrapClass =
  "mx-auto flex w-full max-w-[500px] max-[640px]:max-w-none flex-col items-center gap-[22px] max-[640px]:gap-4";
const urlBarClass =
  "flex w-[72%] max-[640px]:w-[68%] items-center justify-center gap-[10px] rounded-full border border-[rgba(255,255,255,0.6)] bg-[rgba(255,255,255,0.45)] px-[28px] py-[20px] shadow-[0_4px_18px_rgba(80,120,60,0.12)] backdrop-blur-[8px] max-[640px]:px-5 max-[640px]:py-3.5";
const browserMockupClass =
  "w-full overflow-hidden rounded-t-[48px] border-[7px] border-b-0 border-[#1c2535] bg-white pb-2 shadow-[0_20px_50px_rgba(40,60,30,0.22)]";
const browserContentClass = "flex h-[420px] flex-col px-[10px] pt-[22px] pb-5";
const userMessageRowClass =
  "flex h-[64px] shrink-0 items-start justify-end px-[8px] pb-0";
const userBubbleClass =
  "max-w-[92%] overflow-hidden rounded-[18px_18px_4px_18px] bg-[var(--blue)] px-4 py-3 text-left text-[15px] font-medium text-white";
const aiReplyClass =
  "flex min-h-0 flex-1 flex-col items-start px-[8px] pt-[22px]";
const aiHeaderClass = "mb-2 flex shrink-0 items-center gap-2";
const aiBubbleClass =
  "min-h-[44px] w-fit max-w-[92%] rounded-[4px_18px_18px_18px] bg-[#eef0f2] px-4 py-3";
const answerTextClass =
  "m-0 text-left text-base font-medium leading-[1.7] text-[#2e2e2e]";
const ctaButtonClass =
  "cursor-pointer rounded-[10px] border-0 bg-[#c9d6f0] px-4 py-[11px] text-sm font-semibold text-[#2a3a66] transition-colors duration-150 hover:bg-[#b9c9ec]";
const typingDotClass =
  "h-2 w-2 rounded-full bg-[#9aa1ad] [animation:heroTypingDot_1.1s_ease-in-out_infinite]";

const TYPING_DELAY_MS = 500;
const ANSWER_LINE_DELAY_MS = 550;
const CTA_DELAY_MS = 450;
const HOLD_AFTER_DONE_MS = 1600;

const HERO_SCENARIOS = [
  {
    gradient:
      "linear-gradient(135deg, #38bdf8 0%, #a78bfa 30%, #fb923c 65%, #fbbf24 100%)",
    question: "에어컨에서 냄새 나는데 청소나 수리 가능한가요?",
    answer: [
      "네, 분해 청소와 가스 점검이 함께 진행되는 방문 서비스가 가능합니다.",
      "악취는 대부분 내부 곰팡이나 냄새로 분해 세척하면 해결돼요.",
      "가까운 날짜로 바로 예약해 드릴까요?",
    ],
    cta: "방문 청소 예약하기",
  },
  {
    gradient:
      "linear-gradient(135deg, #818cf8 0%, #a78bfa 30%, #f472b6 65%, #fb923c 100%)",
    question: "오늘 저녁 6시에 4명 예약되나요?",
    answer: [
      "네, 오늘 18시에 4인 테이블 예약 가능합니다.",
      "창가 자리로 안내드릴까요, 룸 자리도 비어 있어요.",
      "원하시는 자리 알려주시면 바로 확정해 드릴게요.",
    ],
    cta: "예약 확정하기",
  },
  {
    gradient:
      "linear-gradient(135deg, #22d3ee 0%, #818cf8 30%, #a78bfa 65%, #f0abfc 100%)",
    question: "이번 주말에 펌 하려는데 빈 시간 있나요?",
    answer: [
      "토요일은 오후 1시, 일요일은 오전 11시에 가능합니다.",
      "디자이너 지정도 가능하니 원하시는 분 말씀해 주세요.",
      "시술 시간은 약 2시간 정도 소요돼요.",
    ],
    cta: "예약 가능 시간 보기",
  },
];

type CartoonAvatarEntry = {
  label: string;
  imgSrc: string;
  className: string;
};

type ChannelAvatarEntry = {
  label: string;
  className: string;
  Icon: LucideIcon;
  color: string;
};

type HeroAvatarItem =
  | ({ kind: "cartoon" } & CartoonAvatarEntry)
  | ({ kind: "channel" } & ChannelAvatarEntry);

const heroAvatarNew: CartoonAvatarEntry = {
  label: "고객",
  imgSrc: "/hero/avatar-lorelei-happy.svg",
  className: "border-[3px] border-[#2383e2] bg-white",
};

const heroAvatarLoreleiNeutral: CartoonAvatarEntry = {
  label: "고객",
  imgSrc: "/hero/avatar-lorelei.svg",
  className: "border-[3px] border-[#10b981] bg-white",
};

const heroAvatarLoreleiFull: CartoonAvatarEntry = {
  label: "고객",
  imgSrc: "/hero/avatar-lorelei-full.svg",
  className: "border-[3px] border-[#2383e2] bg-white",
};

const heroAvatarCroodles: CartoonAvatarEntry = {
  label: "고객",
  imgSrc: "/hero/avatar-croodles.svg",
  className: "border-[3px] border-[#f59e0b] bg-white",
};

const heroAvatarAdventurer: CartoonAvatarEntry = {
  label: "고객",
  imgSrc: "/hero/avatar-adventurer.svg",
  className: "border-[3px] border-[#8b5cf6] bg-white",
};

const channelIconClass = "border-[3px] border-black bg-white";

const heroIconPhone: ChannelAvatarEntry = {
  label: "전화",
  className: channelIconClass,
  Icon: Phone,
  color: "#191919",
};

const heroIconBot: ChannelAvatarEntry = {
  label: "AI",
  className: channelIconClass,
  Icon: Bot,
  color: "#191919",
};

const HERO_AVATAR_ROW: HeroAvatarItem[] = [
  { kind: "cartoon", ...heroAvatarNew },
  { kind: "channel", ...heroIconPhone },
  { kind: "cartoon", ...heroAvatarLoreleiNeutral },
  { kind: "cartoon", ...heroAvatarLoreleiFull },
  { kind: "channel", ...heroIconBot },
  { kind: "cartoon", ...heroAvatarCroodles },
  { kind: "cartoon", ...heroAvatarAdventurer },
];

const CALL_BEE_FIXED_PREFIX = "C";
const CALL_BEE_REST = "all bee";
const TYPEWRITER_CHAR_MS = 140;
const TYPEWRITER_HOLD_MS = 2000;
const TYPEWRITER_ERASE_MS = 140;

function CallBeeTypewriter() {
  const [length, setLength] = useState(0);
  const [erasing, setErasing] = useState(false);

  useEffect(() => {
    let timer: number;

    if (!erasing && length < CALL_BEE_REST.length) {
      timer = window.setTimeout(
        () => setLength((n) => n + 1),
        TYPEWRITER_CHAR_MS,
      );
    } else if (!erasing && length === CALL_BEE_REST.length) {
      timer = window.setTimeout(() => setErasing(true), TYPEWRITER_HOLD_MS);
    } else if (erasing && length > 0) {
      timer = window.setTimeout(
        () => setLength((n) => n - 1),
        TYPEWRITER_ERASE_MS,
      );
    } else {
      timer = window.setTimeout(() => setErasing(false), 400);
    }

    return () => window.clearTimeout(timer);
  }, [length, erasing]);

  const isHolding = !erasing && length === CALL_BEE_REST.length;

  return (
    <span className="inline-flex items-center">
      <span className="flex-none">{CALL_BEE_FIXED_PREFIX}</span>
      <span
        className="inline-flex items-center justify-start whitespace-pre"
        style={{ minWidth: `${CALL_BEE_REST.length * 0.72}ch` }}
      >
        {CALL_BEE_REST.slice(0, length)}
        <span
          className={`ml-[1px] inline-block w-[2px] bg-current align-middle ${
            isHolding
              ? "[animation:heroCursorBlink_0.85s_step-end_infinite]"
              : ""
          }`}
          style={{ height: "0.9em" }}
        />
      </span>
    </span>
  );
}

type SequenceStep =
  | { phase: "typing" }
  | { phase: "answer"; lineIndex: number; charCount: number }
  | { phase: "cta" }
  | { phase: "done" };

const STREAM_CHAR_MS = 22;
const STREAM_LINE_PAUSE_MS = 350;

export default function Hero() {
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [step, setStep] = useState<SequenceStep>({ phase: "typing" });

  useEffect(() => {
    const scenario = HERO_SCENARIOS[scenarioIndex];
    const timers: number[] = [];

    if (step.phase === "typing") {
      timers.push(
        window.setTimeout(
          () => setStep({ phase: "answer", lineIndex: 0, charCount: 0 }),
          TYPING_DELAY_MS,
        ),
      );
    } else if (step.phase === "answer") {
      const currentLine = scenario.answer[step.lineIndex] ?? "";
      if (step.charCount < currentLine.length) {
        timers.push(
          window.setTimeout(
            () =>
              setStep({
                phase: "answer",
                lineIndex: step.lineIndex,
                charCount: step.charCount + 1,
              }),
            STREAM_CHAR_MS,
          ),
        );
      } else if (step.lineIndex < scenario.answer.length - 1) {
        timers.push(
          window.setTimeout(
            () =>
              setStep({
                phase: "answer",
                lineIndex: step.lineIndex + 1,
                charCount: 0,
              }),
            STREAM_LINE_PAUSE_MS,
          ),
        );
      } else {
        timers.push(
          window.setTimeout(
            () => setStep({ phase: "cta" }),
            ANSWER_LINE_DELAY_MS,
          ),
        );
      }
    } else if (step.phase === "cta") {
      timers.push(
        window.setTimeout(() => setStep({ phase: "done" }), CTA_DELAY_MS),
      );
    } else {
      timers.push(
        window.setTimeout(() => {
          setScenarioIndex((i) => (i + 1) % HERO_SCENARIOS.length);
          setStep({ phase: "typing" });
        }, HOLD_AFTER_DONE_MS),
      );
    }

    return () => timers.forEach((id) => window.clearTimeout(id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, scenarioIndex]);

  const scenario = HERO_SCENARIOS[scenarioIndex];
  const showCta = step.phase === "cta" || step.phase === "done";

  return (
    <section
      className="box-border flex w-full max-w-full flex-col items-center justify-start overflow-x-clip bg-white p-0"
      id="hero"
    >
      <style>
        {`
          @keyframes pillDotBlink {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.25; transform: scale(0.8); }
          }

          @keyframes heroMockupTextIn {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
          }

          @keyframes heroTypingDot {
            0%, 60%, 100% { opacity: 0.3; transform: scale(0.85); }
            30% { opacity: 1; transform: scale(1); }
          }

          @keyframes heroCursorBlink {
            0%, 50% { opacity: 1; }
            50.01%, 100% { opacity: 0; }
          }
        `}
      </style>
      <div className={heroTextAreaClass} />

      <div className={heroCenterClass}>
        <div className={heroInnerClass}>
          {/* Avatar row */}
          <div className="mb-8 flex flex-wrap justify-center">
            {HERO_AVATAR_ROW.map((a, i) => (
              <div
                key={a.kind === "cartoon" ? a.imgSrc : a.label}
                className={`${avatarClass} ${a.className} ${i > 0 ? "-ml-3" : ""}`}
                style={{ zIndex: i }}
              >
                {a.kind === "cartoon" ? (
                  <img
                    className="h-full w-full scale-110 object-cover"
                    src={a.imgSrc}
                    alt=""
                    aria-hidden
                  />
                ) : (
                  <a.Icon
                    className="h-6 w-6 sm:h-7 sm:w-7"
                    color={a.color}
                    strokeWidth={2.5}
                    aria-label={a.label}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Headline */}
          <h1 className={headlineClass}>
            바쁜 일상 속, 놓치는 예약 없이{" "}
            <span className="inline-flex max-[520px]:flex-wrap max-[520px]:justify-center items-center whitespace-nowrap max-[520px]:whitespace-normal align-middle">
              <span className={headlinePillClass}>
                <span className="h-[22px] w-[22px] flex-none rounded-full bg-[#2383e2] [animation:pillDotBlink_1.4s_ease-in-out_infinite]" />
                <CallBeeTypewriter />
              </span>
              하게
            </span>
          </h1>

          <p className={subheadlineClass}>
            전화와 채팅, 콜비가 24시간 대신 받고 예약까지 끝내드려요.
          </p>

          {/* Product UI preview */}
          <HeroGradient
            themes={HERO_SCENARIOS.map((s) => s.gradient)}
            activeIndex={scenarioIndex}
          >
            <div className={uiGradientInnerClass}>
              <div className={uiPreviewWrapClass}>
                {/* URL bar */}
                <div className={urlBarClass}>
                  <svg
                    className="h-6 w-6 shrink-0 max-[640px]:h-[22px] max-[640px]:w-[22px]"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#4a4a4a"
                    strokeWidth="1.6"
                  >
                    <circle cx="12" cy="12" r="9" />
                    <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
                  </svg>
                  <span className="text-[22px] font-semibold text-[#2e2e2e] max-[640px]:text-[20px]">
                    callbee.com
                  </span>
                </div>

                {/* Browser mockup */}
                <div className={browserMockupClass}>
                  <div className={browserContentClass}>
                    {/* User message */}
                    <div className={userMessageRowClass}>
                      <div
                        key={`q-${scenarioIndex}`}
                        className={`${userBubbleClass} [animation:heroMockupTextIn_0.35s_ease-out]`}
                      >
                        {scenario.question}
                      </div>
                    </div>

                    {/* AI reply */}
                    <div className={aiReplyClass}>
                      <div className={aiHeaderClass}>
                        <span className="rounded-[5px] border border-[#c7ccd2] px-1.5 py-0.5 text-[11px] font-bold text-[#1c2535]">
                          Callbee
                        </span>
                      </div>

                      <div className={aiBubbleClass}>
                        <div className={answerTextClass}>
                          {step.phase === "typing" ? (
                            <div className="flex min-h-[1.7em] items-center gap-1.5">
                              <span
                                className={typingDotClass}
                                style={{ animationDelay: "0ms" }}
                              />
                              <span
                                className={typingDotClass}
                                style={{ animationDelay: "150ms" }}
                              />
                              <span
                                className={typingDotClass}
                                style={{ animationDelay: "300ms" }}
                              />
                            </div>
                          ) : step.phase === "answer" ? (
                            scenario.answer
                              .slice(0, step.lineIndex + 1)
                              .map((line, idx) => (
                                <span key={line} className="block">
                                  {idx === step.lineIndex
                                    ? line.slice(0, step.charCount)
                                    : line}
                                </span>
                              ))
                          ) : (
                            scenario.answer.map((line) => (
                              <span key={line} className="block">
                                {line}
                              </span>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="mt-[18px] h-[44px] shrink-0">
                        {showCta && (
                          <button
                            className={`${ctaButtonClass} [animation:heroMockupTextIn_0.35s_ease-out]`}
                          >
                            {scenario.cta}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </HeroGradient>
        </div>
      </div>
    </section>
  );
}
