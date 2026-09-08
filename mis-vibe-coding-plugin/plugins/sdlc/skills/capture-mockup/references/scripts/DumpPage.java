///usr/bin/env jbang "$0" "$@" ; exit $?
//DEPS com.microsoft.playwright:playwright:1.48.0
//DEPS com.googlecode.json-simple:json-simple:1.1.1
/*
 * 범용 Playwright 페이지 캡처/덤프 러너 (Java 버전 · jbang 실행)
 *
 * Usage:
 *   jbang DumpPage.java <config.json>
 *   (jbang 없으면: https://www.jbang.dev/download/ 참고. 최초 실행 시 의존성 자동 다운로드.)
 *   최초 1회 브라우저 설치: jbang DumpPage.java --install-browser  (또는 mvn exec 시 playwright install)
 *
 * Config schema는 Node/Python 러너와 100% 동일 (references/config-schema.md 참고).
 */
import com.microsoft.playwright.*;
import com.microsoft.playwright.options.*;
import org.json.simple.*;
import org.json.simple.parser.*;

import java.net.URI;
import java.nio.file.*;
import java.util.*;
import java.util.regex.*;

public class DumpPage {

    static String expandEnv(Object v) {
        if (!(v instanceof String s)) return v == null ? null : v.toString();
        Matcher m = Pattern.compile("\\$\\{(\\w+)\\}").matcher(s);
        StringBuilder sb = new StringBuilder();
        while (m.find()) {
            String val = System.getenv(m.group(1));
            m.appendReplacement(sb, Matcher.quoteReplacement(val == null ? "" : val));
        }
        m.appendTail(sb);
        return sb.toString();
    }

    @SuppressWarnings("unchecked")
    static <T> T get(JSONObject o, String k, T def) {
        Object v = o.get(k);
        return v == null ? def : (T) v;
    }

    static int getInt(JSONObject o, String k, int def) {
        Object v = o.get(k);
        return v == null ? def : ((Number) v).intValue();
    }

    /** 사내 프록시 우회: NO_PROXY + localhost + 사내 SSO 항상 bypass */
    static Proxy buildProxy() {
        String proxyEnv = firstNonEmpty(System.getenv("HTTPS_PROXY"), System.getenv("HTTP_PROXY"),
                System.getenv("https_proxy"), System.getenv("http_proxy"));
        if (proxyEnv == null) return null;
        String noProxy = firstNonEmpty(System.getenv("NO_PROXY"), System.getenv("no_proxy"), "");
        LinkedHashSet<String> bypass = new LinkedHashSet<>();
        for (String s : noProxy.split(",")) if (!s.isBlank()) bypass.add(s.trim());
        // localhost + IPv6 loopback + 사내 도메인/사설 대역 항상 우회
        bypass.addAll(List.of("127.0.0.1", "::1", "localhost",
                "secsso.net", "*.secsso.net",
                "domain.com", "domain.net", "*.domain.com", "*.domain.net",
                "12.0.0.0/8", "10.0.0.0/8", "192.0.0.0/8", "172.0.0.0/8"));
        System.out.println("[proxy] " + proxyEnv + " | bypass localhost + SSO");
        return new Proxy(proxyEnv).setBypass(String.join(",", bypass));
    }

    static String firstNonEmpty(String... vals) {
        for (String v : vals) if (v != null && !v.isEmpty()) return v;
        return null;
    }

