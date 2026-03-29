# XG5000 Assistant Console — CLAUDE.md

Electron 기반 XG5000 PLC 현장 어시스턴트 데스크톱 콘솔. Windows 현장 엔지니어가 XG5000 V3.1 기준 절차 안내, 에러 코드 해석, PLC 연결 상태 조회, 실시간 모니터링을 단일 워크스페이스에서 처리할 수 있도록 설계됨.

## 기술 스택

- **Electron 38** + **React 19** + **TypeScript** + **Vite (electron-vite)**
- **SQLite** (`better-sqlite3`) — 로컬 영구 저장소
- **node-opcua 2.158** — OPC UA 실장비 통신
- **Zod** — IPC 입력값 런타임 검증
- **Vitest** (단위) + **Playwright** (E2E)

## 3-프로세스 아키텍처

```
Main Process (Node)          Preload Script              Renderer (React)
src/main/                    src/preload/index.ts        src/renderer/
  ├─ index.ts                contextBridge.exposeIn       App.tsx
  ├─ ipc/                    MainWorld('xg5000', api)     features/ (8 screens)
  ├─ db/                                                  hooks/
  ├─ services/
  ├─ adapters/
  └─ parsers/
```

Renderer는 Node에 직접 접근 불가. 모든 통신은 `window.xg5000.*` IPC 채널을 통해서만 이루어짐.

## 주요 서비스 (src/main/services/)

| 서비스 | 역할 |
|--------|------|
| `AssistantService` | 쿼리 분류 → 규칙 기반 응답 → LLM 보강(옵션) |
| `KnowledgeBaseService` | 토크나이즈 키워드 점수 기반 지식 검색 |
| `PlcSessionService` | 프로파일 CRUD, 연결/해제, 상태 폴링, 구독 관리 |
| `FileSyncService` | 파일 감시, 해시 변경 감지, CSV/프로젝트 파싱, 동기화 작업 추적 |
| `DesktopCompanionService` | 클립보드 캡처, 글로벌 단축키, always-on-top, 컴팩트 모드 |
| `OpcUaArtifactService` | OPC UA 인증서 관리 (trusted/rejected/issuer/own 저장소) |
| `OpcUaPresetLibraryService` | 노드 브라우저 스냅샷 저장/가져오기/내보내기 |
| `BootstrapService` | 앱 초기 상태 집계 (대시보드 메트릭, 프로파일, 세션, 스냅샷) |
| `RuntimeRecoveryService` | 앱 시작 시 자동 재연결 및 모니터 복구 |
| `WorkspaceStateService` | 화면/프로파일/프로젝트 상태 SQLite 영속화 |
| `AuditService` | 감사 로그 및 모니터 스냅샷 JSON 내보내기 |

## 어댑터 (src/main/adapters/)

- **`PlcAdapter`** (추상 인터페이스) — `connect`, `disconnect`, `readStatus`, `readDevices`, `subscribeMonitor`
- **`SimulatedPlcAdapter`** — 테스트용 시뮬레이터 (현재 기본값)
- **`LsOpcUaBridgeAdapter`** — node-opcua 기반 실장비 연동; 브라우징, 디바이스 자동 탐색, 벤더 프리셋 생성
- **`LsOpcUaDiscovery`** — CPU 패밀리 감지 (XGR/XGL/XGP), 노드 패턴 제안, 프리셋 빌드
- **`OpcUaSessionPool`** — OPC UA 세션 풀링 (타임아웃/재시도)
- **`OpenAICompatibleProvider`** — Responses API `/v1/responses` 엔드포인트 사용 LLM 클라이언트

## 파서 (src/main/parsers/)

- **`Xg5000ProjectParser`** — ZIP/XML 파싱, EUC-KR 인코딩 처리, 프로그램·변수 추출
- **`VariableCsvParser`** — 한국어 헤더 별칭 감지, 다중 인코딩 폴백 (UTF-8, EUC-KR, CP949)
- **`ProjectSnapshotParser`** — 파일 해시 포함 ProjectSnapshot 생성, 실패 시 `manual-review` 폴백

## 데이터베이스 스키마 (src/main/db/database.ts)

SQLite 테이블:

| 테이블 | 용도 |
|--------|------|
| `manual_chunks` | 지식베이스 항목 (제목, 섹션, 카테고리, 키워드) |
| `error_codes` | 에러 코드 라이브러리 |
| `assistant_sessions` | 채팅 이력 |
| `bookmarks` | 사용자 북마크 |
| `plc_profiles` | 연결 프로파일 |
| `monitor_snapshots` | 상태 이력 스냅샷 |
| `project_snapshots` | 동기화된 프로젝트 메타데이터 |
| `variable_snapshots` | 동기화된 변수 목록 |
| `sync_jobs` | 파일 동기화 작업 로그 |
| `sync_config` | 폴더 감시 설정 |
| `clipboard_captures` | 캡처된 텍스트 스니펫 |
| `opcua_discovery_cache` | 브라우징된 노드 트리 |
| `opcua_preset_library` | 재사용 가능한 벤더 프리셋 |
| `settings` | 키-값 저장소 (UI 설정, 워크스페이스 상태) |
| `audit_logs` | 전체 작업 감사 로그 |

