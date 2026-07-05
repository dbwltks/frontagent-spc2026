/** Full-viewport sections. Mobile gets free height since stacked content can exceed 100vh. */
export const pageSectionShell =
  'box-border flex min-h-[100vh] w-full flex-col items-center justify-center overflow-visible py-12 sm:py-0 sm:h-[100vh] sm:overflow-hidden'

/** Dashboard — min one screen, can grow */
export const pageSectionShellTall =
  'box-border flex min-h-[100vh] w-full flex-col items-center justify-center overflow-visible'

export const pageSectionInnerClass =
  'mx-auto flex w-full max-w-[1400px] flex-col justify-center bg-transparent px-10 py-12 max-[860px]:px-5'

export const pageSectionTitleClass =
  'mb-6 mt-3.5 text-5xl font-extrabold leading-tight tracking-[-0.04em] text-[#0f1118] max-[900px]:mb-5 max-[900px]:text-[32px]'

export const pageSectionLeadBase =
  'mb-10 max-w-[820px] text-xl leading-[1.8] text-[#5b6b8c] max-[900px]:text-lg'

export const pageSectionLeadClass = pageSectionLeadBase

export const pageSectionLeadCenterClass =
  `mx-auto w-full text-center ${pageSectionLeadBase}`

export const pageSectionLabelClass =
  'mb-1 text-sm font-bold text-[var(--ink)]'

export const pageSectionLabelCenterClass =
  'mb-1 text-sm font-bold text-[var(--ink)] text-center'

export const pageSectionLabelMutedCenterClass =
  'mb-1 text-sm font-bold text-[#aab2c4] text-center'

export const FUNCTIONS_ANCHOR_IDS = {
  rules: 'rules',
  knowledge: 'knowledge',
  tasks: 'tasks',
} as const