    static void runActions(Page page, JSONArray actions) {
        for (int i = 0; i < actions.size(); i++) {
            JSONObject a = (JSONObject) actions.get(i);
            String type = (String) a.get("type");
            String selector = (String) a.get("selector");
            double timeout = getInt(a, "timeout", 10000);
            boolean optional = Boolean.TRUE.equals(a.get("optional"));
            try {
                switch (type) {
                    case "click" -> {
                        // 여러 후보 매칭 시 strict-mode 위반 없이 첫 요소 클릭 (모달 닫기 등 견고성)
                        Locator target = page.locator(selector).first();
                        if (Boolean.TRUE.equals(a.get("force"))) {
                            target.scrollIntoViewIfNeeded(new Locator.ScrollIntoViewIfNeededOptions().setTimeout(timeout));
                            target.dispatchEvent("click");
                        } else {
                            target.click(new Locator.ClickOptions().setTimeout(timeout));
                        }
                    }
                    case "fill" -> page.locator(selector).fill(expandEnv(a.get("value")), new Locator.FillOptions().setTimeout(timeout));
                    case "hover" -> page.locator(selector).hover(new Locator.HoverOptions().setTimeout(timeout));
                    case "press" -> page.locator(selector).press((String) a.get("key"), new Locator.PressOptions().setTimeout(timeout));
                    case "wait" -> page.waitForSelector(selector, new Page.WaitForSelectorOptions().setTimeout(timeout));
                    case "waitTime" -> page.waitForTimeout(getInt(a, "ms", 500));
                    default -> System.out.println("  ⚠ unknown action: " + type);
                }
                System.out.println("  ✓ action[" + i + "] " + type + (selector != null ? " (" + selector + ")" : ""));
            } catch (RuntimeException err) {
                if (optional) {
                    System.out.println("  ~ action[" + i + "] " + type + " skipped (optional): " + err.getMessage());
                } else {
                    System.out.println("  ✗ action[" + i + "] " + type + " failed: " + err.getMessage());
                    throw err;
                }
            }
        }
    }

    static final String LOADING_SELECTOR =
            "[aria-busy=\"true\"],[role=\"progressbar\"],.spinner,.loading,.is-loading,.skeleton,[data-loading=\"true\"]";

    static void captureScreenshot(Page page, JSONObject cap, String outDir, int captureDelay, boolean skipDelay) {
        Path outPath = Paths.get(outDir, (String) cap.get("file"));
        // 렌더 안정화: 폰트 로드 완료 + 여유 대기 (FOUT/레이아웃 시프트 방지).
        // waitFor:"auto" 경로는 waitForAutoReady에서 이미 captureDelay만큼 대기했으므로 중복 대기 생략.
        try { page.evaluate("document.fonts.ready"); } catch (Exception ignored) {}
        if (!skipDelay && captureDelay > 0) page.waitForTimeout(captureDelay);
        String selector = (String) cap.get("selector");
        if (selector != null) {
            page.locator(selector).screenshot(new Locator.ScreenshotOptions()
                    .setPath(outPath).setTimeout(getInt(cap, "timeout", 10000))
                    .setAnimations(ScreenshotAnimations.DISABLED));
        } else {
            page.screenshot(new Page.ScreenshotOptions()
                    .setPath(outPath).setFullPage(Boolean.TRUE.equals(cap.get("fullPage")))
                    .setTimeout(getInt(cap, "timeout", 60000)).setAnimations(ScreenshotAnimations.DISABLED));
        }
        System.out.println("  ✓ screenshot → " + outPath);
    }

