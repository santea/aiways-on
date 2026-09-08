/**
 * 서버간 인증 스킴 레지스트리 — F-1.
 *
 * AD-2 는 `AuthGuard` 를 **모든 인증의 단일 검증 지점**으로 정했다. 그런데 컴포넌트 정의는
 * "서버간 인증 4종"을 전제로 7개 함수를 선언했고, 명세의 활성 스킴은 그보다 많았다.
 * 누락을 방치하면 각 스킴이 그것을 필요로 하는 유닛의 라우트에서 개별 구현되어
 * AD-2 가 막으려던 분산이 그대로 발생한다 (SECURITY-11 위배).
 * → 함수를 10개로 확장하고, 스킴 목록을 이 파일 하나로 모은다.
 *
 * ⚠️ 문서 간 모순 (C-1) — 확인된 사실만 적는다:
 *   - `01-auth-github.md` §7 은 "서버간 인증은 SDLC_MASTER_KEY 단일 키"라는 **원칙**을 세우고,
 *     예외로 토큰 발급 권한(`SDLC_MEMORY_TOKEN_ISSUER_TOKEN`)만 분리 유지한다고 적는다.
 *   - `05-portal-api.md` 인증 표와 `10-k8s-infrastructure.md` 의 실제 CronJob 호출은
 *     `SDLC_RECONCILE_TOKEN` 과 `SDLC_CALLBACK_BEARER` 를 **구체적으로 지정**한다.
 *   두 문서가 어긋나므로 **구체적 지정을 따르되**, `SDLC_CALLBACK_BEARER` 는
 *   10-k8s 가 "(선택)"으로 표시했으므로 미설정 시 master key 로 검증한다 (아래 `fallback`).
 *   이 판단은 U1 Code Generation 에서 내렸고 되돌릴 수 있다.
 */

/** 서버간 호출에 쓰이는 스킴 식별자. */
export type ServerAuthScheme =
  | 'master'
  | 'pod'
  | 'memory'
  | 'reconcile'
  | 'callback'
  | 'tokenIssuer'
  | 'imageSignature';

export interface SchemeDefinition {
  /** 검증에 쓰는 환경 변수 이름. */
  readonly envVar: string;
  /** 미설정 시 대체 스킴. `null` 이면 미설정은 곧 거부다 (fail-closed). */
  readonly fallback: ServerAuthScheme | null;
  /** 이 스킴을 쓰는 대표 경로 — 리뷰 시 대조용. */
  readonly usedBy: readonly string[];
  readonly note: string;
}

export const SERVER_AUTH_SCHEMES = {
  master: {
    envVar: 'SDLC_MASTER_KEY',
    fallback: null,
    usedBy: [
      'POST /api/v1/sdlc/intake',
      'POST /api/v1/sdlc/advance',
      'POST /api/v1/sdlc/requests/:id/*',
      'POST /api/v1/sdlc/incidents/ingest',
      'POST /api/internal/sdlc/improvement-scan',
      'POST /api/internal/sdlc/memory/rules',
    ],
    note: '내부 서버간 호출의 기본 키. 유출 시 전 경로가 노출되는 잔존 위험은 명세가 기록해 두었다.',
  },
  pod: {
    envVar: 'POD_AUTH_TOKEN',
    fallback: null,
    usedBy: ['Portal → Pod Runner 호출'],
    note: 'Pod Runner 가 자신에게 오는 호출을 검증할 때 쓰는 토큰.',
  },
  memory: {
    envVar: 'SDLC_MEMORY_TOKEN_PREFIX',
    fallback: null,
    usedBy: ['Memory MCP :58002'],
    note: 'sdlcmem_* Bearer. 환경 변수가 아니라 sdlc_memory_access_tokens 의 sha256 해시로 검증한다.',
  },
  reconcile: {
    envVar: 'SDLC_RECONCILE_TOKEN',
    fallback: null,
    usedBy: ['POST /api/internal/sdlc/reconcile'],
    note: 'CronJob 정합성 복구 전용. 10-k8s-infrastructure.md 의 CronJob 이 이 토큰으로 호출한다.',
  },
  callback: {
    envVar: 'SDLC_CALLBACK_BEARER',
    fallback: 'master',
    usedBy: ['POST /api/v1/sdlc/channel-notification'],
    note: '10-k8s 가 "(선택)"으로 표시한 공유 시크릿. 미설정 시 master key 로 검증한다 (C-1).',
  },
  tokenIssuer: {
    envVar: 'SDLC_MEMORY_TOKEN_ISSUER_TOKEN',
    fallback: null,
    usedBy: ['POST /api/internal/sdlc/memory/tokens/issue-scoped'],
    note:
      '절대 master key 로 대체하지 않는다. 이 엔드포인트는 임의 규정에 대한 read_write 토큰을 ' +
      '발급할 수 있어, master key 를 가진 모든 컴포넌트(MCP 서버 포함)가 발급 권한을 얻으면 ' +
      'MCP 침해 시 침해자가 전 규정을 재작성할 토큰을 스스로 발급하게 된다.',
  },
  imageSignature: {
    envVar: 'SDLC_IMAGE_SIGNING_SECRET',
    fallback: null,
    usedBy: ['GET /api/v1/sdlc/images/:id?token='],
    note: 'HMAC 서명 URL. 미들웨어 예외이며 라우트 내부에서 검증한다.',
  },
} as const satisfies Record<ServerAuthScheme, SchemeDefinition>;

/**
 * ⚠️ 의도적으로 만들지 않은 것.
 *
 * `SLACK_SIGNING_SECRET` — `SLACK_INBOUND_MODE=events-api` 일 때만 필요하다.
 * 이 시스템은 gateway 모드(SVC-4 Slack Gateway, replicas 1 고정)를 쓰므로 미사용이며,
 * 쓰지 않을 검증 코드를 미리 만들지 않는다. events-api 모드로 전환한다면
 * `slackSignature` 스킴과 `requireSlackSignature()` 를 여기에 추가한다.
 *
 * `SDLC_INCIDENT_INGEST_TOKEN` — 명세가 master key 로 통합하며 제거했고 그로 인한
 * 잔존 위험까지 기록해 두었다. 되살리지 않는다.
 */
export const INTENTIONALLY_ABSENT_SCHEMES = [
  'SLACK_SIGNING_SECRET',
  'SDLC_INCIDENT_INGEST_TOKEN',
] as const;
