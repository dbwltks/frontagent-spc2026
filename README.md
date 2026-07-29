# Callbee

AI 고객 응대 & 예약 자동화 플랫폼의 프론트엔드입니다. 랜딩 페이지, 실시간 AI 음성 통화 위젯, 그리고 상담원/운영자를 위한 관리자 콘솔(AI 에이전트 설정, 고객 응대함, 팀 관리)을 하나의 Next.js 앱으로 제공합니다.

## 목차

- [주요 기능](#주요-기능)
- [기술 스택](#기술-스택)
- [프로젝트 구조](#프로젝트-구조)
- [시작하기](#시작하기)
- [환경 변수](#환경-변수)
- [스크립트](#스크립트)
- [아키텍처 노트](#아키텍처-노트)

## 주요 기능

- **랜딩 페이지** — 서비스 소개, 기능 하이라이트, RAG/개발자 API 안내 등 마케팅 섹션 (`components/home`)
- **AI 음성 통화 위젯** — 브라우저에서 바로 AI 에이전트와 음성 통화를 시작하는 플로팅 위젯. `@ricky0123/vad-web`(Silero VAD) 기반의 실시간 음성 감지로 발화 시작/종료와 AI 끼어들기(barge-in)를 처리 (`components/home/floating/CallTab.tsx`)
- **관리자 콘솔** (`/admin`)
  - **AI 에이전트 관리** — 규칙(Rules), 지식(Knowledge), 태스크 플로우 빌더, 실행 로그(Agent Runs), 에이전트 설정
  - **고객 응대함(Inbox)** — 대화, 고객, 예약, 캠페인, 아웃바운드, 통화 이력 관리
  - **팀 관리**
- **에이전트 API 프록시** — 백엔드 Agent API로의 요청을 프록시하며, SSE(Server-Sent Events) 스트리밍 응답을 버퍼링 없이 그대로 전달 (`app/agent-api/[...path]/route.ts`)

## 기술 스택

| 영역 | 사용 기술 |
| --- | --- |
| 프레임워크 | Next.js 16 (App Router), React 19, TypeScript |
| 스타일링 | Tailwind CSS 4 |
| UI 컴포넌트 | Radix UI, lucide-react, react-icons, motion(Framer Motion) |
| 데이터 | Supabase (`@supabase/supabase-js`), SWR |
| 음성/AI | `@ricky0123/vad-web` (Silero VAD, ONNX Runtime Web) |
| 기타 | dnd-kit (드래그 앤 드롭) |
| 패키지 매니저 | pnpm |

## 프로젝트 구조

```
app/
  page.tsx                  # 랜딩 페이지
  admin/
    ai/[section]/           # AI 에이전트 관리 (규칙/지식/태스크/로그/설정)
    inbox/[section]/        # 고객 응대함
    team/                   # 팀 관리
  agent-api/[...path]/      # 백엔드 Agent API 프록시 (SSE 스트리밍 지원)
components/
  home/                     # 랜딩 페이지 및 플로팅 통화 위젯
  admin/                    # 관리자 콘솔 (ai/, inbox/)
  ui/                       # 공용 UI 컴포넌트
lib/                        # Supabase 클라이언트, SSE 유틸, 세션/조직 헬퍼
scripts/
  copy-vad-assets.mjs       # 빌드 시 VAD(ONNX) 에셋을 public/vad로 복사
```

## 시작하기

### 요구 사항

- Node.js 20+
- pnpm 11.7.0 (`packageManager` 필드로 고정됨)

### 설치 및 실행

```bash
pnpm install
pnpm dev
```

[http://localhost:3000](http://localhost:3000) 에서 확인할 수 있습니다.

> `postinstall`/`build` 스크립트가 자동으로 VAD(Silero) 및 ONNX Runtime 에셋을 `public/vad`에 복사합니다.

### 프로덕션 빌드

```bash
pnpm build
pnpm start
```

## 환경 변수

프로젝트 루트에 `.env`(또는 `.env.local`) 파일을 생성하고 아래 값을 채워주세요.

| 변수명 | 설명 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL (클라이언트 노출) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (클라이언트 노출) |
| `SUPABASE_URL` | Supabase 프로젝트 URL (서버 전용) |
| `SUPABASE_ANON_KEY` | Supabase anon key (서버 전용) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key — **서버 전용, 절대 클라이언트에 노출 금지** |
| `NEXT_PUBLIC_AGENT_API_URL` | 프론트엔드에서 사용하는 Agent API 베이스 URL |
| `NEXT_PUBLIC_AGENT_ORGANIZATION_ID` | 기본 조직(organization) ID |
| `AGENT_API_PROXY_TARGET` | `/agent-api` 프록시가 전달할 백엔드 Agent API 주소 |
| `GOOGLE_CLOUD_CLIENT_ID` | Google OAuth 클라이언트 ID |
| `GOOGLE_CLOUD_CLIENT_SECRET` | Google OAuth 클라이언트 시크릿 |

## 스크립트

| 명령어 | 설명 |
| --- | --- |
| `pnpm dev` | 개발 서버 실행 |
| `pnpm build` | VAD 에셋 복사 후 프로덕션 빌드 |
| `pnpm start` | 프로덕션 서버 실행 |
| `pnpm lint` | ESLint 검사 |
| `pnpm copy-vad` | VAD/ONNX 에셋을 `public/vad`로 수동 복사 |

## 아키텍처 노트

- **SSE 스트리밍 프록시**: Next.js의 `rewrites`는 응답을 버퍼링하므로, `/agent-api/[...path]/route.ts`에서 Route Handler로 직접 스트림을 청크 단위로 릴레이하여 Agent API의 실시간 응답 지연을 방지합니다.
- **COOP/COEP 헤더**: `next.config.ts`에서 전체 페이지에 `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: require-corp`를 적용합니다. iOS Safari에서 VAD(WASM 멀티스레딩)가 정상 동작하려면 필수입니다.
- **음성 통화 위젯**: iOS 환경에서는 마이크 `autoGainControl`을 비활성화하고, AI 발화 중에도 사용자가 끼어들 수 있도록 VAD를 유지하는 등 브라우저별 음성 처리 이슈를 개별 대응하고 있습니다.