    /**
     * 범용 로딩 대기 (waitFor: "auto"). 페이지 내용이 뭔지 몰라도 로딩 끝을 잡는다.
     * 세 신호를 순차 시도하되 각각 catch로 빠진다 — 어떤 것도 실패해도 캡처는 진행된다.
     *   ① networkidle (진행 중 네트워크 요청 0) — 폴링/SSE 페이지면 타임아웃나지만 catch로 진행
     *   ② DOM 안정 (body innerHTML 길이 폴링, 변화 멈추면 안정)
     *   ③ 로딩 인디케이터 소멸 (범용 셀렉터 detached)
     * 캡처 직전 captureDelay(ms) 추가 대기(기본 1000) — 폰트/이미지/애니메이션 여유.
     */
    static void waitForAutoReady(Page page, int captureDelay) {
        // ① networkidle (실패해도 진행)
        try {
            page.waitForLoadState(LoadState.NETWORKIDLE, new Page.WaitForLoadStateOptions().setTimeout(15000));
            System.out.println("  ✓ auto: networkidle");
        } catch (RuntimeException ignored) {
            System.out.println("  ~ auto: networkidle 타임아웃 (폴링/SSE 페이지로 추정) — 진행");
        }

        // ② DOM 안정 폴링 (body innerHTML 길이 변화 멈춤)
        try {
            int prevLen = -1;
            int stable = 0;
            for (int i = 0; i < 30; i++) {  // 최대 15s (500ms × 30)
                int length;
                try {
                    Object v = page.evaluate("document.body && document.body.innerHTML ? document.body.innerHTML.length : 0");
                    length = v instanceof Number ? ((Number) v).intValue() : 0;
                } catch (RuntimeException e) { length = 0; }
                if (length == prevLen) {
                    stable += 1;
                    if (stable >= 2) break;
                } else {
                    stable = 0;
                }
                prevLen = length;
                page.waitForTimeout(500);
            }
            System.out.println("  ✓ auto: DOM 안정");
        } catch (RuntimeException ignored) {
            System.out.println("  ~ auto: DOM 안정 확인 실패 — 진행");
        }

        // ③ 로딩 인디케이터 소멸 (범용 셀렉터, detached 대기)
        try {
            page.waitForSelector(LOADING_SELECTOR,
                    new Page.WaitForSelectorOptions().setState(WaitForSelectorState.DETACHED).setTimeout(10000));
            System.out.println("  ✓ auto: 로딩 인디케이터 소멸");
        } catch (RuntimeException ignored) {
            System.out.println("  ~ auto: 로딩 인디케이터 없거나 타임아웃 — 진행");
        }

        // ④ captureDelay — 캡처 직전 정확히 x초 대기 (기본 1000)
        if (captureDelay > 0) {
            page.waitForTimeout(captureDelay);
            System.out.println("  ✓ auto: captureDelay " + captureDelay + "ms");
        }
    }

