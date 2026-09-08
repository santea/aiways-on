# dump-page config schema (언어 공통)

Node(`dump-page.mjs`) · Python(`dump_page.py`) · Java(`DumpPage.java`) 세 러너가 **동일한 config JSON**을 먹는다. 러너만 바꿔도 결과 동일.

> **1 config = 1 url = 1 page.** 이 스키마는 페이지 하나를 캡처한다. **여러 페이지**를 캡처하려면
> 페이지마다 config를 하나씩 만들어 러너를 N회 호출한다(스키마·스크립트 변경 없음). 로그인이 필요하면
> 첫 config에만 `preAuth` + `storageState`(저장)를 두고, 이후 config는 같은 `storageState` 경로를 재사용해
> **로그인 1회**로 끝낸다(아래 `storageState`). `capture-mockup-runner`가 이 방식으로 다중 페이지를 처리한다.

## 실행

```bash
# Node (기본 — playwright 설치돼 있으면 바로)
node references/scripts/dump-page.mjs <config.json>

# Python
pip install playwright && python -m playwright install chromium
python references/scripts/dump_page.py <config.json>

# Java (jbang 단일 파일 실행)
jbang references/scripts/DumpPage.java <config.json>
```

## 필드

| 필드 | 필수 | 설명 |
|---|---|---|
| `url` | ✅ | 캡처 대상 라이브 URL (예: `https://localhost:3000/notices`) |
| `outDir` | ✅ | 산출물 폴더 (없으면 자동 생성) |
| `viewport` | | `{width,height}` 기본 `1920x1080` |
| `waitFor` | | `load`\|`domcontentloaded`\|`networkidle`\|`auto` (기본 networkidle). **`auto` = 범용 로딩 대기** — 페이지 내용이 뭔지 몰라도 로딩 끝을 잡음(networkidle + DOM 안정 폴링 + 로딩 인디케이터 소멸). 각 단계는 실패해도 catch로 진행해 **캡처는 무조건 수행**(로딩중 캡처는 감수). 자세한 동작은 아래 "auto: 범용 로딩 대기" |
| `captureDelay` | | 캡처 직전 추가 대기 ms (기본 1000). `auto`면 로딩 대기 **후** 이 값만큼 더 대기 → "x초 뒤에 캡처"의 x. `auto`가 아닌 경로에선 기존처럼 캡처 직전 1회 대기 |
| `waitForSelector` | | 이 셀렉터 나올 때까지 대기 (예: `main`) |
| `gotoTimeout` | | goto 타임아웃 ms (기본 30000) |
| `ignoreHTTPSErrors` | | self-signed 무시 (기본 true) |
| `storageState` | | 세션 파일 **절대경로**. 파일이 **있으면 preAuth 대신 재사용**. 파일이 없고 `preAuth`가 실행되면 **로그인 후 이 경로에 세션을 저장**(다음 호출이 재사용 → 다중 페이지 로그인 1회). 예: `/workspaces/session/.tmp/mockups/<featureName>/session.json` |
| `preAuth` | | OIDC 실제 로그인 (아래) |
| `actions` | | 캡처 전 상호작용 배열 (모달 닫기 등) |
| `captures` | | 저장할 산출물 배열 |

## auto: 범용 로딩 대기 (`waitFor: "auto"`)

"이 페이지에 뭐가 뜰지 모를 때" — 테이블·카드·차트 가리지 않고 로딩 끝을 잡는 대기 모드. `waitForSelector`를
페이지별로 지정할 필요가 없다. goto는 `domcontentloaded`로 빠르게 진입한 뒤 아래 세 신호를 순차 시도한다:

1. **networkidle** (15s 타임아웃) — 진행 중 네트워크 요청이 0이 되면 통과. 폴링/SSE/WebSocket 페이지면
   영원히 안 와서 타임아웃나지만 **catch로 진행**한다.
2. **DOM 안정 폴링** (최대 15s) — `body.innerHTML.length`를 500ms 간격으로 폴링해 2회 연속 변화 없으면 안정.
3. **로딩 인디케이터 소멸** (10s 타임아웃) — 범용 셀렉터 `[aria-busy="true"],[role="progressbar"],.spinner,
   .loading,.is-loading,.skeleton,[data-loading="true"]`가 DOM에서 사라지(detached)면 통과.

그 후 **`captureDelay`** (기본 1000ms)만큼 추가 대기 → 캡처.

> **실패해도 캡처는 한다.** 세 신호 각각은 try/catch로 감싸져 있어, 어느 것이 타임아웃/실패해도 다음 단계로
> 넘어가고 **최종 캡처는 무조건 실행**된다(로딩중 화면이 찍힐 수는 있음 — 감수). exit code 1로 종료하지 않는다.
> 캡처가 전혀 안 되는 것만 방지하는게 목적이지, "완전한 로딩 완료"를 보장하진 않는다.

