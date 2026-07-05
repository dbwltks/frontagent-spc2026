'use client'

import { useState, useEffect, useRef, type ReactNode, type PointerEvent as ReactPointerEvent } from 'react'
import { GitBranch, ListOrdered, MessageSquare, Minus, Plus, Zap } from 'lucide-react'
import { Toggle } from '@/components/ui/Toggle'
import { FUNCTIONS_ANCHOR_IDS, pageSectionInnerClass, pageSectionLabelClass, pageSectionLeadClass, pageSectionShell, pageSectionTitleClass } from './sectionLayout'
import { FunctionsKnowledgePanel, KNOWLEDGE_DOC_ORDER } from './FunctionsKnowledgePanel'

const ruleDescClass = 'mt-1 max-w-none pl-[3px] text-[clamp(11px,0.9vw,12.5px)] leading-[1.55] text-[var(--muted)]'
const ruleClass = 'border-b border-[var(--line)] bg-white py-[clamp(10px,1.2vw,14px)] last:border-0 last:pb-0'
const ruleLabelClass = 'flex-1 text-[clamp(12px,1.05vw,14.5px)] font-bold text-[var(--ink)]'
const labAClass =
  'mt-[clamp(10px,1vw,14px)] min-h-[clamp(72px,8vw,96px)] rounded-2xl rounded-bl-[5px] !border !border-[rgba(0,0,0,.06)] !bg-white px-[clamp(12px,1.2vw,17px)] py-[clamp(11px,1.1vw,15px)] text-[clamp(12px,1.05vw,14px)] leading-[1.6]'
const modeBtnClass = 'cursor-pointer px-[clamp(20px,2.2vw,32px)] py-[clamp(7px,0.7vw,10px)] text-[clamp(11px,0.95vw,13px)] font-bold transition-all duration-150 [font-family:inherit]'
const labMetaDescClass = 'm-0 text-lg leading-[1.65] text-[var(--muted)]'
const sectionClass = pageSectionInnerClass

interface Functions {
  key: string
  label: string
  content: ReactNode
}

const FUNCTIONS: Functions[] = [
  {
    key: 'formal',
    label: '기본 CX 톤앤매너',
    content: (
      <div className={ruleDescClass}>
        신뢰감을 주면서도 안전한 답변을 사용합니다.
        <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
          <li>브랜드 관련된 내용을 친절하게 안내해줘.</li>
          <li>고객이 질문한 내용만 최대한 간결하게 작성해줘.</li>
        </ul>
      </div>
    ),
  },
  {
    key: 'privacy',
    label: '민감정보 답변 제한',
    content: (
      <div className={ruleDescClass}>
        연락처·결제정보 등 민감정보는 안내하지 않습니다.
        <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
          <li>고객의 개인정보는 절대 외부에 공유하지 않습니다.</li>
          <li>결제 관련 문의는 공식 채널을 통해서만 안내합니다.</li>
        </ul>
      </div>
    ),
  },
  {
    key: 'knowledge',
    label: '반복 문의는 지식 문서 먼저 참조',
    content: (
      <div className={ruleDescClass}>
        상담원 연결 전 지식 문서를 우선 검색합니다.
        <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
          <li>자주 묻는 질문은 지식 베이스에서 먼저 확인합니다.</li>
          <li>답변을 찾지 못한 경우에만 상담원에게 연결합니다.</li>
        </ul>
      </div>
    ),
  },
  {
    key: 'consent',
    label: '문자 발송 전 고객 동의 확인',
    content: (
      <div className={ruleDescClass}>
        안내 문자는 고객이 동의한 경우에만 발송합니다.
        <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
          <li>수신 동의 여부를 먼저 확인한 후 발송을 진행합니다.</li>
          <li>동의하지 않은 고객에게는 문자를 발송하지 않습니다.</li>
        </ul>
      </div>
    ),
  },
]

const RULE_ITEMS = [
  { key: 'formal',    label: '기본 CX 톤앤매너',          instruction: ['고객 응대 시 항상 공손하고 친절한 톤을 유지하세요.', '브랜드 관련 내용은 친절하게 안내하고, 고객 질문에는 간결하게 답변해 주세요.'], isBuiltin: true,  active: true  },
  { key: 'privacy',   label: '민감정보 답변 제한',          instruction: ['고객의 연락처, 결제 정보 등 민감한 개인정보는 절대 외부에 공유하지 마세요.', '결제 관련 문의는 공식 채널을 통해서만 안내하세요.'],                isBuiltin: true,  active: true  },
  { key: 'knowledge', label: '반복 문의는 지식 문서 먼저 참조', instruction: ['고객 문의 시 상담원 연결 전 지식 베이스를 우선 검색하세요.', '답변을 찾지 못한 경우에만 상담원에게 연결하세요.'],                          isBuiltin: false, active: true  },
]

const KNOWLEDGE_DOC_IDS = KNOWLEDGE_DOC_ORDER

const BEFORE_TEXT = '환불? 그냥 전화하면 되는데. 사장 번호는 010-1234-5678이야. 화장실 청소도 되는지는 잘 모르겠어.'

function buildAfterAnswer(toggles: Record<string, boolean>): ReactNode {
  const formal = toggles['formal']
  const privacy = toggles['privacy']
  const knowledge = toggles['knowledge']

  const greeting = formal
    ? <>안녕하세요! 고객님, 문의해 주셔서 감사합니다 😊<br /><br /></>
    : <>네, 안내해 드릴게요.<br /><br /></>

  const privacyPart = privacy
    ? '환불 및 취소 관련 문의는 공식 고객센터를 통해 안내해 드리고 있습니다. '
    : '환불은 사장님께 직접 연락하시면 됩니다. 번호는 010-1234-5678이에요. '

  const refundPart = knowledge
    ? '화장실 청소는 기본 패키지에 포함되어 있으며, 서비스 24시간 전까지 취소 가능합니다.'
    : '화장실 청소 포함 여부는 담당자에게 별도 문의 부탁드립니다.'

  const closing = formal ? ' 추가 문의가 있으시면 언제든 말씀해 주세요!' : ''

  return <>{greeting}{privacyPart}{refundPart}{closing}</>
}

function buildKnowledgeAnswer(knowledgeToggles: Record<string, boolean>): ReactNode {
  const hasBathroom = knowledgeToggles.bathroom
  const hasBalcony = knowledgeToggles.balcony
  const hasPolicy = knowledgeToggles.policy
  const hasPremium = knowledgeToggles.premium

  const scopes: string[] = []
  if (hasBathroom) scopes.push('화장실')
  if (hasBalcony)  scopes.push('베란다')
  if (hasPremium)  scopes.push('프리미엄(전체)')

  const scopePart = scopes.length > 0
    ? `청소 범위는 ${scopes.join('·')} 서비스가 포함됩니다.`
    : '현재 등록된 청소 안내 문서가 없어 범위 안내가 어렵습니다.'

  const policyPart = hasPolicy
    ? ' 예약 취소는 서비스 24시간 전까지 가능하며, 이후에는 취소 수수료가 발생합니다.'
    : ' 취소 정책은 담당자에게 별도 문의 부탁드립니다.'

  return <>{scopePart}{policyPart}</>
}

