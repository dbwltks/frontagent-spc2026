'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, FileText, FolderOpen } from 'lucide-react'
import { Toggle } from '@/components/ui/Toggle'

const GRID =
  'grid min-h-[28px] grid-cols-[minmax(0,1fr)_0px_44px_0px_48px_0px] items-center gap-x-2 sm:grid-cols-[minmax(0,2.2fr)_58px_50px_68px_48px_20px] sm:gap-x-3'

const ROW = `${GRID} px-5 py-2`

function RowStatusCell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex items-center justify-center"
      onClick={stopRowActivation}
      onPointerDown={stopRowActivation}
    >
      {children}
    </div>
  )
}

function RowMoreCell() {
  return (
    <div className="hidden items-center justify-center text-[15px] leading-none text-gray-300 sm:flex">
      ⋮
    </div>
  )
}

type DemoDoc = {
  id: string
  title: string
  referenceCount: number
  updatedAt: string
}

type DemoFolder = {
  id: string
  name: string
  docs: DemoDoc[]
  children?: DemoFolder[]
}

const DEMO_FOLDERS: DemoFolder[] = [
  {
    id: 'default',
    name: '기본 폴더',
    docs: [
      { id: 'bathroom', title: '화장실 청소 안내', referenceCount: 35, updatedAt: '9일 전' },
      { id: 'balcony', title: '베란다 청소 안내', referenceCount: 0, updatedAt: '1일 전' },
    ],
  },
  {
    id: 'policy',
    name: '예약·정책',
    docs: [{ id: 'policy', title: '예약/취소 정책', referenceCount: 2, updatedAt: '2일 전' }],
  },
  {
    id: 'premium',
    name: '프리미엄 서비스',
    docs: [{ id: 'premium', title: '프리미엄 청소 안내', referenceCount: 79, updatedAt: '10일 전' }],
  },
]

export const KNOWLEDGE_DOC_ORDER = ['bathroom', 'balcony', 'policy', 'premium'] as const

function stopRowActivation(event: React.SyntheticEvent) {
  event.stopPropagation()
}

function DemoFolderRow({
  name,
  count,
  referenceTotal,
  isExpanded,
  indentLevel = 0,
  folderEnabled,
  onFolderToggle,
  onActivate,
}: {
  name: string
  count: number
  referenceTotal: number
  isExpanded: boolean
  indentLevel?: number
  folderEnabled: boolean
  onFolderToggle: () => void
  onActivate: () => void
}) {
  return (
    <div className={`${ROW} w-full hover:bg-gray-50`}>
      <button type="button" onClick={onActivate} className={`flex min-w-0 items-center gap-2 text-left ${indentLevel > 0 ? 'pl-4' : ''}`}>
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
        )}
        <FolderOpen className="h-4 w-4 shrink-0 text-amber-400" />
        <span className="truncate text-sm font-semibold text-gray-800">{name}</span>
        <span className="shrink-0 text-xs font-medium text-gray-400">{count}개</span>
      </button>
      <div />
      <div className="flex items-center justify-end text-xs font-semibold text-gray-500">
        {referenceTotal.toLocaleString()}
      </div>
      <div />
      <RowStatusCell>
        <Toggle enabled={folderEnabled} onChange={onFolderToggle} size="sm" />
      </RowStatusCell>
      <RowMoreCell />
    </div>
  )
}

function DemoDocRow({
  doc,
  enabled,
  onToggle,
  indentLevel = 0,
}: {
  doc: DemoDoc
  enabled: boolean
  onToggle: () => void
  indentLevel?: number
}) {
  return (
    <div className={`${ROW} transition-colors hover:bg-gray-50`}>
      <div className={`flex min-w-0 items-center gap-3 ${indentLevel > 0 ? 'pl-14' : 'pl-10'}`}>
        <FileText className="h-4 w-4 shrink-0 text-blue-400" />
        <span className="truncate text-sm font-semibold text-gray-900">{doc.title}</span>
      </div>
      <div className="hidden min-w-0 sm:flex">
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-blue-400">Document</span>
      </div>
      <div className="flex justify-end text-right text-xs font-semibold tabular-nums text-gray-700">
        {doc.referenceCount.toLocaleString()}
      </div>
      <div className="hidden min-w-0 justify-end pr-1 text-right text-[11px] font-medium text-gray-400 sm:flex">
        {doc.updatedAt}
      </div>
      <RowStatusCell>
        <Toggle enabled={enabled} onChange={onToggle} size="sm" />
      </RowStatusCell>
      <RowMoreCell />
    </div>
  )
}