```json
{
  "url": "https://localhost:3000/notices",
  "outDir": "/workspaces/session/.tmp/mockups/notice-list/notices",
  "waitFor": "auto",
  "captureDelay": 2000,
  "captures": [{ "type": "screenshot", "file": "before.png", "fullPage": true }]
}
```

- **정확히 x초 뒤 캡처** → `captureDelay`가 그 역할. `auto` 경로에선 로딩 대기 후 이 값만큼 더 기다린다.
- `auto`가 아닌 기존 `networkidle` 등을 쓰면 `captureDelay`는 캡처 직전 1회 대기로만 동작(하위호환).
- `waitForSelector`를 같이 주면 `auto` 대기 **후** 추가로 그 셀렉터까지 대기(더 엄격하게 할 때).

## preAuth (OIDC / ADFS 실제 로그인)

```json
"preAuth": {
  "signinUrl": "https://localhost:3000/api/auth/signin",
  "provider": "oidc",
  "callbackPath": "/",
  "oidcFormSelectors": {
    "username": "#userNameInput,input[type=email]",
    "password": "#passwordInput,input[type=password]",
    "submit":   "#submitButton,input[type=submit]"
  },
  "credentials": { "username": "${E2E_USER_ID}", "password": "${E2E_USER_PW}" }
}
```

흐름: `/api/auth/csrf` → `POST /api/auth/signin/{provider}` (302→IdP) → auth 쿠키 이식 → IdP 폼에 id/pw 입력·submit → localhost 콜백 대기.
`oidcFormSelectors`는 생략 가능 (ADFS 기본 셀렉터 내장). `credentials`는 `${ENV}` 치환 지원 — 평문 저장 금지.

**자격증명 로드**: 러너 실행 전 env로 export한다. `.env.test.sdlc` 우선, 없으면 `.env.test.local` fallback:

```bash
set -a; . ./.env.test.sdlc 2>/dev/null || . ./.env.test.local 2>/dev/null; set +a
```

`.env.test.sdlc`는 반드시 gitignore(커밋 금지). 파일에 `E2E_USER_ID=...` / `E2E_USER_PW=...`를 넣어두면 `preAuth`가 AD SSO 실제 로그인에 사용한다.

## actions (캡처 전 상호작용)

`click`·`fill`·`hover`·`press`·`wait`·`waitTime` 지원. `optional:true`면 실패해도 진행.

```json
"actions": [
  { "type": "click", "selector": "button[aria-label='Close']", "optional": true },
  { "type": "waitTime", "ms": 500 }
]
```

> **로그인 직후 공지 모달 자동 팝업** 같은 오버레이가 대시보드를 가리면, 위처럼 닫기 버튼 클릭을 `optional`로 넣어 깨끗한 화면을 캡처한다.

### 상태 기반 UI(모달/드로어/탭) 열어서 캡처

`useState`로 조건부 렌더되는 모달·다이얼로그는 트리거를 `click`하면 실제로 열린다. 소스 JSX를 손으로 복사하지 말고 이렇게 라이브로 캡처한다:

```json
"actions": [
  { "type": "click", "selector": "button:has-text('공지사항 등록')" },
  { "type": "wait",  "selector": "[role='dialog']" },
  { "type": "waitTime", "ms": 400 }
]
```

`wait`의 `selector`가 뜰 때까지(기본 `state:visible`) 대기하므로 애니메이션 있는 모달도 안전. 모달만 크롭하려면 `captures`에서 `selector`로 해당 컨테이너 지정.

## captures

```json
"captures": [
  { "type": "screenshot", "file": "before.png", "fullPage": true },
  { "type": "screenshot", "file": "modal.png",  "selector": ".modal" }
]
```

capture-mockup 워크플로우는 **png 스샷만** 쓴다. (라이브 소스 편집 방식이라 HTML 덤프가 불필요 — 러너에서도 제거됨.)

## 사내망 프록시 (자동)

러너가 `HTTPS_PROXY`/`HTTP_PROXY` 환경변수를 자동 감지하고, `NO_PROXY` + 아래 기본 목록을 **항상 bypass**에 추가한다:

```
127.0.0.1, ::1, localhost,
secsso.net, *.secsso.net,
domain.com, domain.net, *.domain.com, *.domain.net,
12.0.0.0/8, 10.0.0.0/8, 192.0.0.0/8, 172.0.0.0/8
```

→ `localhost` dev 서버·사내 도메인·사설 IP 대역이 사내 프록시로 새어 403 나던 문제 자동 해결. 별도 설정 불필요.

## 예시 config

`references/examples/` 참고:
- `example-preauth.json` — OIDC 실제 로그인으로 보호된 대시보드 캡처 (+ 모달 닫기)
- `example-notices.json` — 공지 목록 캡처
- `example-modal-open.json` — 로그인 후 트리거 클릭으로 등록 모달을 **열어** 라이브 캡처
- `example-multipage.md` — **여러 페이지**를 config N개 + 공유 `storageState`(로그인 1회)로 캡처하는 조립 패턴