## IPC 계약 (src/shared/contracts.ts)

### 핵심 채널 (invoke)

| 채널 | 목적 |
|------|------|
| `app.bootstrap` | 초기 앱 상태 |
| `assistant.ask` | 어시스턴트 질의 |
| `kb.search` | 지식베이스 검색 |
| `error.lookup` | 에러 코드 조회 |
| `project.import` | 프로젝트 파일 가져오기 |
| `plc.profile.save` | 프로파일 저장 |
| `plc.connect` / `plc.disconnect` | 연결/해제 |
| `plc.status.read` | 상태 읽기 |
| `plc.monitor.subscribe` | 모니터 구독 |
| `plc.privileged.request` | 고위험 제어 요청 (승인 필요) |
| `plc.opcua.certificates.*` | 인증서 목록/가져오기/신뢰/거부 |
| `plc.discovery.read` | 노드 탐색 캐시 읽기 |
| `plc.preset-library.*` | 프리셋 목록/저장/가져오기/내보내기 |
| `sync.config.save` / `sync.status.read` | 동기화 설정 |
| `workspace.state.save` | 워크스페이스 상태 저장 |
| `audit.export` | 감사 로그 내보내기 |
| `bookmark.*` | 북마크 CRUD |

### 이벤트 채널 (one-way, Main → Renderer)

| 채널 | 페이로드 |
|------|----------|
| `plc.monitor.event` | `PlcStatusSnapshot` |
| `desktop.command.event` | `DesktopCommandEvent` |

## 렌더러 화면 (src/renderer/src/features/)

| 화면 | 주요 기능 |
|------|----------|
| **Dashboard** | 메트릭, 최근 세션, 추천, 빠른 액세스 |
| **Assistant** | Q&A, 절차 단계, 인용, 실시간 PLC 컨텍스트, Quick Ask 오버레이 |
| **PLC** | 프로파일 편집, 연결, 인증서 관리, 노드 탐색, 프리셋 라이브러리, 고위험 요청 |
| **Error Center** | 에러 코드 검색, 관련 지식 표시 |
| **Project Browser** | 프로젝트 스냅샷, 변수 브라우저 |
| **Monitor Trace** | 실시간 상태, 알람, 사이클 타임, 모드 |
| **Settings** | 동기화 설정, UI 설정, 라이선스, 감사 내보내기 |

## 테스트 현황

**단위 테스트 (vitest):** 13개 파일, 29개 테스트 — 모두 통과

| 테스트 파일 | 커버리지 |
|------------|---------|
| `ls-opcua-bridge.test.ts` | OPC UA 어댑터, 구독 라이프사이클, 디바이스 탐색 |
| `xg5000-project-parser.test.ts` | ZIP/XML 파싱, 인코딩 감지 |
| `plc-session-service.test.ts` | 연결/해제, 모니터 구독, 고위험 요청 검증 |
| `opcua-artifact-service.test.ts` | 인증서 이동, 핑거프린트 검증 |
| `assistant-service.test.ts` | 쿼리 분류, 규칙 엔진, 컨텍스트 주입 |
| `file-sync-service.test.ts` | 파일 감시, 해시 감지, 파서 호출 |
| 기타 7개 | 개별 서비스 동작 검증 |

**E2E 테스트 (playwright):** `tests/e2e/desktop-flow.spec.ts`

## 환경 변수

| 변수 | 기본값 | 용도 |
|------|--------|------|
| `OPENAI_API_KEY` | — | LLM 보강 활성화 (없으면 규칙 기반만 사용) |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | API 엔드포인트 |
| `OPENAI_MODEL` | `gpt-4.1-mini` | 모델 선택 |
| `XG5000_USER_DATA_DIR` | OS 기본값 | 앱 데이터 디렉터리 오버라이드 |

## 현재 구현 상태 및 제한사항

- 실 PLC 어댑터는 `SimulatedPlcAdapter`로 동작 중 (실장비 연결 시 `LsOpcUaBridgeAdapter`로 교체 가능)
- `program-write`, `force-io`, `mode-change` 는 승인 구조만 구현, 실제 실행은 비활성
- XG5000 프로젝트 파일 파싱은 실패 시 `manual-review` 상태로 폴백
- LLM 연동은 OpenAI Responses API (`/v1/responses`) 기준, 키 없으면 비활성

## 빌드 및 실행

```bash
pnpm install
pnpm dev              # 개발 서버
pnpm dev:wsl          # WSL 환경 (DISPLAY=:0)
pnpm build            # 프로덕션 빌드 → out/
pnpm test             # 단위 테스트
pnpm test:e2e         # E2E 테스트
```

## 다음 로드맵 (docs/b-option-roadmap.md 참고)

- Phase 1: 파일 동기화 인프라 ✅ (완료)
- Phase 2: UX 향상 (always-on-top, 컴팩트 모드, 글로벌 단축키) ✅ (완료)
- Phase 3: 프로젝트-쿼리 연결 (컨텍스트 주입, 변수 기반 제안) ✅ (완료)
- Phase 4: 실 PLC 어댑터 연동 (읽기 중심, 다중 드라이버)
- Phase 5: 운영 강화 (자동 복구, 세션 복원, 감사 추적) ✅ (구조 완성)
