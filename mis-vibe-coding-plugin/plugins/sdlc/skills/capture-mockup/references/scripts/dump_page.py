#!/usr/bin/env python3
"""
범용 Playwright 페이지 캡처/덤프 러너 (Python 버전)

Usage:
    pip install playwright && python -m playwright install chromium
    python dump_page.py <config.json>

Config schema는 Node/Java 러너와 100% 동일 (references/config-schema.md 참고).
자세한 필드 설명은 dump-page.mjs 상단 주석 참고.
"""
import json
import os
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright


def expand_env(v):
    if not isinstance(v, str):
        return v
    return re.sub(r"\$\{(\w+)\}", lambda m: os.environ.get(m.group(1), ""), v)


def read_config(config_path):
    if not config_path or not Path(config_path).exists():
        sys.exit(f"Usage: python dump_page.py <config.json> (not found: {config_path})")
    cfg = json.loads(Path(config_path).read_text(encoding="utf-8"))
    if not cfg.get("url") or not cfg.get("outDir"):
        sys.exit('Config missing required field: "url" and/or "outDir"')
    merged = {
        "ignoreHTTPSErrors": True,
        "viewport": {"width": 1920, "height": 1080},
        "waitFor": "networkidle",
        "waitForSelector": None,
        "gotoTimeout": 30000,
        "captureDelay": 1000,
        "actions": [],
        "captures": [],
        **cfg,
    }
    # viewport 하한 강제 — 1920x1080 미만은 끌어올린다(작은 캡처로 merged 해상도가 쪼그라드는 것 방지).
    # 넓은 페이지용으로 더 큰 값을 명시하면 존중한다.
    vp = merged.get("viewport") or {}
    merged["viewport"] = {
        "width": max(1920, vp.get("width", 0)),
        "height": max(1080, vp.get("height", 0)),
    }
    return merged


def build_proxy():
    """사내 프록시 우회: NO_PROXY + localhost + 사내 SSO 항상 bypass"""
    proxy_env = (
        os.environ.get("HTTPS_PROXY") or os.environ.get("HTTP_PROXY")
        or os.environ.get("https_proxy") or os.environ.get("http_proxy")
    )
    if not proxy_env:
        return None
    no_proxy = os.environ.get("NO_PROXY") or os.environ.get("no_proxy") or ""
    bypass = ",".join(dict.fromkeys(
        [s.strip() for s in no_proxy.split(",") if s.strip()]
        # localhost + IPv6 loopback + 사내 도메인/사설 대역 항상 우회
        + ["127.0.0.1", "::1", "localhost",
           "secsso.net", "*.secsso.net",
           "domain.com", "domain.net", "*.domain.com", "*.domain.net",
           "12.0.0.0/8", "10.0.0.0/8", "192.0.0.0/8", "172.0.0.0/8"]
    ))
    print(f"[proxy] {proxy_env} | bypass localhost + SSO")
    return {"server": proxy_env, "bypass": bypass}


def run_actions(page, actions):
    for i, a in enumerate(actions):
        try:
            t = a["type"]
            if t == "click":
                # 여러 후보 매칭 시 strict-mode 위반 없이 첫 요소 클릭 (모달 닫기 등 견고성)
                target = page.locator(a["selector"]).first
                if a.get("force"):
                    target.scroll_into_view_if_needed(timeout=a.get("timeout", 10000))
                    target.dispatch_event("click")
                else:
                    target.click(timeout=a.get("timeout", 10000))
            elif t == "fill":
                page.locator(a["selector"]).fill(expand_env(a["value"]), timeout=a.get("timeout", 10000))
            elif t == "hover":
                page.locator(a["selector"]).hover(timeout=a.get("timeout", 10000))
            elif t == "press":
                page.locator(a["selector"]).press(a["key"], timeout=a.get("timeout", 10000))
            elif t == "wait":
                page.wait_for_selector(a["selector"], timeout=a.get("timeout", 10000), state=a.get("state", "visible"))
            elif t == "waitTime":
                page.wait_for_timeout(a.get("ms", 500))
            else:
                print(f"  ⚠ unknown action: {t}")
            print(f"  ✓ action[{i}] {t}" + (f" ({a.get('selector')})" if a.get("selector") else ""))
        except Exception as err:  # noqa: BLE001
            if a.get("optional"):
                print(f"  ~ action[{i}] {a['type']} skipped (optional): {err}")
            else:
                print(f"  ✗ action[{i}] {a['type']} failed: {err}")
                raise