function buildTasksAnswer(toggles: Record<string, boolean>): ReactNode {
  const formal    = toggles['formal']
  const knowledge = toggles['knowledge']

  const greeting = formal
    ? <>안녕하세요! 고객님, 청소 예약을 확인해 드리겠습니다 😊<br /><br /></>
    : <>네, 예약 내역 확인해 드릴게요.<br /><br /></>

  const processPart = knowledge
    ? '등록된 전화번호로 예약을 조회했습니다. 이번 주 토요일 오전 10시 베란다+화장실 청소 예약이 확인됩니다. '
    : '예약 조회를 위해 등록하신 전화번호를 알려 주시겠어요? '

  const closing = formal ? '추가 문의가 있으시면 말씀해 주세요!' : ''

  return <>{greeting}{processPart}{closing}</>
}

interface LabPanelProps {
  mode: 'before' | 'after'
  onModeChange: (m: 'before' | 'after') => void
  titleVariant?: 'rules' | 'knowledge' | 'tasks'
}

// ── Flow Builder (실제 빌더 노드 그대로) ────────────────────────────────────

const NODE_W = 280
const NODE_H = 150
const BRANCH_NODE_H = 240
const BRANCH_MATCH_PORT = 176
const BRANCH_FALLBACK_PORT = 210
const GRID = 40

type FNode = {
  id: string; nodeKey: string; nodeType: 'agent' | 'function' | 'message' | 'end'
  label: string; description: string; positionX: number; positionY: number
  isBranch?: boolean; branchLabel?: string; fallbackLabel?: string; isEnd?: boolean
  primaryContent?: string   // 지시문 / 메시지 / 함수명
  secondaryContent?: string // 저장 변수 / 추가 설명
  services?: string[]
  nextMode?: 'single' | 'branch' | 'end'
}
type FEdge = { id: string; from: string; to: string; isFallback?: boolean }

// X 간격: 280(노드폭) + 120(갭) = 400
// 트리거·A·B가 같은 Y=80, C는 위(Y=80), D는 아래(Y=330)
const MOCK_NODES: FNode[] = [
  {
    id: 'trigger', nodeKey: '__trigger__', nodeType: 'agent', label: '예약 조회 플로우',
    description: '고객이 기존 예약 조회를 요청할 때 실행됩니다.',
    positionX: 80, positionY: 80,
    primaryContent: '고객이 예약 내역 조회를 요청하면 이 플로우를 시작합니다.\n\n- "예약 확인", "예약 조회" 등의 의도로 시작됩니다.\n- 고객에게 친절하게 안내합니다.',
    services: ['채팅', '통화'],
    nextMode: 'single',
  },
  {
    id: 'na', nodeKey: 'node_a', nodeType: 'agent', label: '전화번호 질문',
    description: '예약 조회를 위해 고객의 전화번호를 확인합니다.',
    positionX: 480, positionY: 80,
    primaryContent: '예약 조회를 위해 가입 시 등록한 전화번호를 알려 주시겠어요?\n\n입력하신 번호로 예약 내역을 바로 확인해 드리겠습니다.',
    secondaryContent: 'customer_phone',
    services: ['채팅', '통화'],
    nextMode: 'single',
  },
  {
    id: 'nb', nodeKey: 'node_b', nodeType: 'function', label: '예약 목록 조회',
    description: '입력된 전화번호로 예약 내역을 조회합니다.',
    positionX: 880, positionY: 80,
    isBranch: true, branchLabel: '조회 완료', fallbackLabel: '예약 없음',
    primaryContent: 'get_reservations_by_phone',
    secondaryContent: 'reservation_list',
    nextMode: 'branch',
  },
  {
    id: 'nc', nodeKey: 'node_c', nodeType: 'message', label: '조회 완료 안내',
    description: '예약 내역을 확인했습니다.',
    positionX: 1280, positionY: 80, isEnd: true,
    primaryContent: '확인된 예약 내역을 안내해 드립니다.\n\n{{reservation_list}}\n\n추가로 궁금한 사항이 있으시면 말씀해 주세요 😊',
    nextMode: 'end',
  },
  {
    id: 'nd', nodeKey: 'node_d', nodeType: 'message', label: '예약 없음 안내',
    description: '조회된 예약을 찾지 못했습니다.',
    positionX: 1280, positionY: 370, isEnd: true,
    primaryContent: '입력하신 번호로 등록된 예약 내역을 찾지 못했습니다.\n\n번호를 다시 확인하시거나, 예약 시 다른 번호를 사용하셨다면 해당 번호로 다시 조회해 보세요.',
    nextMode: 'end',
  },
]
const MOCK_EDGES: FEdge[] = [
  { id: 'e1', from: '__trigger__', to: 'node_a' },
  { id: 'e2', from: 'node_a',      to: 'node_b' },
  { id: 'e3', from: 'node_b',      to: 'node_c' },
  { id: 'e4', from: 'node_b',      to: 'node_d', isFallback: true },
]

const NODE_TYPE_LABEL: Record<string, string> = { agent: 'AI 에이전트', function: '함수 실행', message: '안내 메시지', end: '종료' }
const NODE_ICON_BG: Record<string, string>    = { agent: 'bg-blue-50', function: 'bg-yellow-50', message: 'bg-green-50', end: 'bg-gray-100' }
const NODE_ICON_COLOR: Record<string, string> = { agent: 'text-blue-500', function: 'text-yellow-500', message: 'text-green-600', end: 'text-gray-500' }

function NodeIcon({ type, className }: { type: string; className?: string }) {
  if (type === 'agent')    return <Zap className={`h-5 w-5 fill-current ${className ?? ''}`} />
  if (type === 'function') return <svg className={`h-5 w-5 ${className ?? ''}`} viewBox="0 0 24 24" fill="currentColor"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
  return <MessageSquare className={`h-5 w-5 ${className ?? ''}`} />
}

