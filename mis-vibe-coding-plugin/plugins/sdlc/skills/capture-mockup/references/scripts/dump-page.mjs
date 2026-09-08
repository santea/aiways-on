#!/usr/bin/env node
/**
 * 범용 Playwright 페이지 캡처/덤프 러너 (Node 버전)
 *
 * Usage:
 *   node dump-page.mjs <config.json>
 *
 * 이 러너 하나면 capture-mockup 워크플로우가 필요로 하는 모든 캡처를 처리한다:
 *   - self-signed HTTPS 무시
 *   - 사내 프록시 자동 우회 (localhost/사내 SSO는 bypass)
 *   - OIDC(ADFS 등) 실제 로그인(preAuth) 또는 저장된 세션(storageState) 재사용
 *   - 로그인 직후 자동 팝업(공지 모달 등) 닫기 (actions)
 *   - 스샷(png) 저장
 *
 * Config schema (JSON) — Node/Python/Java 러너 공통:
 * {
 *   "url": "https://localhost:3000/notices",   // 필수
 *   "outDir": "/abs/out",                       // 필수
 *   "viewport": { "width": 1920, "height": 1080 },
 *   "waitFor": "networkidle",        // load | domcontentloaded | networkidle
 *   "waitForSelector": "main",       // optional
 *   "gotoTimeout": 30000,
 *   "ignoreHTTPSErrors": true,
 *   "storageState": "/abs/user.json",           // 있으면 preAuth 대신 세션 재사용
 *   "preAuth": {                                 // OIDC 실제 로그인
 *     "signinUrl": "https://localhost:3000/api/auth/signin",
 *     "provider": "oidc",
 *     "callbackPath": "/",                       // 로그인 후 돌아올 경로
 *     "oidcFormSelectors": {                     // optional 오버라이드
 *       "username": "#userNameInput,input[type=email]",
 *       "password": "#passwordInput,input[type=password]",
 *       "submit":   "#submitButton,input[type=submit]"
 *     },
 *     "credentials": { "username": "id", "password": "pw" }
 *   },
 *   "actions": [                                 // 캡처 전 상호작용 (예: 모달 닫기)
 *     { "type": "click", "selector": "button[aria-label='Close']", "optional": true },
 *     { "type": "waitTime", "ms": 500 }
 *   ],
 *   "captures": [
 *     { "type": "screenshot", "file": "before.png", "fullPage": true },
 *     { "type": "screenshot", "file": "modal.png",  "selector": ".modal" }
 *   ]
 * }
 *
 * 크레덴셜은 config에 평문으로 넣지 말고 환경변수 치환을 쓸 수 있다:
 *   "username": "${E2E_USER_ID}", "password": "${E2E_USER_PW}"
 */

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

// 이 러너는 플러그인 경로에 있고 playwright는 "대상 프로젝트"의 node_modules에 있다.
// 따라서 스크립트 위치가 아니라 현재 작업 디렉토리(cwd) 기준으로 playwright를 로드한다.
// 대상 프로젝트에 playwright가 없으면 명확한 안내를 낸다.
const requireCwd = createRequire(path.join(process.cwd(), 'noop.js'));
let chromium;
try {
  ({ chromium } = requireCwd('playwright'));
} catch {
  try {
    ({ chromium } = requireCwd('@playwright/test'));
  } catch {
    console.error(
      '[dump-page] playwright를 찾을 수 없습니다. 대상 프로젝트에서 실행하거나 설치하세요:\n' +
        '  npm i -D playwright && npx playwright install chromium\n' +
        `  (현재 cwd: ${process.cwd()})`,
    );
    process.exit(1);
  }
}

function expandEnv(v) {
  if (typeof v !== 'string') return v;
  return v.replace(/\$\{(\w+)\}/g, (_, k) => process.env[k] ?? '');
}

function readConfig(configPath) {
  if (!configPath || !fs.existsSync(configPath)) {
    console.error(`Usage: node dump-page.mjs <config.json> (config not found: ${configPath})`);
    process.exit(1);
  }
  const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  if (!cfg.url || !cfg.outDir) {
    console.error('Config missing required field: "url" and/or "outDir"');
    process.exit(1);
  }
  const merged = {
    ignoreHTTPSErrors: true,
    viewport: { width: 1920, height: 1080 },
    waitFor: 'networkidle',
    waitForSelector: null,
    gotoTimeout: 30000,
    captureDelay: 1000,
    actions: [],
    captures: [],
    ...cfg,
  };
  // viewport 하한 강제 — 1920x1080 미만은 끌어올린다(작은 캡처로 merged 해상도가 쪼그라드는 것 방지).
  // 넓은 페이지용으로 더 큰 값을 명시하면 존중한다.
  const vp = merged.viewport || {};
  merged.viewport = {
    width: Math.max(1920, vp.width || 0),
    height: Math.max(1080, vp.height || 0),
  };
  return merged;
}