    /** OIDC 실제 로그인: CSRF → signin POST(302→IdP) → 폼 입력 → 콜백 대기 */
    @SuppressWarnings("unchecked")
    static void runPreAuth(Page page, JSONObject preAuth) {
        String signinUrl = (String) preAuth.get("signinUrl");
        String provider = get(preAuth, "provider", "oidc");
        String callbackPath = get(preAuth, "callbackPath", "/");
        JSONObject formSel = get(preAuth, "oidcFormSelectors", new JSONObject());
        JSONObject creds = (JSONObject) preAuth.get("credentials");
        URI u = URI.create(signinUrl);
        String baseUrl = u.getScheme() + "://" + u.getAuthority();
        String user = expandEnv(creds.get("username"));
        String pass = expandEnv(creds.get("password"));

        JSONObject csrf;
        try {
            csrf = (JSONObject) new JSONParser().parse(page.request().get(baseUrl + "/api/auth/csrf").text());
        } catch (ParseException e) {
            throw new RuntimeException("preAuth: csrf parse failed", e);
        }
        APIResponse signinRes = page.request().post(baseUrl + "/api/auth/signin/" + provider,
                RequestOptions.create().setMaxRedirects(0).setForm(FormData.create()
                        .set("csrfToken", (String) csrf.get("csrfToken"))
                        .set("callbackUrl", baseUrl + callbackPath)));
        String idpUrl = signinRes.headers().get("location");
        if (idpUrl == null) throw new RuntimeException("preAuth: no IdP redirect (location header)");

        String setCookie = signinRes.headers().getOrDefault("set-cookie", "");
        for (String c : setCookie.split("\n")) {
            if (c.isBlank()) continue;
            String[] parts = c.split(";");
            String nameVal = parts[0].trim();
            int eq = nameVal.indexOf('=');
            String path = "/";
            boolean secure = false;
            for (int i = 1; i < parts.length; i++) {
                String p = parts[i].trim();
                if (p.toLowerCase().startsWith("path=")) path = p.substring(5);
                if (p.equalsIgnoreCase("secure")) secure = true;
            }
            page.context().addCookies(List.of(new Cookie(nameVal.substring(0, eq), nameVal.substring(eq + 1))
                    .setDomain("localhost").setPath(path).setSecure(secure).setHttpOnly(true).setSameSite(SameSiteAttribute.LAX)));
        }

        page.navigate(idpUrl, new Page.NavigateOptions().setWaitUntil(WaitUntilState.DOMCONTENTLOADED).setTimeout(30000));

        System.out.println("[preAuth] IdP form page: " + page.url().substring(0, Math.min(page.url().length(), 70)));

        fillFirst(page, sel(formSel, "username", List.of("#userNameInput", "input[type='email']", "input[name='username']")), user, "username");
        fillFirst(page, sel(formSel, "password", List.of("#passwordInput", "input[name='Password']", "input[type='password']")), pass, "password");
        // 값이 폼에 반영되도록 짧은 안정화 대기 (ADFS는 클릭 직후 검증)
        page.waitForTimeout(300);
        boolean submitted = false;
        for (String s : sel(formSel, "submit", List.of("#submitButton", "input[type='submit']", "button[type='submit']"))) {
            Locator el = page.locator(s).first();
            if (isVisible(el)) {
                // 클릭 → IdP 처리 → localhost 콜백 네비게이션 대기
                el.click();
                try {
                    page.waitForURL(Pattern.compile("^(?!.*\\/adfs\\/oauth2\\/authorize).*$"),
                            new Page.WaitForURLOptions().setTimeout(30000).setWaitUntil(WaitUntilState.COMMIT));
                } catch (RuntimeException ignored) {}
                submitted = true;
                System.out.println("[preAuth] submitted (" + s + ")");
                break;
            }
        }
        if (!submitted) System.out.println("[preAuth] ⚠ submit button not found");

        try {
            page.waitForURL(Pattern.quote(baseUrl) + ".*", new Page.WaitForURLOptions().setTimeout(30000).setWaitUntil(WaitUntilState.COMMIT));
        } catch (RuntimeException ignored) {}
        try {
            page.waitForLoadState(LoadState.NETWORKIDLE, new Page.WaitForLoadStateOptions().setTimeout(20000));
        } catch (RuntimeException ignored) {}
        System.out.println("[preAuth] login complete: " + page.url());
    }

    static List<String> sel(JSONObject formSel, String key, List<String> def) {
        Object v = formSel.get(key);
        if (v == null) return def;
        return Arrays.stream(((String) v).split(",")).map(String::trim).toList();
    }

    static boolean isVisible(Locator el) {
        try { return el.isVisible(new Locator.IsVisibleOptions().setTimeout(3000)); }
        catch (RuntimeException e) { return false; }
    }

    static void fillFirst(Page page, List<String> selectors, String value, String label) {
        for (String s : selectors) {
            Locator el = page.locator(s).first();
            if (isVisible(el)) {
                el.fill(value);
                System.out.println("[preAuth] " + label + " filled (" + s + ")");
                return;
            }
        }
        page.screenshot(new Page.ScreenshotOptions().setPath(Paths.get("/tmp", "preauth-" + label + "-debug.png")).setFullPage(true));
        throw new RuntimeException("preAuth: " + label + " field not found (debug: /tmp/preauth-" + label + "-debug.png)");
    }