function buildRoundedOrthogonal(points: Array<{x:number;y:number}>, r=14) {
  if (points.length < 2) return ''
  const cmds = [`M ${points[0].x} ${points[0].y}`]
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i-1], cur = points[i], next = points[i+1]
    const pv = { x: Math.sign(cur.x-prev.x), y: Math.sign(cur.y-prev.y) }
    const nv = { x: Math.sign(next.x-cur.x),  y: Math.sign(next.y-cur.y) }
    if (pv.x === nv.x && pv.y === nv.y) { cmds.push(`L ${cur.x} ${cur.y}`); continue }
    const pl = Math.abs(cur.x-prev.x)+Math.abs(cur.y-prev.y)
    const nl = Math.abs(next.x-cur.x)+Math.abs(next.y-cur.y)
    const cr = Math.min(r, pl/2, nl/2)
    if (cr <= 0) { cmds.push(`L ${cur.x} ${cur.y}`); continue }
    const b = { x: cur.x - pv.x*cr, y: cur.y - pv.y*cr }
    const a = { x: cur.x + nv.x*cr, y: cur.y + nv.y*cr }
    cmds.push(`L ${b.x} ${b.y}`, `Q ${cur.x} ${cur.y} ${a.x} ${a.y}`)
  }
  const last = points[points.length-1]
  cmds.push(`L ${last.x} ${last.y}`)
  return cmds.join(' ')
}

function snap(v: number) { return Math.max(0, Math.round(v / GRID) * GRID) }
function nodeH(n: FNode) { return n.isBranch ? BRANCH_NODE_H : NODE_H }