/** 사내 프록시 우회 규칙: NO_PROXY + localhost + 사내 SSO 도메인 항상 bypass */
function buildProxy() {
  const proxyEnv =
    process.env.HTTPS_PROXY || process.env.HTTP_PROXY ||
    process.env.https_proxy || process.env.http_proxy;
  if (!proxyEnv) return undefined;
  const noProxyEnv = process.env.NO_PROXY || process.env.no_proxy || '';
  const bypass = [...new Set([
    ...noProxyEnv.split(',').map((s) => s.trim()).filter(Boolean),
    // localhost + IPv6 loopback + 사내 도메인/사설 대역 항상 우회
    '127.0.0.1', '::1', 'localhost',
    'secsso.net', '*.secsso.net',
    'domain.com', 'domain.net', '*.domain.com', '*.domain.net',
    '12.0.0.0/8', '10.0.0.0/8', '192.0.0.0/8', '172.0.0.0/8',
  ])].join(',');
  console.log('[proxy]', proxyEnv, '| bypass localhost + SSO');
  return { server: proxyEnv, bypass };
}

async function runActions(page, actions) {
  for (const [i, a] of actions.entries()) {
    try {
      switch (a.type) {
        case 'click': {
          // 여러 후보가 매칭돼도 strict-mode 위반 없이 첫 요소를 클릭 (모달 닫기 등 견고성)
          const target = page.locator(a.selector).first();
          if (a.force) {
            await target.scrollIntoViewIfNeeded({ timeout: a.timeout ?? 10000 });
            await target.dispatchEvent('click');
          } else {
            await target.click({ timeout: a.timeout ?? 10000 });
          }
          break;
        }
        case 'fill':
          await page.locator(a.selector).fill(expandEnv(a.value), { timeout: a.timeout ?? 10000 });
          break;
        case 'hover':
          await page.locator(a.selector).hover({ timeout: a.timeout ?? 10000 });
          break;
        case 'press':
          await page.locator(a.selector).press(a.key, { timeout: a.timeout ?? 10000 });
          break;
        case 'wait':
          await page.waitForSelector(a.selector, { timeout: a.timeout ?? 10000, state: a.state ?? 'visible' });
          break;
        case 'waitTime':
          await page.waitForTimeout(a.ms ?? 500);
          break;
        default:
          console.warn(`  ⚠ unknown action: ${a.type}`);
      }
      console.log(`  ✓ action[${i}] ${a.type}${a.selector ? ` (${a.selector})` : ''}`);
    } catch (err) {
      // optional 액션(예: 모달이 없을 수도 있음)은 실패해도 진행
      if (a.optional) {
        console.log(`  ~ action[${i}] ${a.type} skipped (optional): ${err.message}`);
      } else {
        console.error(`  ✗ action[${i}] ${a.type} failed: ${err.message}`);
        throw err;
      }
    }
  }
}

/**
 * 범용 로딩 대기 (waitFor: "auto"). 페이지 내용이 뭔지 몰라도 로딩 끝을 잡는다.
 * 세 신호를 순차 시도하되 각각 catch로 빠진다 — 어떤 것도 실패해도 캡처는 진행된다.
 *   ① networkidle (진행 중 네트워크 요청 0) — 폴링/SSE 페이지면 타임아웃나지만 catch로 진행
 *   ② DOM 안정 (body innerHTML 길이 폴링, 변화 멈추면 안정)
 *   ③ 로딩 인디케이터 소멸 (범용 셀렉터 detached)
 * 캡처 직전 captureDelay(ms) 추가 대기(기본 1000) — 폰트/이미지/애니메이션 여유.
 */
const LOADING_SELECTOR =
  '[aria-busy="true"],[role="progressbar"],.spinner,.loading,.is-loading,.skeleton,[data-loading="true"]';