    public static void main(String[] args) throws Exception {
        if (args.length < 1) { System.err.println("Usage: jbang DumpPage.java <config.json>"); System.exit(1); }
        JSONObject cfg = (JSONObject) new JSONParser().parse(Files.readString(Paths.get(args[0])));
        if (cfg.get("url") == null || cfg.get("outDir") == null) {
            System.err.println("Config missing required field: \"url\" and/or \"outDir\""); System.exit(1);
        }
        String outDir = (String) cfg.get("outDir");
        Files.createDirectories(Paths.get(outDir));
        System.out.println("[dump-page] url=" + cfg.get("url") + " outDir=" + outDir);

        JSONObject viewport = get(cfg, "viewport", null);
        // viewport 하한 강제 — 1920x1080 미만은 끌어올린다(작은 캡처로 merged 해상도가 쪼그라드는 것 방지).
        // 넓은 페이지용으로 더 큰 값을 명시하면 존중한다.
        int vw = Math.max(1920, viewport != null ? getInt(viewport, "width", 1920) : 1920);
        int vh = Math.max(1080, viewport != null ? getInt(viewport, "height", 1080) : 1080);
        boolean ignoreHttps = !Boolean.FALSE.equals(cfg.get("ignoreHTTPSErrors"));
        String storageState = (String) cfg.get("storageState");
        boolean hasSession = storageState != null && Files.exists(Paths.get(storageState));

        try (Playwright pw = Playwright.create()) {
            Browser browser = pw.chromium().launch(new BrowserType.LaunchOptions().setProxy(buildProxy()));
            Browser.NewContextOptions ctxOpts = new Browser.NewContextOptions()
                    .setIgnoreHTTPSErrors(ignoreHttps).setViewportSize(vw, vh).setDeviceScaleFactor(1);
            if (hasSession) ctxOpts.setStorageStatePath(Paths.get(storageState));
            BrowserContext context = browser.newContext(ctxOpts);
            Page page = context.newPage();
            try {
                JSONObject preAuth = get(cfg, "preAuth", null);
                if (preAuth != null && !hasSession) {
                    runPreAuth(page, preAuth);
                    // 로그인한 세션을 storageState 경로에 저장 → 이후 호출(다른 페이지)이 재사용해 로그인 1회로 끝냄
                    if (storageState != null) {
                        context.storageState(new BrowserContext.StorageStateOptions().setPath(Paths.get(storageState)));
                        System.out.println("[preAuth] session saved: " + storageState);
                    }
                }

                // waitFor: "auto" 면 goto는 domcontentloaded로 빠르게 진입 후 범용 로딩 대기.
                // 그 외("load"|"domcontentloaded"|"networkidle")는 기존처럼 goto가 해당 상태까지 대기.
                String waitFor = get(cfg, "waitFor", "networkidle");
                boolean isAuto = "auto".equals(waitFor);
                int captureDelay = getInt(cfg, "captureDelay", 1000);
                page.navigate((String) cfg.get("url"), new Page.NavigateOptions()
                        .setWaitUntil(isAuto ? WaitUntilState.DOMCONTENTLOADED
                                : WaitUntilState.valueOf(waitFor.toUpperCase()))
                        .setTimeout(getInt(cfg, "gotoTimeout", 30000)));

                if (isAuto) waitForAutoReady(page, captureDelay);

                String waitForSelector = (String) cfg.get("waitForSelector");
                if (waitForSelector != null) page.waitForSelector(waitForSelector, new Page.WaitForSelectorOptions().setTimeout(10000));

                JSONArray actions = get(cfg, "actions", new JSONArray());
                if (!actions.isEmpty()) runActions(page, actions);

                JSONArray captures = get(cfg, "captures", new JSONArray());
                for (Object o : captures) {
                    JSONObject cap = (JSONObject) o;
                    String type = (String) cap.get("type");
                    if ("screenshot".equals(type)) captureScreenshot(page, cap, outDir, captureDelay, isAuto);
                    else System.out.println("  ⚠ unknown capture: " + type);
                }
                System.out.println("\n✅ Done. Output: " + outDir);
            } catch (Exception err) {
                System.out.println("❌ Error: " + err.getMessage());
                System.exit(1);
            } finally {
                browser.close();
            }
        }
    }
}
