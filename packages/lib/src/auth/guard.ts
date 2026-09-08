/**
 * AuthGuard 계약 — AD-2 · F-1.
 *
 * **인증 전체(사용자 + 서버간)를 U1 이 단독 소유한다.** 다른 유닛은 이 함수들을 소비만 하며,
 * 자체 인증 검증 코드를 작성하지 않는다. 모든 라우트는 아래 함수 중 하나를 반드시 통과한다
 * — 예외는 `PUBLIC_PATH_PREFIXES` 에 명시된 경로뿐이다 (deny-by-default, SECURITY-08).
 *
 * 7함수 → 10함수 확장 근거는 `schemes.ts` 의 F-1 주석 참조.
 */
import type { AuthenticatedUser } from '@aiways/contracts';

/** 인증·인가 실패. 라우트는 이 값을 그대로 HTTP 응답으로 옮긴다. */
export class AuthError extends Error {
  constructor(
    readonly status: 401 | 403,
    readonly code: 'UNAUTHORIZED' | 'FORBIDDEN',
    message: string,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/** 최소한의 요청 표면 — Next.js `Request` 와 테스트 더블 양쪽을 받는다. */
export interface AuthRequestLike {
  readonly headers: { get(name: string): string | null };
  readonly url: string;
}

/* ── 사용자 인증 (세션) ─────────────────────────────────────────── */

/** 로그인 세션을 요구한다. 없으면 401. */
export type RequireUser = () => Promise<AuthenticatedUser>;

/** admin 역할을 요구한다. **서버측에서 검증한다** — 클라이언트 주장에 의존하지 않는다. */
export type RequireAdmin = () => Promise<AuthenticatedUser>;

/**
 * 리소스 소유권을 요구한다 — IDOR 방지 (NFR-12).
 * admin 은 통과하고, 그 외에는 `ownerId` 가 세션 사용자와 일치해야 한다.
 */
export type RequireOwnership = (ownerId: string | null) => Promise<AuthenticatedUser>;

/* ── 서버간 인증 ────────────────────────────────────────────────── */

/** 내부 API 기본 키. */
export type RequireMasterKey = (req: AuthRequestLike) => void;
/** Pod Runner 호출 검증. */
export type RequirePodToken = (req: AuthRequestLike) => void;
/** MCP `sdlcmem_*` Bearer — 해시 조회가 필요하므로 비동기다. */
export type RequireMemoryToken = (req: AuthRequestLike) => Promise<MemoryTokenGrant>;
/** CronJob 정합성 복구 — F-1 추가. */
export type RequireReconcileToken = (req: AuthRequestLike) => void;
/** Pod·n8n 채널 알림 콜백 — F-1 추가. 미설정 시 master key 로 검증한다. */
export type RequireCallbackBearer = (req: AuthRequestLike) => void;
/**
 * MCP 토큰 발급 — F-1 추가.
 * **master key 로 대체되지 않는다.** 발급 권한 분리가 이 함수의 존재 이유다.
 */
export type RequireTokenIssuer = (req: AuthRequestLike) => void;

export interface MemoryTokenGrant {
  readonly tokenId: string;
  readonly scope: 'read' | 'read_write';
  readonly subjectType: 'developer' | 'agent';
  readonly requestId: string | null;
}

/* ── 이미지 서명 ────────────────────────────────────────────────── */

/** 서명된 서빙 URL 을 만든다. */
export type SignImageUrl = (input: { imageId: string; ttlSeconds?: number }) => string;
/** 서명 토큰을 검증한다. 실패 시 `AuthError`. */
export type VerifyImageToken = (input: { imageId: string; token: string }) => void;

/** 10함수를 한 객체로 묶은 계약. 다른 유닛은 이 타입으로만 의존한다. */
export interface AuthGuard {
  readonly requireUser: RequireUser;
  readonly requireAdmin: RequireAdmin;
  readonly requireOwnership: RequireOwnership;
  readonly requireMasterKey: RequireMasterKey;
  readonly requirePodToken: RequirePodToken;
  readonly requireMemoryToken: RequireMemoryToken;
  readonly requireReconcileToken: RequireReconcileToken;
  readonly requireCallbackBearer: RequireCallbackBearer;
  readonly requireTokenIssuer: RequireTokenIssuer;
  readonly signImageUrl: SignImageUrl;
  readonly verifyImageToken: VerifyImageToken;
}

/**
 * 인증 예외 경로 — 이 접두로 시작하는 경로만 미들웨어를 통과한다.
 * 근거: requirements/01-auth-github.md §7
 *
 * ⚠️ Bearer 인증 엔드포인트(`/api/v1/sdlc/intake` 등)는 **여기에 넣지 않는다.**
 *    미들웨어의 보호 대상으로 남기고 라우트 핸들러 안에서 상수 시간 비교로 검증한다.
 */
export const PUBLIC_PATH_PREFIXES = [
  '/api/auth',
  '/api/health',
  '/_next',
  '/login',
  '/favicon',
  '/api/v1/sdlc/images',
] as const;

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some((p) => pathname.startsWith(p));
}