async function waitForAutoReady(page, captureDelay) {
  // ① networkidle (실패해도 진행)
  try {
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    console.log('  ✓ auto: networkidle');
  } catch {
    console.log('  ~ auto: networkidle 타임아웃 (폴링/SSE 페이지로 추정) — 진행');
  }

  // ② DOM 안정 폴링 (body innerHTML 길이 변화 멈춤)
  try {
    let prevLen = -1;
    let stable = 0;
    for (let i = 0; i < 30; i++) {  // 최대 15s (500ms × 30)
      const len = await page.evaluate(() => document.body?.innerHTML?.length ?? 0).catch(() => 0);
      if (len === prevLen) {
        stable += 1;
        if (stable >= 2) break;  // 2회 연속 변화 없음 = 안정
      } else {
        stable = 0;
      }
      prevLen = len;
      await page.waitForTimeout(500);
    }
    console.log(`  ✓ auto: DOM 안정`);
  } catch {
    console.log('  ~ auto: DOM 안정 확인 실패 — 진행');
  }

  // ③ 로딩 인디케이터 소멸 (범용 셀렉터, detached 대기)
  try {
    await page.waitForSelector(LOADING_SELECTOR, { state: 'detached', timeout: 10000 });
    console.log('  ✓ auto: 로딩 인디케이터 소멸');
  } catch {
    console.log('  ~ auto: 로딩 인디케이터 없거나 타임아웃 — 진행');
  }

  // ④ captureDelay — 캡처 직전 정확히 x초 대기 (기본 1000)
  if (captureDelay > 0) {
    await page.waitForTimeout(captureDelay);
    console.log(`  ✓ auto: captureDelay ${captureDelay}ms`);
  }
}

async function captureScreenshot(page, cap, outDir, captureDelay = 1000, skipDelay = false) {
  const outPath = path.join(outDir, cap.file);
  // 렌더 안정화: 폰트 로드 완료 + 여유 대기 (FOUT/레이아웃 시프트 방지).
  // waitFor:"auto" 경로는 waitForAutoReady에서 이미 captureDelay만큼 대기했으므로 중복 대기 생략.
  await page.evaluate(() => document.fonts.ready).catch(() => {});
  if (!skipDelay && captureDelay > 0) await page.waitForTimeout(captureDelay);
  if (cap.selector) {
    await page.locator(cap.selector).screenshot({ path: outPath, timeout: cap.timeout ?? 10000, animations: 'disabled' });
  } else {
    await page.screenshot({ path: outPath, fullPage: cap.fullPage ?? false, timeout: cap.timeout ?? 60000, animations: 'disabled' });
  }
  console.log(`  ✓ screenshot → ${outPath}`);
}

