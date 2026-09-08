# 다중 페이지 캡처 — config N개 + 공유 세션

요구사항 하나가 **여러 페이지**에 걸칠 때(예: "공지 등록 폼에 첨부 필드 추가" → 목록 + 등록 모달 + 상세)의
조립 패턴. `dump-page.mjs`/config 스키마는 **1 config = 1 url = 1 page**이므로, 페이지마다 config를 하나씩
만들어 러너를 N회 호출한다. **스키마·스크립트는 수정하지 않는다.**

`capture-mockup-runner` 에이전트가 이 패턴으로 다중 페이지를 처리한다.

## 원칙

- **페이지당 config 1개, outDir 1개.** `outDir = /workspaces/session/.tmp/mockups/<featureName>/<screenName>/` (절대경로).
- **로그인 1회.** 첫 페이지 config에만 `preAuth` + `storageState`(저장 경로) 지정. 러너가 로그인 후 세션을
  그 파일에 저장한다. 이후 페이지 config는 `preAuth`를 빼고 같은 `storageState` 경로만 지정 → 세션 재사용.
- 공유 `storageState`는 feature 상위폴더에 둔다: `/workspaces/session/.tmp/mockups/<featureName>/session.json`.

## 예: featureName = `notice-attach`, 2개 화면

### 1) 첫 페이지 — 목록 (로그인 수행 + 세션 저장)

`/workspaces/session/.tmp/mockups/notice-attach/notices/_dump.json`

```json
{
  "url": "https://localhost:3000/notices",
  "outDir": "/workspaces/session/.tmp/mockups/notice-attach/notices",
  "waitForSelector": "main",
  "preAuth": {
    "signinUrl": "https://localhost:3000/api/auth/signin",
    "provider": "oidc",
    "callbackPath": "/notices",
    "credentials": { "username": "${E2E_USER_ID}", "password": "${E2E_USER_PW}" }
  },
  "storageState": "/workspaces/session/.tmp/mockups/notice-attach/session.json",
  "actions": [
    { "type": "click", "selector": "[role='dialog'] button[aria-label='닫기']", "optional": true }
  ],
  "captures": [
    { "type": "screenshot", "file": "before.png", "fullPage": true }
  ]
}
```

### 2) 둘째 페이지 — 등록 모달 (세션 재사용, preAuth 없음)

`/workspaces/session/.tmp/mockups/notice-attach/notice-create-modal/_dump.json`

```json
{
  "url": "https://localhost:3000/notices",
  "outDir": "/workspaces/session/.tmp/mockups/notice-attach/notice-create-modal",
  "waitForSelector": "main",
  "storageState": "/workspaces/session/.tmp/mockups/notice-attach/session.json",
  "actions": [
    { "type": "click", "selector": "button:has-text('공지사항 등록')" },
    { "type": "wait", "selector": "[role='dialog']" },
    { "type": "waitTime", "ms": 400 }
  ],
  "captures": [
    { "type": "screenshot", "file": "before.png", "fullPage": true }
  ]
}
```

## 실행 (배치 흐름: all Before → edit all → all After)

캡처는 **배치 4단계**로 돈다(러너 §4~§7). Before는 **어떤 편집보다 먼저 전 화면 일괄**, After는
**전 화면 편집·확정 후 전 화면 일괄**이다. 페이지마다 러너 1회씩, 세션은 첫 호출 1회 로그인 후 재사용.

```bash
cd <projectRoot>
set -a; . ./.env.test.sdlc 2>/dev/null || . ./.env.test.local 2>/dev/null; set +a

# ── all Before (편집 전, clean baseline 전 화면) ──
# 첫 페이지: 로그인 + session.json 저장 (file: "before.png")
node <플러그인경로>/skills/capture-mockup/references/scripts/dump-page.mjs \
  /workspaces/session/.tmp/mockups/notice-attach/notices/_dump.json
# 세션 실증: session.json 실재·크기>0 확인 (로그인한 경우 필수)
node -e "const fs=require('fs'),p='/workspaces/session/.tmp/mockups/notice-attach/session.json';const s=fs.existsSync(p)&&fs.statSync(p).size;if(!s){console.error('session.json 없음/빈 파일');process.exit(1)}console.log('session.json OK',s)"
# 둘째 페이지: session.json 재사용 (로그인 스킵, file: "before.png")
node <플러그인경로>/skills/capture-mockup/references/scripts/dump-page.mjs \
  /workspaces/session/.tmp/mockups/notice-attach/notice-create-modal/_dump.json

# ── edit all (전 화면 소스 편집, 화면 편집마다 체크포인트 커밋) ──
# ── all After (편집·확정 후, file: "after.png"로 두 페이지 config 재실행) ──
```

After 캡처도 같은 두 config를 `file: "after.png"`(소스 편집·HMR·확정 후)로 재실행한다. `storageState`가
유효하면 `[preAuth]` 로그인 로그는 **첫 Before 호출에서만** 찍힌다 — 세션 재사용 검증 포인트.
