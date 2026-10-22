# Codex MCP 브릿지

Claude Code에서 `codex` 도구로 OpenAI Codex CLI를 호출하게 해 주는 작은 MCP 서버입니다.
Codex는 ChatGPT 계정(Plus 등)으로 로그인한 상태를 그대로 사용하므로 API 키가 필요 없습니다.
이 서버는 로그인 정보를 읽거나 저장하지 않습니다.

Codex CLI 0.163.0에는 `codex mcp-server`가 없어서(`codex mcp`는 Codex가 다른 MCP 서버를 쓰는 쪽입니다) `codex exec`를 감싸는 방식으로 만들었습니다.

## 도구

| 도구 | 하는 일 |
|------|---------|
| `codex` | 프롬프트 하나를 Codex에 실행시키고 최종 답변과 세션 id를 돌려줌 |
| `codex_reply` | 이전 실행에 이어서 질문. `session_id`를 생략하면 같은 폴더의 가장 최근 실행을 이어감 |
| `codex_status` | Codex 버전과 로그인 상태 확인. 호출이 실패하면 가장 먼저 사용 |

Codex는 이 대화를 기억하지 못하므로 프롬프트에 필요한 맥락을 모두 넣어야 합니다.
답변은 다른 AI 모델의 의견이므로 검증이 필요한 조언으로 다루도록 도구 설명에 명시해 두었습니다.

## 안전 장치

- 샌드박스 기본값은 `read-only`입니다. 파일 수정이 필요할 때만 `workspace-write`를 지정합니다. `danger-full-access`는 노출하지 않습니다.
- 작업 폴더는 허용 목록 안으로 제한합니다(`CODEX_MCP_ROOTS`, 기본값은 서버를 시작한 폴더). 심볼릭 링크는 실제 경로로 풀어서 검사합니다.
- 실행당 타임아웃(기본 600초, 최대 1800초), 답변 길이 상한, 동시 실행 2개 제한이 있습니다.
- 프롬프트는 명령행 인자가 아니라 표준 입력으로 전달해서 `-`로 시작하는 문장이 옵션으로 해석되지 않습니다. `session_id`는 UUID만 받습니다.

## 설치: 내 PC의 Claude Code

```bash
npm i -g @openai/codex
codex login                      # 브라우저가 열리고 ChatGPT 계정으로 로그인
codex login status               # "Logged in using ChatGPT" 확인

cd tools/codex-mcp && npm ci
claude mcp add --scope user --env CODEX_MCP_ROOTS=/내/작업/폴더 codex -- node /절대경로/tools/codex-mcp/server.mjs
```

그다음 Claude Code에서 "codex_status 도구를 실행해 줘"라고 요청해 로그인 상태를 확인합니다.
로그인 정보는 PC의 `~/.codex/auth.json`에만 있습니다.

## 설치: 클라우드 세션 (이 저장소를 여는 웹/앱 세션)

컨테이너가 임시라서 PC보다 손이 더 갑니다. 아래는 문서와 검색 결과 기준이며 이 환경에서 끝까지 실행해 보지는 못했습니다.

1. 환경 설정의 Network access에서 `auth.openai.com`, `chatgpt.com`, `api.openai.com`을 허용합니다. 이 세 곳이 전부인지는 확인하지 못했습니다. 연결 오류가 나면 해당 호스트를 추가합니다.
2. ChatGPT 보안 설정에서 device code 로그인을 켭니다(개인 계정은 직접 설정, 워크스페이스 계정은 관리자 설정).
3. 환경의 Setup script에서 Codex와 이 서버의 의존성을 설치합니다.
   ```bash
   npm i -g @openai/codex
   npm ci --prefix tools/codex-mcp
   ```
   저장소가 복제된 뒤에 스크립트가 실행되는지는 확인이 필요합니다.
4. 세션에서 `codex login --device-auth`를 실행하면 URL과 코드가 나옵니다. 브라우저에서 그 URL을 열어 코드를 입력하고 승인합니다.
5. 저장소 루트에 `.mcp.json`을 두면 프로젝트 MCP 서버로 등록됩니다. 클라우드 세션이 이 파일의 stdio 서버를 불러오는지는 확인하지 못했습니다.
   ```json
   { "mcpServers": { "codex": { "command": "node", "args": ["tools/codex-mcp/server.mjs"], "env": { "CODEX_MCP_ROOTS": "." } } } }
   ```

컨테이너가 정리되면 로그인도 사라져서 새 세션마다 4번을 다시 해야 합니다.
`~/.codex/auth.json`은 비밀번호처럼 다루세요. 환경 시크릿에 넣거나 저장소에 커밋하지 마세요.

## 테스트

```bash
cd tools/codex-mcp && npm test
```

가짜 `codex` 바이너리로 MCP 프로토콜, 샌드박스·폴더 제한, 타임아웃, 오류 처리를 점검합니다(12개).
실제 Codex 0.163.0에는 로그인 없이 연결해 인자가 거부되지 않는 것과 로그인 상태 감지까지 확인했습니다.
ChatGPT 로그인 후의 실제 응답은 확인하지 못했으므로 처음 한 번은 `codex_status`와 간단한 질문으로 확인하세요.

## 환경 변수

| 변수 | 기본값 | 용도 |
|------|--------|------|
| `CODEX_BIN` | `codex` | Codex 실행 파일 경로 |
| `CODEX_MCP_ROOTS` | 서버 시작 폴더 | 허용 작업 폴더(경로 구분자로 여러 개) |
| `CODEX_MCP_MAX_PARALLEL` | `2` | 동시 실행 수 |