function DemoFolderBlock({
  folder,
  indentLevel = 0,
  expandedFolders,
  onToggleFolderExpand,
  folderEnabled,
  onFolderActiveToggle,
  docEnabled,
  onDocToggle,
}: {
  folder: DemoFolder
  indentLevel?: number
  expandedFolders: Set<string>
  onToggleFolderExpand: (folderId: string) => void
  folderEnabled: Record<string, boolean>
  onFolderActiveToggle: (folderId: string) => void
  docEnabled: Record<string, boolean>
  onDocToggle: (docId: string) => void
}) {
  const isExpanded = expandedFolders.has(folder.id)
  const referenceTotal = folder.docs.reduce((sum, doc) => sum + doc.referenceCount, 0)

  return (
    <div>
      <DemoFolderRow
        name={folder.name}
        count={folder.docs.length}
        referenceTotal={referenceTotal}
        isExpanded={isExpanded}
        indentLevel={indentLevel}
        folderEnabled={folderEnabled[folder.id] ?? true}
        onFolderToggle={() => onFolderActiveToggle(folder.id)}
        onActivate={() => onToggleFolderExpand(folder.id)}
      />
      {isExpanded && (
        <div>
          {folder.docs.map((doc) => (
            <DemoDocRow
              key={doc.id}
              doc={doc}
              enabled={docEnabled[doc.id] ?? true}
              onToggle={() => onDocToggle(doc.id)}
              indentLevel={indentLevel}
            />
          ))}
          {folder.children?.map((child) => (
            <DemoFolderBlock
              key={child.id}
              folder={child}
              indentLevel={indentLevel + 1}
              expandedFolders={expandedFolders}
              onToggleFolderExpand={onToggleFolderExpand}
              folderEnabled={folderEnabled}
              onFolderActiveToggle={onFolderActiveToggle}
              docEnabled={docEnabled}
              onDocToggle={onDocToggle}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function FunctionsKnowledgePanel({
  docEnabled,
  onDocToggle,
}: {
  docEnabled: Record<string, boolean>
  onDocToggle: (docId: string) => void
}) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    () => new Set(DEMO_FOLDERS.map((folder) => folder.id)),
  )
  const [folderEnabled, setFolderEnabled] = useState<Record<string, boolean>>(
    () => Object.fromEntries(DEMO_FOLDERS.map((folder) => [folder.id, true])),
  )

  function toggleFolderExpand(folderId: string) {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(folderId)) next.delete(folderId)
      else next.add(folderId)
      return next
    })
  }

  function toggleFolderActive(folderId: string) {
    setFolderEnabled((prev) => ({ ...prev, [folderId]: !(prev[folderId] ?? true) }))
  }

  return (
    <div className="max-h-[min(420px,52vw)] overflow-y-auto overscroll-contain">
      <div
        className={`${GRID} sticky top-0 z-10 border-b border-gray-100 bg-white px-5 py-3 text-xs font-semibold text-gray-800`}
      >
        <span>이름</span>
        <span className="hidden sm:inline">형식</span>
        <span className="text-right">참조</span>
        <span className="hidden text-right sm:inline">업데이트</span>
        <span className="flex justify-center">상태</span>
        <span className="hidden sm:block" />
      </div>

      {DEMO_FOLDERS.map((folder, index) => (
        <div key={folder.id} className={index > 0 ? 'border-t border-gray-100' : undefined}>
          <DemoFolderBlock
            folder={folder}
            expandedFolders={expandedFolders}
            onToggleFolderExpand={toggleFolderExpand}
            folderEnabled={folderEnabled}
            onFolderActiveToggle={toggleFolderActive}
            docEnabled={docEnabled}
            onDocToggle={onDocToggle}
          />
        </div>
      ))}
    </div>
  )
}