def capture_screenshot(page, cap, out_dir, capture_delay=1000, skip_delay=False):
    out_path = Path(out_dir) / cap["file"]
    # 렌더 안정화: 폰트 로드 완료 + 여유 대기 (FOUT/레이아웃 시프트 방지).
    # waitFor:"auto" 경로는 wait_for_auto_ready에서 이미 capture_delay만큼 대기했으므로 중복 대기 생략.
    try:
        page.evaluate("document.fonts.ready")
    except Exception:
        pass
    if not skip_delay and capture_delay > 0:
        page.wait_for_timeout(capture_delay)
    if cap.get("selector"):
        page.locator(cap["selector"]).screenshot(path=str(out_path), timeout=cap.get("timeout", 10000), animations="disabled")
    else:
        page.screenshot(path=str(out_path), full_page=cap.get("fullPage", False), timeout=cap.get("timeout", 60000), animations="disabled")
    print(f"  ✓ screenshot → {out_path}")


LOADING_SELECTOR = (
    '[aria-busy="true"],[role="progressbar"],.spinner,.loading,.is-loading,.skeleton,[data-loading="true"]'
)


def wait_for_auto_ready(page, capture_delay):
    """범용 로딩 대기 (waitFor: "auto"). 페이지 내용이 뭔지 몰라도 로딩 끝을 잡는다.
    세 신호를 순차 시도하되 각각 catch로 빠진다 — 어떤 것도 실패해도 캡처는 진행된다.
      ① networkidle (진행 중 네트워크 요청 0) — 폴링/SSE 페이지면 타임아웃나지만 catch로 진행
      ② DOM 안정 (body innerHTML 길이 폴링, 변화 멈추면 안정)
      ③ 로딩 인디케이터 소멸 (범용 셀렉터 detached)
    캡처 직전 capture_delay(ms) 추가 대기(기본 1000) — 폰트/이미지/애니메이션 여유.
    """
    # ① networkidle (실패해도 진행)
    try:
        page.wait_for_load_state("networkidle", timeout=15000)
        print("  ✓ auto: networkidle")
    except Exception:
        print("  ~ auto: networkidle 타임아웃 (폴링/SSE 페이지로 추정) — 진행")

    # ② DOM 안정 폴링 (body innerHTML 길이 변화 멈춤)
    try:
        prev_len = -1
        stable = 0
        for _ in range(30):  # 최대 15s (500ms × 30)
            try:
                length = page.evaluate("document.body && document.body.innerHTML ? document.body.innerHTML.length : 0")
            except Exception:
                length = 0
            if length == prev_len:
                stable += 1
                if stable >= 2:
                    break
            else:
                stable = 0
            prev_len = length
            page.wait_for_timeout(500)
        print("  ✓ auto: DOM 안정")
    except Exception:
        print("  ~ auto: DOM 안정 확인 실패 — 진행")

    # ③ 로딩 인디케이터 소멸 (범용 셀렉터, detached 대기)
    try:
        page.wait_for_selector(LOADING_SELECTOR, state="detached", timeout=10000)
        print("  ✓ auto: 로딩 인디케이터 소멸")
    except Exception:
        print("  ~ auto: 로딩 인디케이터 없거나 타임아웃 — 진행")

    # ④ capture_delay — 캡처 직전 정확히 x초 대기 (기본 1000)
    if capture_delay > 0:
        page.wait_for_timeout(capture_delay)
        print(f"  ✓ auto: captureDelay {capture_delay}ms")


