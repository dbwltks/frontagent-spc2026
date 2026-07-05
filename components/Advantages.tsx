'use client'

import { GitBranch, ShieldCheck } from 'lucide-react'
import { pageSectionInnerClass, pageSectionLeadCenterClass, pageSectionShell, pageSectionTitleClass } from './sectionLayout'

const ITEMS = [
  {
    key: 'rules',
    color: '#c9d8f2',
    iconColor: '#3a5a8a',
    icon: <ShieldCheck size={18} color="#3a5a8a" />,
    title: '올바른 규칙',
    desc: '거짓말하는 AI를 방지하고, 기업 규정에 맞춘 정확한 안내로 리스크를 최소화합니다.',
  },
  {
    key: 'knowledge',
    color: '#c7e2d2',
    iconColor: '#2d6a4a',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2d6a4a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        <line x1="9" y1="7" x2="15" y2="7" />
        <line x1="9" y1="11" x2="15" y2="11" />
      </svg>
    ),
    title: '구조화된 지식',
    desc: '데이터를 단순 축적하는 것이 아니라, 구조화된 지식 체계(RAG)를 구축하여 AI가 완벽하게 이해하고 답변하게 합니다.',
  },
  {
    key: 'tasks',
    color: '#efdfb8',
    iconColor: '#8a6020',
    icon: <GitBranch size={18} color="#8a6020" />,
    title: '직접 실행 가능한 태스크',
    desc: '단순 상담을 넘어 주문 취소나 예약 변경 등 실제 업무를 AI가 직접 수행하여 문제 해결 속도를 높입니다.',
  },
  {
    key: 'evaluation',
    color: '#ded7f5',
    iconColor: '#5b3df0',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5b3df0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 2.1l4 4-4 4" />
        <path d="M3 12.2v-2a4 4 0 0 1 4-4h12.8M7 21.9l-4-4 4-4" />
        <path d="M21 11.8v2a4 4 0 0 1-4 4H4.2" />
      </svg>
    ),
    title: '개선 제안',
    desc: 'AI 스스로 상담 품질을 진단하고 개선점을 제안하며, 오래된 지식을 자동으로 업데이트하여 최상의 성능을 유지합니다.',
  },
]

const sectionClass = `${pageSectionInnerClass} text-center`

export default function Advantages() {
  return (
    <section className={`${pageSectionShell} relative`} id="advantages">
    <div className={sectionClass}>
      <h2 className={pageSectionTitleClass}>상담 자동화를 현실로 만드는 Call bee의 설계</h2>
      <p className={pageSectionLeadCenterClass}>
        상담 공백을 줄이는 Call bee의 방법, 복잡하지 않습니다.<br />
        올바른 규칙, 구조화된 지식, 직접 실행 가능한 태스크, 개선 제안을 하나의 상담 솔루션으로 준비합니다.
      </p>
      <div className="mx-auto mt-14 grid w-full max-w-[1320px] grid-cols-4 gap-[clamp(10px,1.2vw,16px)] text-left max-[1100px]:grid-cols-2 max-[640px]:mt-10 max-[640px]:grid-cols-1 max-[640px]:gap-[14px]">
        {ITEMS.map(item => (
          <a
            key={item.key}
            href={`#${item.key}`}
            onClick={e => {
              e.preventDefault()
              document.getElementById(item.key)?.scrollIntoView({ behavior: 'smooth' })
            }}
            className="group flex min-w-0 cursor-pointer flex-col gap-3 rounded-2xl border border-[rgba(0,0,0,0.1)] p-[clamp(22px,2.4vw,30px)] transition-all duration-300 hover:-translate-y-1 hover:border-[rgba(0,0,0,0.18)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)]"
          >
            <div
              className="mb-0.5 flex h-[40px] w-[40px] items-center justify-center rounded-[12px] transition-transform duration-300 group-hover:scale-110"
              style={{ background: item.color }}
            >
              {item.icon}
            </div>
            <div className="flex items-center gap-2.5 text-[22px] font-bold text-[var(--ink)]">
              {item.title}
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-[var(--ink)]">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </div>
            <div className="text-[15px] leading-[1.7] text-[var(--muted)]">{item.desc}</div>
          </a>
        ))}
      </div>
    </div>
    </section>
  )
}