/** OIDC 실제 로그인: CSRF → signin POST(302→ADFS) → 폼 입력 → 콜백 대기 */
async function runPreAuth(page, preAuth) {
  const { signinUrl, provider = 'oidc', callbackPath = '/', oidcFormSelectors, credentials } = preAuth;
  const baseUrl = new URL(signinUrl).origin;
  const user = expandEnv(credentials.username);
  const pass = expandEnv(credentials.password);

  const csrf = await (await page.request.get(`${baseUrl}/api/auth/csrf`)).json();
  const signinRes = await page.request.post(`${baseUrl}/api/auth/signin/${provider}`, {
    form: { csrfToken: csrf.csrfToken, callbackUrl: `${baseUrl}${callbackPath}` },
    maxRedirects: 0,
  });
  const adfsUrl = signinRes.headers()['location'];
  if (!adfsUrl) throw new Error('preAuth: no IdP redirect (location header)');

  // auth 쿠키를 브라우저 컨텍스트에 이식
  for (const c of (signinRes.headers()['set-cookie'] ?? '').split('\n').filter(Boolean)) {
    const [nameVal, ...parts] = c.split(';').map((s) => s.trim());
    const eq = nameVal.indexOf('=');
    await page.context().addCookies([{
      name: nameVal.slice(0, eq), value: nameVal.slice(eq + 1), domain: 'localhost',
      path: parts.find((p) => p.toLowerCase().startsWith('path='))?.split('=')[1] ?? '/',
      secure: parts.some((p) => p.toLowerCase() === 'secure'), httpOnly: true, sameSite: 'Lax',
    }]);
  }

  await page.goto(adfsUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

  console.log('[preAuth] IdP form page:', page.url().slice(0, 70));
  const sel = (key, def) => (oidcFormSelectors?.[key]?.split(',').map((s) => s.trim())) ?? def;
  const fillFirst = async (selectors, value, label) => {
    for (const s of selectors) {
      const el = page.locator(s).first();
      if (await el.isVisible({ timeout: 3000 }).catch(() => false)) {
        await el.fill(value);
        console.log(`[preAuth] ${label} filled (${s})`);
        return true;
      }
    }
    await page.screenshot({ path: path.join('/tmp', `preauth-${label}-debug.png`), fullPage: true }).catch(() => {});
    throw new Error(`preAuth: ${label} field not found (debug: /tmp/preauth-${label}-debug.png)`);
  };

  await fillFirst(sel('username', ['#userNameInput', 'input[type="email"]', 'input[name="username"]']), user, 'username');
  await fillFirst(sel('password', ['#passwordInput', 'input[name="Password"]', 'input[type="password"]']), pass, 'password');
  // 값이 폼에 반영되도록 짧은 안정화 대기 (ADFS는 클릭 직후 검증)
  await page.waitForTimeout(300);
  let submitted = false;
  for (const s of sel('submit', ['#submitButton', 'input[type="submit"]', 'button[type="submit"]'])) {
    const el = page.locator(s).first();
    if (await el.isVisible({ timeout: 3000 }).catch(() => false)) {
      // 클릭과 이탈 네비게이션을 함께 대기 (submit → IdP 처리 → localhost 콜백)
      await Promise.all([
        page.waitForURL((u) => !/\/adfs\/oauth2\/authorize/.test(u), { timeout: 30000, waitUntil: 'commit' }).catch(() => {}),
        el.click(),
      ]);
      submitted = true;
      console.log(`[preAuth] submitted (${s})`);
      break;
    }
  }
  if (!submitted) console.warn('[preAuth] ⚠ submit button not found');

  try { await page.waitForURL(new RegExp(baseUrl.replace(/[.^$*+?()[\]{}|\\]/g, '\\$&')), { timeout: 30000, waitUntil: 'commit' }); } catch {}
  try { await page.waitForLoadState('networkidle', { timeout: 20000 }); } catch {}
  console.log('[preAuth] login complete:', page.url().slice(0, 70));
}

async function main() {
  const cfg = readConfig(process.argv[2]);
  fs.mkdirSync(cfg.outDir, { recursive: true });
  console.log(`[dump-page] url=${cfg.url} outDir=${cfg.outDir}`);

  const browser = await chromium.launch({ proxy: buildProxy() });
  const context = await browser.newContext({
    ignoreHTTPSErrors: cfg.ignoreHTTPSErrors,
    viewport: cfg.viewport,
    deviceScaleFactor: 1,
    ...(cfg.storageState && fs.existsSync(cfg.storageState) ? { storageState: cfg.storageState } : {}),
  });
  const page = await context.newPage();

  try {
    // 세션 재사용(storageState)이 있으면 preAuth 생략
    const hasSession = cfg.storageState && fs.existsSync(cfg.storageState);
    if (cfg.preAuth && !hasSession) {
      await runPreAuth(page, cfg.preAuth);
      // 로그인한 세션을 storageState 경로에 저장 → 이후 호출(다른 페이지)이 재사용해 로그인 1회로 끝냄
      if (cfg.storageState) {
        await context.storageState({ path: cfg.storageState });
        console.log(`[preAuth] session saved: ${cfg.storageState}`);
      }
    }

    // waitFor: "auto" 면 goto는 domcontentloaded로 빠르게 진입 후 범용 로딩 대기.
    // 그 외("load"|"domcontentloaded"|"networkidle")는 기존처럼 goto가 해당 상태까지 대기.
    const isAuto = cfg.waitFor === 'auto';
    await page.goto(cfg.url, {
      waitUntil: isAuto ? 'domcontentloaded' : cfg.waitFor,
      timeout: cfg.gotoTimeout,
    });

    if (isAuto) {
      await waitForAutoReady(page, cfg.captureDelay);
    } else {
      // 기존 경로: captureScreenshot 내부의 captureDelay 대기와 함께 동작
    }

    if (cfg.waitForSelector) await page.waitForSelector(cfg.waitForSelector, { timeout: 10000 });

    if (cfg.actions.length) await runActions(page, cfg.actions);

    for (const cap of cfg.captures) {
      if (cap.type === 'screenshot') await captureScreenshot(page, cap, cfg.outDir, cfg.captureDelay, isAuto);
      else console.warn(`  ⚠ unknown capture: ${cap.type}`);
    }
    console.log(`\n✅ Done. Output: ${cfg.outDir}`);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();