function FlowBuilder() {
  const [nodes, setNodes] = useState<FNode[]>(MOCK_NODES)
  const [selected, setSelected] = useState<string | null>(null)
  const [zoom, setZoom] = useState(0.62)
  const [offset, setOffset] = useState({ x: 16, y: 24 })
  const [vpSize, setVpSize] = useState({ w: 0, h: 0 })
  const canvasRef = useRef<HTMLDivElement>(null)
  const panelScrollRef = useRef<HTMLDivElement>(null)
  const panRef = useRef<{sx:number;sy:number;ox:number;oy:number}|null>(null)
  const dragRef = useRef<{id:string;scx:number;scy:number;sx:number;sy:number}|null>(null)
  const fittedRef = useRef(false)

  const fitView = (w: number, h: number) => {
    const padX = 56, padY = 32
    const minX = Math.min(...MOCK_NODES.map(n => n.positionX))
    const minY = Math.min(...MOCK_NODES.map(n => n.positionY))
    const maxX = Math.max(...MOCK_NODES.map(n => n.positionX + NODE_W))
    const maxY = Math.max(...MOCK_NODES.map(n => n.positionY + nodeH(n)))
    const nodesW = maxX - minX, nodesH = maxY - minY
    const fz = Math.min((w - padX * 2) / nodesW, (h - padY * 2) / nodesH, 1)
    const fittedW = nodesW * fz, fittedH = nodesH * fz
    setZoom(fz)
    setOffset({
      x: (w - fittedW) / 2 - minX * fz,
      y: (h - fittedH) / 2 - minY * fz,
    })
  }

  useEffect(() => {
    const el = canvasRef.current; if (!el) return
    const obs = new ResizeObserver(() => {
      const r = el.getBoundingClientRect()
      setVpSize({ w: r.width, h: r.height })
      if (!fittedRef.current && r.width > 0) {
        fittedRef.current = true
        fitView(r.width, r.height)
      }
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const clampZoom = (v: number) => Math.min(2, Math.max(0.3, Math.round(v*100)/100))

  const zoomRef = useRef(zoom)
  const offsetRef = useRef(offset)
  zoomRef.current = zoom
  offsetRef.current = offset

  useEffect(() => {
    const el = panelScrollRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => { e.stopPropagation() }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [selected])

  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const z = zoomRef.current
      const o = offsetRef.current
      if (e.ctrlKey || e.metaKey) {
        const nz = Math.min(2, Math.max(0.3, Math.round((z - e.deltaY * 0.002) * 100) / 100))
        if (nz === z) return
        const rect = el.getBoundingClientRect()
        const cx = e.clientX - rect.left, cy = e.clientY - rect.top
        const dx = (cx - o.x) / z, dy = (cy - o.y) / z
        setZoom(nz)
        setOffset({ x: cx - dx * nz, y: cy - dy * nz })
      } else {
        setOffset({ x: o.x - e.deltaX, y: o.y - e.deltaY })
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const onCanvasPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    panRef.current = { sx: e.clientX, sy: e.clientY, ox: offset.x, oy: offset.y }
    e.currentTarget.setPointerCapture(e.pointerId)
    setSelected(null)
  }
  const onCanvasPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current) {
      const id = dragRef.current.id
      const nx = snap(dragRef.current.sx + (e.clientX - dragRef.current.scx) / zoom)
      const ny = snap(dragRef.current.sy + (e.clientY - dragRef.current.scy) / zoom)
      setNodes(prev => prev.map(n => n.id === id ? {...n, positionX: nx, positionY: ny} : n))
    } else if (panRef.current) {
      setOffset({ x: panRef.current.ox + (e.clientX - panRef.current.sx), y: panRef.current.oy + (e.clientY - panRef.current.sy) })
    }
  }
  const onCanvasPointerUp = () => { panRef.current = null; dragRef.current = null }

  const onNodePointerDown = (e: ReactPointerEvent<HTMLElement>, node: FNode) => {
    e.stopPropagation()
    if (e.button !== 0) return
    dragRef.current = { id: node.id, scx: e.clientX, scy: e.clientY, sx: node.positionX, sy: node.positionY }
    e.currentTarget.setPointerCapture(e.pointerId)
    setSelected(node.id)
  }

  const nodeByKey = new Map(nodes.map(n => [n.nodeKey, n]))
  const nodeById  = new Map(nodes.map(n => [n.id, n]))
  const trigger = nodes[0]

  const edgePath = (from: string, fromY: number, to: string, toY: number) => {
    const src = nodeByKey.get(from) ?? nodeById.get(from)
    const tgt = nodeByKey.get(to)   ?? nodeById.get(to)
    if (!src || !tgt) return ''
    const sx = src.positionX + NODE_W, tx = tgt.positionX
    const atx = tx - 4, asx = atx - 10
    const mid = (sx + asx) / 2
    const isForward = tx > sx + 56
    if (isForward) {
      return buildRoundedOrthogonal([{x:sx,y:fromY},{x:mid,y:fromY},{x:mid,y:toY},{x:asx,y:toY}])
    }
    const routeY = Math.max(src.positionY + nodeH(src), tgt.positionY + nodeH(tgt)) + 50
    return buildRoundedOrthogonal([{x:sx,y:fromY},{x:sx+72,y:fromY},{x:sx+72,y:routeY},{x:asx-72,y:routeY},{x:asx-72,y:toY},{x:asx,y:toY}])
  }

  const contentW = Math.max(NODE_W+400, ...nodes.map(n => n.positionX + NODE_W + 300))
  const contentH = Math.max(NODE_H+400, ...nodes.map(n => n.positionY + nodeH(n) + 300))

  // minimap
  const mmW = 140, mmH = 60, mmPad = 7
  const allX = nodes.map(n => n.positionX), allY = nodes.map(n => n.positionY)
  const minX = Math.min(0,...allX)-40, minY = Math.min(0,...allY)-40
  const maxX = Math.max(NODE_W,...nodes.map(n=>n.positionX+NODE_W))+40
  const maxY = Math.max(NODE_H,...nodes.map(n=>n.positionY+nodeH(n)))+40
  const mmScale = Math.min((mmW-mmPad*2)/(maxX-minX),(mmH-mmPad*2)/(maxY-minY))
  const mmCW = (maxX-minX)*mmScale, mmCH = (maxY-minY)*mmScale
  const mmOX = (mmW-mmCW)/2, mmOY = (mmH-mmCH)/2
  const toMX = (v:number) => mmOX + (v-minX)*mmScale
  const toMY = (v:number) => mmOY + (v-minY)*mmScale
  const visW = vpSize.w/zoom, visH = vpSize.h/zoom
  const visL = -offset.x/zoom, visT = -offset.y/zoom
  const mmVp = {
    x: Math.max(mmOX, Math.min(toMX(visL), mmOX+mmCW-Math.max(8,visW*mmScale))),
    y: Math.max(mmOY, Math.min(toMY(visT), mmOY+mmCH-Math.max(8,visH*mmScale))),
    w: Math.max(8, Math.min(visW*mmScale, mmCW)),
    h: Math.max(8, Math.min(visH*mmScale, mmCH)),
  }

  return (
    <div
      ref={canvasRef}
      className="absolute inset-0 cursor-grab touch-none select-none overflow-hidden active:cursor-grabbing"
      style={{
        backgroundColor: '#1e2030',
        backgroundImage: 'radial-gradient(circle, #353848 1px, transparent 1.4px)',
        backgroundSize: `${GRID*zoom}px ${GRID*zoom}px`,
        backgroundPosition: `${offset.x}px ${offset.y}px`,
      }}
      onPointerDown={onCanvasPointerDown}
      onPointerMove={onCanvasPointerMove}
      onPointerUp={onCanvasPointerUp}
      onPointerLeave={onCanvasPointerUp}

    >
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{ width: contentW, height: contentH, transform: `translate(${offset.x}px,${offset.y}px) scale(${zoom})` }}
      >
        {/* edges (bottom layer) */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${contentW} ${contentH}`}>
          <defs>
            <style>{`@keyframes flow-dash{from{stroke-dashoffset:14}to{stroke-dashoffset:0}}`}</style>
          </defs>
          {MOCK_EDGES.map(edge => {
            const src = nodes.find(n => n.nodeKey === edge.from || n.id === edge.from)
            const tgt = nodes.find(n => n.nodeKey === edge.to   || n.id === edge.to)
            if (!src || !tgt) return null
            const isActive = selected === src.id || selected === tgt.id
            const isFallback = edge.isFallback
            const color = isActive ? (isFallback ? '#ef4444' : '#3182F6') : '#cbd5e1'
            const srcH = nodeH(src)
            const srcY = src.isBranch
              ? src.positionY + (isFallback ? BRANCH_FALLBACK_PORT : BRANCH_MATCH_PORT)
              : src.positionY + srcH/2
            const tgtY = tgt.positionY + NODE_H/2
            const path = edgePath(src.nodeKey, srcY, tgt.nodeKey, tgtY)
            const aEndX = tgt.positionX - 4
            return (
              <g key={edge.id} className="pointer-events-none">
                <path d={path} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round"
                  strokeDasharray={isActive ? '7 7' : undefined}
                  style={isActive ? {animation:'flow-dash 0.8s linear infinite'} : undefined}
                />
                <path d={`M ${aEndX-10} ${tgtY-6} L ${aEndX} ${tgtY} L ${aEndX-10} ${tgtY+6}`}
                  fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx={src.positionX+NODE_W} cy={srcY} r={isActive?5:4} fill={color} stroke="#fff" strokeWidth="2.5" />
                <circle cx={tgt.positionX}         cy={tgtY} r={isActive?5:4} fill={color} stroke="#fff" strokeWidth="2.5" />
              </g>
            )
          })}
        </svg>

        {/* trigger node */}
        <button
          type="button"
          className={`absolute flex cursor-grab flex-col rounded-[18px] border-2 bg-white px-4 pb-4 pt-6 text-left transition-shadow active:cursor-grabbing ${
            selected === trigger.id
              ? 'border-blue-400 shadow-[0_12px_34px_rgba(49,130,246,0.18)]'
              : 'border-blue-100 shadow-[0_8px_24px_rgba(15,23,42,0.07)] hover:border-blue-200 hover:shadow-[0_10px_28px_rgba(15,23,42,0.10)]'
          }`}
          style={{ left: trigger.positionX, top: trigger.positionY, width: NODE_W, minHeight: NODE_H }}
          onPointerDown={(e) => onNodePointerDown(e, trigger)}
          onClick={(e) => { e.stopPropagation(); setSelected(trigger.id) }}
        >
          <span className={`absolute -top-4 left-5 rounded-full px-3 py-1.5 text-[11px] font-extrabold shadow-sm ${selected===trigger.id?'bg-blue-500 text-white':'bg-gray-100 text-gray-500'}`}>트리거</span>
          <span className="absolute -top-4 right-5 rounded-full bg-blue-50 px-3 py-1.5 text-[11px] font-extrabold text-blue-600 shadow-sm">시작</span>
          <div className="flex items-start gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-blue-50 text-blue-500">
              <Zap className="h-5 w-5 fill-current" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-extrabold text-gray-900">{trigger.label}</div>
            </div>
          </div>
          <div className="mt-3 line-clamp-3 text-[12px] font-semibold leading-relaxed text-gray-500">{trigger.description}</div>
        </button>

        {/* regular nodes */}
        {nodes.slice(1).map(node => {
          const h = nodeH(node)
          const isSelected = selected === node.id
          const typeLabel = NODE_TYPE_LABEL[node.nodeType] ?? node.nodeType
          const iconBg    = NODE_ICON_BG[node.nodeType]    ?? 'bg-gray-100'
          const iconColor = NODE_ICON_COLOR[node.nodeType] ?? 'text-gray-500'
          return (
            <div
              key={node.id}
              className={`absolute flex cursor-grab flex-col rounded-[18px] border bg-white px-4 pb-4 pt-6 transition-shadow active:cursor-grabbing ${
                isSelected
                  ? 'border-blue-400 shadow-[0_0_0_3px_rgba(49,130,246,0.25),0_8px_24px_rgba(15,23,42,0.1)]'
                  : 'border-blue-100 shadow-[0_8px_24px_rgba(15,23,42,0.07)] hover:border-blue-200'
              }`}
              style={{ left: node.positionX, top: node.positionY, width: NODE_W, height: h }}
              onPointerDown={(e) => onNodePointerDown(e, node)}
              onClick={(e) => { e.stopPropagation(); setSelected(node.id) }}
            >
              <span className={`absolute -top-4 left-5 rounded-full px-3 py-1.5 text-[11px] font-extrabold shadow-sm ${isSelected?'bg-blue-100 text-blue-600':'bg-gray-100 text-gray-500'}`}>
                {typeLabel}
              </span>
              {node.isEnd && (
                <span className="absolute -top-4 right-5 rounded-full bg-gray-100 px-3 py-1.5 text-[11px] font-extrabold text-gray-600 shadow-sm">종료</span>
              )}
              <div className="flex items-center gap-2.5">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${iconBg} ${iconColor}`}>
                  <NodeIcon type={node.nodeType} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-extrabold text-gray-900">{node.label}</div>
                  <div className="truncate text-[11px] font-bold text-gray-400">{node.nodeKey}</div>
                </div>
              </div>
              <div className="mt-3 line-clamp-2 text-[12px] font-semibold leading-relaxed text-gray-500">{node.description}</div>
              {node.isBranch && (
                <div className="absolute bottom-4 left-4 right-4 space-y-1.5 border-t border-gray-100 pt-2">
                  <div className="flex h-7 items-center justify-between rounded-[10px] bg-blue-50 px-2.5 text-[11px] font-extrabold text-blue-600">
                    <span>조건이 맞으면</span><span className="max-w-[120px] truncate text-blue-500">{node.branchLabel}</span>
                  </div>
                  <div className="flex h-7 items-center justify-between rounded-[10px] bg-gray-50 px-2.5 text-[11px] font-extrabold text-gray-500">
                    <span>일치하지 않으면</span><span className="max-w-[120px] truncate">{node.fallbackLabel}</span>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* right detail panel — real builder style */}
      {(() => {
        const node = selected ? nodes.find(n => n.id === selected) : null
        if (!node) return null
        const isTrig = node.id === 'trigger'
        const typeLabel = NODE_TYPE_LABEL[node.nodeType] ?? node.nodeType
        const iconBg    = NODE_ICON_BG[node.nodeType]    ?? 'bg-gray-100'
        const iconColor = NODE_ICON_COLOR[node.nodeType] ?? 'text-gray-500'
        const outgoing = MOCK_EDGES.filter(e => e.from === node.nodeKey)
        const incoming = MOCK_EDGES.filter(e => e.to   === node.nodeKey)
        return (
          <div
            className="absolute right-0 top-0 bottom-0 z-20 flex flex-col rounded-r-[clamp(12px,1.3vw,18px)] bg-white"
            style={{ width: 240, boxShadow: '-12px 0 32px rgba(15,23,42,0.13)', overflow: 'hidden' }}
            onPointerDown={e => e.stopPropagation()}
          >
            {/* header */}
            <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
              <div className="flex items-center gap-3 min-w-0">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] ${iconBg} ${iconColor}`}>
                  {isTrig ? <Zap className="h-5 w-5 fill-current" /> : <NodeIcon type={node.nodeType} />}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-extrabold leading-tight text-gray-900">{node.label}</div>
                  <div className="mt-0.5 truncate text-[11px] font-semibold text-gray-400">{isTrig ? '트리거' : typeLabel}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="ml-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div ref={panelScrollRef} className="min-h-0 flex-1 overflow-y-auto">

              {/* 섹션 1: 지시문 / 메시지 / 함수 */}
              <div className="border-b border-gray-100">
                <div className="flex items-center gap-2.5 px-5 py-3.5">
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] ${NODE_ICON_BG[node.nodeType] ?? 'bg-gray-100'} ${NODE_ICON_COLOR[node.nodeType] ?? 'text-gray-600'}`}>
                    <NodeIcon type={node.nodeType} className="!h-3.5 !w-3.5" />
                  </span>
                  <span className="text-[13px] font-extrabold text-gray-800">
                    {node.nodeType === 'message' ? '안내 메시지' : node.nodeType === 'function' ? '실행 함수' : isTrig ? '트리거 조건' : '지시문'}
                  </span>
                </div>
                <div className="px-5 pb-4">
                  {node.nodeType === 'function' ? (
                    <div className="rounded-[12px] bg-gray-50 px-4 py-3">
                      <div className="text-[10px] font-bold text-gray-400 mb-1">함수명</div>
                      <div className="font-mono text-[11px] font-extrabold text-blue-600">{node.primaryContent}</div>
                      {node.secondaryContent && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <div className="text-[11px] font-bold text-gray-400 mb-1">저장 변수</div>
                          <div className="font-mono text-[12px] font-bold text-gray-700">{`{{${node.secondaryContent}}}`}</div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-[12px] bg-gray-50 px-4 py-3 text-[11px] font-semibold leading-[1.7] text-gray-600 whitespace-pre-line">
                      {node.primaryContent}
                    </div>
                  )}
                  {node.nodeType === 'agent' && !isTrig && node.secondaryContent && (
                    <div className="mt-2 rounded-[10px] bg-blue-50 px-3 py-2">
                      <span className="text-[11px] font-bold text-gray-400">저장 변수 </span>
                      <span className="font-mono text-[11px] font-extrabold text-blue-600">{`{{${node.secondaryContent}}}`}</span>
                    </div>
                  )}
                </div>
              </div>


              {/* 섹션 3: 다음 단계로 이동 */}
              <div>
                <div className="flex items-center gap-2.5 px-5 py-3.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-gray-100 text-gray-600">
                    <GitBranch className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-[13px] font-extrabold text-gray-800">다음 단계로 이동</span>
                </div>
                <div className="px-5 pb-4">
                  {node.nextMode === 'end' ? (
                    <div className="rounded-[12px] bg-gray-50 px-4 py-2.5 text-[12px] font-bold text-gray-500">플로우 종료</div>
                  ) : node.nextMode === 'branch' ? (
                    <div className="space-y-2">
                      <div className="rounded-[12px] border border-blue-100 bg-blue-50/60 px-4 py-2.5">
                        <div className="text-[10px] font-extrabold text-blue-500 mb-1">조건 성공 시</div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-bold text-gray-700">{nodes.find(n => outgoing.find(e => !e.isFallback && e.to === n.nodeKey))?.label ?? node.branchLabel}</span>
                        </div>
                      </div>
                      <div className="rounded-[12px] bg-gray-50 px-4 py-2.5">
                        <div className="text-[10px] font-extrabold text-gray-400 mb-1">조건 실패 시</div>
                        <div className="text-[11px] font-bold text-gray-700">{nodes.find(n => outgoing.find(e => e.isFallback && e.to === n.nodeKey))?.label ?? node.fallbackLabel}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {outgoing.map(e => {
                        const tgt = nodes.find(n => n.nodeKey === e.to)
                        return (
                          <div key={e.id} className="flex items-center gap-2 rounded-[12px] bg-gray-50 px-4 py-2.5">
                            <span className="text-[11px] font-extrabold text-blue-500">→</span>
                            <span className="text-[12px] font-bold text-gray-700">{tgt?.label ?? e.to}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        )
      })()}

      {/* bottom-left controls + minimap */}
      <div className="absolute bottom-3 left-3 z-10 space-y-1.5" onPointerDown={e=>e.stopPropagation()} onWheel={e=>e.stopPropagation()}>
        {/* minimap */}
        {/* minimap */}
        <div className="overflow-hidden rounded-[12px] border border-gray-200 bg-white/90 shadow-sm" style={{width:mmW,height:mmH}}>
          <svg width={mmW} height={mmH}>
            {nodes.map(n=>(
              <rect key={n.id} x={toMX(n.positionX)} y={toMY(n.positionY)}
                width={NODE_W*mmScale} height={nodeH(n)*mmScale} rx={3}
                fill={n.id==='trigger'?'#93c5fd':'#cbd5e1'} />
            ))}
            <rect x={mmVp.x} y={mmVp.y} width={mmVp.w} height={mmVp.h} rx={4}
              fill="rgba(49,130,246,0.10)" stroke="#3182F6" strokeWidth="1.5" />
          </svg>
        </div>
        {/* zoom controls */}
        <div className="flex items-center divide-x divide-gray-200 overflow-hidden rounded-[14px] border border-gray-200 bg-white/90 shadow-sm backdrop-blur" style={{width:mmW}}>
          <div className="flex flex-1 items-center justify-center gap-0.5 px-1">
            <button type="button" onClick={()=>setZoom(z=>clampZoom(z-0.1))} className="flex h-7 w-7 items-center justify-center rounded-[8px] text-gray-600 hover:bg-gray-100"><Minus className="h-3.5 w-3.5"/></button>
            <span className="w-10 text-center text-[11px] font-extrabold text-gray-700">{Math.round(zoom*100)}%</span>
            <button type="button" onClick={()=>setZoom(z=>clampZoom(z+0.1))} className="flex h-7 w-7 items-center justify-center rounded-[8px] text-gray-600 hover:bg-gray-100"><Plus className="h-3.5 w-3.5"/></button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────

function LabPanel({ mode, onModeChange, titleVariant = 'rules' }: LabPanelProps) {
  const [toggles, setToggles] = useState<Record<string, boolean>>(
    Object.fromEntries(FUNCTIONS.map(f => [f.key, true]))
  )
  const [knowledgeToggles, setKnowledgeToggles] = useState<Record<string, boolean>>(
    Object.fromEntries(KNOWLEDGE_DOC_IDS.map((id) => [id, true])),
  )
  const [open, setOpen] = useState<string | null>(FUNCTIONS[0].key)
  const [flash, setFlash] = useState(false)

  function handleToggle(key: string) {
    setToggles(prev => ({ ...prev, [key]: !prev[key] }))
  }

  function handleOpen(key: string) {
    setOpen(prev => (prev === key ? null : key))
  }

  function handleMode(m: 'before' | 'after') {
    onModeChange(m)
    setFlash(false)
    setTimeout(() => setFlash(true), 10)
    setTimeout(() => setFlash(false), 510)
  }

  const preview = {
    rules: {
      label: '',
      userMsg: '화장실 청소도 되나요? 환불 규정이랑 연락처도 알려주세요.',
      beforeLabel: '⚠ 규칙 미적용',
      beforeContent: BEFORE_TEXT,
      afterLabel: '✦ AI 답변',
      afterContent: buildAfterAnswer(toggles),
    },
    knowledge: {
      label: '',
      userMsg: '청소 범위랑 취소 정책 알려주세요',
      beforeLabel: '⚠ 지식 미참조',
      beforeContent: '정확한 안내를 드리기 어렵습니다. 담당 직원 확인 후 연락 드리겠습니다.',
      afterLabel: '✦ AI 답변',
      afterContent: buildKnowledgeAnswer(knowledgeToggles),
    },
    tasks: {
      label: '',
      userMsg: '청소 예약 확인하고 싶어요',
      beforeLabel: '⚠ 태스크 미적용',
      beforeContent: '예약 확인은 직접 방문하거나 전화로 문의해 주세요.',
      afterLabel: '✦ AI 답변',
      afterContent: buildTasksAnswer(toggles),
    },
  }[titleVariant]

  return (
    <div className="grid min-h-[clamp(320px,34vw,440px)] grid-cols-[1.4fr_0.8fr] items-stretch gap-[clamp(16px,2.5vw,34px)] max-[700px]:min-h-[auto] max-[700px]:grid-cols-1 max-[700px]:gap-4">
      {/* LEFT: panel */}
      <div
        className={`relative overflow-hidden flex flex-col justify-center rounded-[clamp(16px,1.8vw,26px)] !shadow-[inset_0_1px_0_rgba(255,255,255,.5)] max-[700px]:rounded-[18px] ${titleVariant === 'tasks' ? '' : 'py-[18px] max-[700px]:py-3.5'} ${titleVariant === 'knowledge' ? 'items-center px-[8%]' : titleVariant === 'tasks' ? 'p-0' : 'px-[19%] max-[700px]:px-[6%]'}`}
        style={{
          background: titleVariant === 'tasks' ? undefined : {
            rules: 'linear-gradient(160deg,#dde6f7 0%,#c9d8f2 55%,#eef2fb 100%)',
            knowledge: 'linear-gradient(160deg,#dceee1 0%,#c7e2d2 55%,#eaf5ec 100%)',
          }[titleVariant as 'rules' | 'knowledge'],
        }}
      >
        {titleVariant !== 'tasks' && <>
          {/* White diagonal sheen */}
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.38)_0%,rgba(255,255,255,0.12)_28%,transparent_48%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_60%,rgba(255,255,255,0.1)_100%)]" />
          <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 360 300" xmlns="http://www.w3.org/2000/svg">
            <path d="M88,232 C52,218 32,192 28,162 C18,138 24,108 42,93 C47,72 63,54 88,50 C102,30 128,22 154,28 C173,18 198,23 218,39 C238,28 262,36 275,57 C300,57 318,80 315,107 C333,120 340,148 330,170 C342,192 336,222 310,234 C292,255 264,262 238,251 C218,264 192,266 172,256 C152,270 124,266 106,252 C97,249 91,242 88,232 Z" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M105,115 C118,98 140,105 142,125" fill="none" stroke="rgba(255,255,255,0.13)" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M158,68 C176,58 200,68 198,88" fill="none" stroke="rgba(255,255,255,0.13)" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M240,80 C258,68 280,82 276,105" fill="none" stroke="rgba(255,255,255,0.13)" strokeWidth="1.2" strokeLinecap="round" />
            <g stroke="rgba(255,255,255,0.16)" strokeWidth="1" fill="none">
              <line x1="128" y1="112" x2="170" y2="88" /><line x1="170" y1="88" x2="208" y2="78" /><line x1="208" y1="78" x2="248" y2="94" /><line x1="248" y1="94" x2="280" y2="120" />
              <line x1="128" y1="112" x2="152" y2="142" /><line x1="152" y1="142" x2="198" y2="124" /><line x1="198" y1="124" x2="248" y2="94" /><line x1="198" y1="124" x2="220" y2="158" />
              <line x1="220" y1="158" x2="268" y2="160" /><line x1="220" y1="158" x2="172" y2="178" /><line x1="172" y1="178" x2="136" y2="162" /><line x1="152" y1="142" x2="136" y2="162" />
              <line x1="268" y1="160" x2="248" y2="192" /><line x1="172" y1="178" x2="192" y2="210" /><line x1="280" y1="120" x2="268" y2="160" /><line x1="170" y1="88" x2="198" y2="124" />
              <line x1="128" y1="112" x2="198" y2="124" /><line x1="248" y1="94" x2="220" y2="158" /><line x1="136" y1="162" x2="172" y2="178" /><line x1="192" y1="210" x2="248" y2="192" /><line x1="208" y1="78" x2="198" y2="124" />
            </g>
            <circle cx="128" cy="112" r="5.5" fill="rgba(255,255,255,0.28)" /><circle cx="170" cy="88" r="5.5" fill="rgba(255,255,255,0.28)" /><circle cx="208" cy="78" r="5" fill="rgba(255,255,255,0.24)" />
            <circle cx="248" cy="94" r="5.5" fill="rgba(255,255,255,0.28)" /><circle cx="280" cy="120" r="5" fill="rgba(255,255,255,0.24)" /><circle cx="152" cy="142" r="6" fill="rgba(255,255,255,0.30)" />
            <circle cx="198" cy="124" r="7" fill="rgba(255,255,255,0.32)" /><circle cx="220" cy="158" r="6" fill="rgba(255,255,255,0.28)" /><circle cx="268" cy="160" r="5" fill="rgba(255,255,255,0.24)" />
            <circle cx="172" cy="178" r="5.5" fill="rgba(255,255,255,0.28)" /><circle cx="136" cy="162" r="5" fill="rgba(255,255,255,0.24)" /><circle cx="248" cy="192" r="5" fill="rgba(255,255,255,0.22)" /><circle cx="192" cy="210" r="5" fill="rgba(255,255,255,0.22)" />
          </svg>
        </>}
        {titleVariant === 'tasks' ? (
          <FlowBuilder />
        ) : (
        <div
          className={`relative z-10 mx-auto w-full overflow-hidden ${titleVariant === 'knowledge' ? 'max-w-[90%] shrink-0 self-center' : 'max-w-[96%]'} ${titleVariant !== 'rules' ? '!border !border-[rgba(0,0,0,.06)] rounded-[clamp(12px,1.3vw,18px)] bg-white !shadow-[0_4px_24px_-8px_rgba(22,25,31,.18)]' : ''}`}
        >
          {titleVariant === 'knowledge' ? (
            <FunctionsKnowledgePanel
              docEnabled={knowledgeToggles}
              onDocToggle={(docId) =>
                setKnowledgeToggles((prev) => ({ ...prev, [docId]: !prev[docId] }))
              }
            />
          ) : (
            /* 규칙 카드 (실제 RuleCard 스타일) */
            <div className="flex flex-col gap-2.5 p-3">
              {RULE_ITEMS.map(rule => (
                <div
                  key={rule.key}
                  className="overflow-hidden rounded-[20px] border border-[rgba(0,0,0,0.07)] bg-white pl-5 pr-4 shadow-[0_1px_4px_rgba(0,0,0,0.04)]"
                >
                  <div className="flex min-w-0 items-center justify-between gap-3 py-3.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-[13.5px] font-bold text-gray-900">{rule.label}</span>
                        {rule.isBuiltin && (
                          <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500">기본 제공</span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-[11.5px] font-semibold text-gray-400">{rule.instruction[0]}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2.5">
                      <Toggle
                        enabled={toggles[rule.key] ?? rule.active}
                        onChange={() => handleToggle(rule.key)}
                        size="sm"
                      />
                      {/* 펼치기 */}
                      <button
                        className={`flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-gray-500 transition-all duration-200 hover:bg-gray-100 ${open === rule.key ? 'rotate-180' : ''}`}
                        onClick={() => handleOpen(rule.key)}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  {/* 펼침 영역 */}
                  <div className={`grid transition-all duration-300 ease-in-out ${open === rule.key ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                    <div className="overflow-hidden">
                      <div className="border-t border-gray-100 py-3.5 pr-1">
                        <ul className="space-y-1">
                          {rule.instruction.map((line, i) => (
                            <li key={i} className="flex gap-2 text-[12px] font-semibold leading-[1.65] text-gray-600">
                              <span className="shrink-0 text-gray-400">-</span>
                              <span>{line}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        )}
      </div>

      {/* RIGHT: preview */}
      <div
        className={`relative flex flex-col overflow-hidden rounded-[clamp(14px,1.5vw,20px)] p-[clamp(14px,1.7vw,24px)] transition-colors duration-300 ${
          mode === 'after'
            ? 'bg-[#e9f1fe]'
            : 'bg-[#ebebeb]'
        }`}
        style={{
          backgroundImage: `radial-gradient(circle, ${mode === 'after' ? 'rgba(49,130,246,0.10)' : 'rgba(0,0,0,0.07)'} 0.7px, transparent 0.7px)`,
          backgroundSize: '10px 10px',
        }}
      >
        {preview.label && <div className="mb-3 text-[clamp(10px,0.85vw,12px)] font-bold text-[var(--muted)]">{preview.label}</div>}
        <div
          className="ml-auto max-w-[88%] rounded-2xl rounded-br-[5px] border border-[rgba(0,0,0,.15)] bg-transparent px-[clamp(10px,1vw,15px)] py-[clamp(9px,0.85vw,12px)] text-[clamp(12px,1.05vw,14px)] text-[#1a1a1a]"
        >
          {preview.userMsg}
        </div>
        <div
          className={`${labAClass} transition-all duration-300${mode === 'after' ? ' !border-[rgba(49,130,246,0.16)] !bg-[#f3f8ff]' : ' !border-[rgba(0,0,0,.09)] !bg-white text-[#5a5a5a]'}`}
        >
          <div
            key={mode}
            className="animate-[fadeSlideIn_0.28s_ease]"
            style={{ animationFillMode: 'both' }}
          >
            {mode === 'before' ? (
              <>
                {preview.beforeContent}
              </>
            ) : (
              <>{preview.afterContent}</>
            )}
          </div>
        </div>

        {/* Before / After tabs */}
        <div className="mt-auto pt-[clamp(10px,1.2vw,16px)]">
          <div className="flex justify-center">
            <div className="relative flex rounded-full bg-[#ececee] p-[3px]" style={{ gap: 0 }}>
              {/* 슬라이딩 인디케이터 */}
              <div
                className="absolute top-[3px] bottom-[3px] left-[3px] rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.08)] transition-transform duration-200 ease-in-out"
                style={{ width: 'calc(50% - 3px)', transform: mode === 'after' ? 'translateX(calc(100% + 3px))' : 'translateX(0)' }}
              />
              <button
                className={`relative z-10 cursor-pointer rounded-full px-5 py-[6px] text-[14px] font-semibold transition-colors duration-200 [font-family:inherit] ${
                  mode === 'before' ? 'text-[#1b1c1e]' : 'text-[#6a6f76]'
                }`}
                onClick={() => handleMode('before')}
              >
                Before
              </button>
              <button
                className={`relative z-10 cursor-pointer rounded-full px-5 py-[6px] text-[14px] font-semibold transition-colors duration-200 [font-family:inherit] ${
                  mode === 'after' ? 'text-[#3182F6]' : 'text-[#6a6f76]'
                }`}
                onClick={() => handleMode('after')}
              >
                After
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

interface Section3Props {
  titleVariant?: 'rules' | 'knowledge' | 'tasks'
}

export default function Section3({ titleVariant = 'rules' }: Section3Props) {
  const titles: Record<string, string> = {
    rules: "설정한 맞춤 규칙을 따르는 AI",
    knowledge: "정교한 답변을 위한 지식 등록",
    tasks: "벗어나는 AI를 설계하는 태스크",
  }

  const leads: Record<string, string> = {
    rules: "기업이 정한 규칙을 반영하고, 그에 맞는 답변을 하도록 설정합니다.",
    knowledge: "필요한 지식을 등록하고, AI가 정확한 정보를 바탕으로 답변하도록 합니다.",
    tasks: "AI가 수행할 태스크를 정의하고, 설정된 방식으로 처리되도록 설정합니다.",
  }

  const subTitles: Record<string, string> = {
    rules: "규칙 설정",
    knowledge: "지식 등록",
    tasks: "태스크 설정",
  }

  const sectionLabels: Record<string, string> = {
    rules: "규칙",
    knowledge: "지식",
    tasks: "태스크",
  }

  const subDescs: Record<string, string> = {
    rules: "문의 유형이나 서비스 정책에 따라 규칙을 추가하거나 변경하여 원하는 상담 품질을 유지할 수 있습니다.",
    knowledge: "자주 묻는 질문이나 제품 정보를 등록해 AI가 정확하게 안내할 수 있도록 합니다.",
    tasks: "특정 요청에 대해 AI가 일관된 방식으로 처리하도록 태스크를 추가하거나 변경할 수 있습니다.",
  }

  const beforeLabels: Record<string, string> = {
    rules: "규칙이 없을 때",
    knowledge: "지식이 없을 때",
    tasks: "태스크가 없을 때",
  }

  const beforeDescs: Record<string, string> = {
    rules: "통제와 규칙 없이 작동하는 AI는 혼란과 위험을 만듭니다",
    knowledge: "등록된 지식 없이는 AI가 부정확하거나 일관성 없는 답변을 합니다",
    tasks: "태스크 없이는 AI가 제각각 다른 방식으로 요청을 처리합니다",
  }

  const afterLabels: Record<string, string> = {
    rules: "규칙이 있을 때",
    knowledge: "지식이 있을 때",
    tasks: "태스크가 있을 때",
  }

  const afterDescs: Record<string, string> = {
    rules: "규칙 안에서 AI가 일관되고 안전하게 답변합니다",
    knowledge: "등록된 지식을 바탕으로 AI가 정확하고 신뢰할 수 있는 답변을 제공합니다",
    tasks: "정의된 태스크에 따라 AI가 일관된 방식으로 요청을 처리합니다",
  }

  const sectionId = FUNCTIONS_ANCHOR_IDS[titleVariant]
  const [mode, setMode] = useState<'before' | 'after'>('before')

  return (
    <section className={`${pageSectionShell} relative sm:overflow-hidden`} id={sectionId}>
      {/* White diagonal gradient decorations */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute -left-24 -top-32 h-[420px] w-[700px] rotate-[22deg] bg-[linear-gradient(to_right,rgba(255,255,255,0.09),transparent)]" />
        <div className="absolute -bottom-32 right-0 h-[360px] w-[580px] rotate-[22deg] bg-[linear-gradient(to_left,rgba(255,255,255,0.06),transparent)]" />
      </div>
    <div className={`${sectionClass}`}>
      <div className={pageSectionLabelClass}>{sectionLabels[titleVariant]}</div>
      <h2 className={pageSectionTitleClass}>{titles[titleVariant]}</h2>
      <p className={pageSectionLeadClass}>
        {leads[titleVariant]}
      </p>
      <LabPanel mode={mode} onModeChange={setMode} titleVariant={titleVariant} />

      <div className="mt-7 grid grid-cols-[1.4fr_0.8fr] gap-[clamp(24px,4vw,48px)] pt-6 max-[700px]:grid-cols-1 max-[700px]:gap-5">
        <div className="pl-4">
          <div className="mb-2.5 text-xl font-bold text-[var(--ink)] max-[700px]:text-lg">{subTitles[titleVariant]}</div>
          <p className={labMetaDescClass}>{subDescs[titleVariant]}</p>
        </div>
        <div className="flex flex-col gap-2.5 pl-4">
          {mode === 'before' ? (
            <>
              <div className="inline-flex items-center gap-2.5 text-xl font-bold text-[var(--ink)] max-[700px]:text-lg">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                </svg>
                {beforeLabels[titleVariant]}
              </div>
              <p className={labMetaDescClass}>{beforeDescs[titleVariant]}</p>
            </>
          ) : (
            <>
              <div className="inline-flex items-center gap-2.5 text-xl font-bold text-[var(--ink)] max-[700px]:text-lg">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="7 12.5 10.5 16 17 9" />
                </svg>
                {afterLabels[titleVariant]}
              </div>
              <p className={labMetaDescClass}>{afterDescs[titleVariant]}</p>
            </>
          )}
        </div>
      </div>
    </div>
    </section>
  )
}