def run_pre_auth(page, pre_auth):
    """OIDC 실제 로그인: CSRF → signin POST(302→IdP) → 폼 입력 → 콜백 대기"""
    signin_url = pre_auth["signinUrl"]
    provider = pre_auth.get("provider", "oidc")
    callback_path = pre_auth.get("callbackPath", "/")
    form_sel = pre_auth.get("oidcFormSelectors") or {}
    creds = pre_auth["credentials"]
    base_url = f"{urlparse(signin_url).scheme}://{urlparse(signin_url).netloc}"
    user, pw = expand_env(creds["username"]), expand_env(creds["password"])

    csrf = page.request.get(f"{base_url}/api/auth/csrf").json()
    signin_res = page.request.post(
        f"{base_url}/api/auth/signin/{provider}",
        form={"csrfToken": csrf["csrfToken"], "callbackUrl": f"{base_url}{callback_path}"},
        max_redirects=0,
    )
    idp_url = signin_res.headers.get("location")
    if not idp_url:
        raise RuntimeError("preAuth: no IdP redirect (location header)")

    set_cookie = signin_res.headers.get("set-cookie", "")
    for c in [x for x in set_cookie.split("\n") if x]:
        parts = [s.strip() for s in c.split(";")]
        name_val = parts[0]
        eq = name_val.index("=")
        path_attr = next((p.split("=")[1] for p in parts[1:] if p.lower().startswith("path=")), "/")
        page.context.add_cookies([{
            "name": name_val[:eq], "value": name_val[eq + 1:], "domain": "localhost",
            "path": path_attr, "secure": any(p.lower() == "secure" for p in parts[1:]),
            "httpOnly": True, "sameSite": "Lax",
        }])

    page.goto(idp_url, wait_until="domcontentloaded", timeout=30000)

    print(f"[preAuth] IdP form page: {page.url[:70]}")

    def sel(key, default):
        return [s.strip() for s in form_sel[key].split(",")] if form_sel.get(key) else default

    def fill_first(selectors, value, label):
        for s in selectors:
            el = page.locator(s).first
            try:
                if el.is_visible(timeout=3000):
                    el.fill(value)
                    print(f"[preAuth] {label} filled ({s})")
                    return
            except Exception:  # noqa: BLE001
                continue
        page.screenshot(path=f"/tmp/preauth-{label}-debug.png", full_page=True)
        raise RuntimeError(f"preAuth: {label} field not found (debug: /tmp/preauth-{label}-debug.png)")

    fill_first(sel("username", ["#userNameInput", "input[type='email']", "input[name='username']"]), user, "username")
    fill_first(sel("password", ["#passwordInput", "input[name='Password']", "input[type='password']"]), pw, "password")
    # 값이 폼에 반영되도록 짧은 안정화 대기 (ADFS는 클릭 직후 검증)
    page.wait_for_timeout(300)
    submitted = False
    for s in sel("submit", ["#submitButton", "input[type='submit']", "button[type='submit']"]):
        el = page.locator(s).first
        try:
            if el.is_visible(timeout=3000):
                # 클릭 → IdP 처리 → localhost 콜백 네비게이션 대기
                el.click()
                try:
                    page.wait_for_url(
                        re.compile(r"^(?!.*\/adfs\/oauth2\/authorize).*$"),
                        timeout=30000, wait_until="commit",
                    )
                except Exception:  # noqa: BLE001
                    pass
                submitted = True
                print(f"[preAuth] submitted ({s})")
                break
        except Exception:  # noqa: BLE001
            continue
    if not submitted:
        print("[preAuth] ⚠ submit button not found")

    try:
        page.wait_for_url(re.compile(re.escape(base_url)), timeout=30000, wait_until="commit")
    except Exception:  # noqa: BLE001
        pass
    try:
        page.wait_for_load_state("networkidle", timeout=20000)
    except Exception:  # noqa: BLE001
        pass
    print(f"[preAuth] login complete: {page.url}")


def main():
    cfg = read_config(sys.argv[1] if len(sys.argv) > 1 else None)
    Path(cfg["outDir"]).mkdir(parents=True, exist_ok=True)
    print(f"[dump-page] url={cfg['url']} outDir={cfg['outDir']}")

    has_session = cfg.get("storageState") and Path(cfg["storageState"]).exists()
    with sync_playwright() as p:
        browser = p.chromium.launch(proxy=build_proxy())
        ctx_kwargs = {"ignore_https_errors": cfg["ignoreHTTPSErrors"], "viewport": cfg["viewport"], "device_scale_factor": 1}
        if has_session:
            ctx_kwargs["storage_state"] = cfg["storageState"]
        context = browser.new_context(**ctx_kwargs)
        page = context.new_page()
        try:
            if cfg.get("preAuth") and not has_session:
                run_pre_auth(page, cfg["preAuth"])
                # 로그인한 세션을 storageState 경로에 저장 → 이후 호출(다른 페이지)이 재사용해 로그인 1회로 끝냄
                if cfg.get("storageState"):
                    context.storage_state(path=cfg["storageState"])
                    print(f"[preAuth] session saved: {cfg['storageState']}")

            # waitFor: "auto" 면 goto는 domcontentloaded로 빠르게 진입 후 범용 로딩 대기.
            # 그 외("load"|"domcontentloaded"|"networkidle")는 기존처럼 goto가 해당 상태까지 대기.
            is_auto = cfg["waitFor"] == "auto"
            page.goto(
                cfg["url"],
                wait_until="domcontentloaded" if is_auto else cfg["waitFor"],
                timeout=cfg["gotoTimeout"],
            )

            if is_auto:
                wait_for_auto_ready(page, cfg["captureDelay"])

            if cfg["waitForSelector"]:
                page.wait_for_selector(cfg["waitForSelector"], timeout=10000)

            if cfg["actions"]:
                run_actions(page, cfg["actions"])

            for cap in cfg["captures"]:
                if cap["type"] == "screenshot":
                    capture_screenshot(page, cap, cfg["outDir"], cfg["captureDelay"], is_auto)
                else:
                    print(f"  ⚠ unknown capture: {cap['type']}")
            print(f"\n✅ Done. Output: {cfg['outDir']}")
        except Exception as err:  # noqa: BLE001
            print(f"❌ Error: {err}")
            sys.exit(1)
        finally:
            browser.close()


if __name__ == "__main__":
    main()
