/**
 * 서버간 인증 검증 구현 — AD-2 · F-1.
 *
 * **모든 서버간 Bearer 검증이 이 파일 하나를 통과한다.** 유닛 코드에 자체 토큰 비교를
 * 작성하는 것은 AD-2 위반이며 리뷰에서 막는다 (auth-scheme-inventory.md §4).
 *
 * fail-closed (SECURITY-15): 기대 토큰이 설정돼 있지 않으면 **통과가 아니라 거부**한다.
 */
import type { AuthRequestLike } from './guard';
import { AuthError } from './guard';
import { extractBearer, safeEqual } from './compare';
import { SERVER_AUTH_SCHEMES, type ServerAuthScheme } from './schemes';

export type AuthEnv = Readonly<Partial<Record<string, string>>>;

function verify(env: AuthEnv, scheme: ServerAuthScheme, req: AuthRequestLike): void {
  const def = SERVER_AUTH_SCHEMES[scheme];
  let expected = env[def.envVar];

  if (!expected && def.fallback) {
    // 선택적 스킴이 설정돼 있지 않을 때만 대체 스킴으로 검증한다 (C-1).
    expected = env[SERVER_AUTH_SCHEMES[def.fallback].envVar];
  }

  // 기대값이 없으면 열지 않는다. 설정 누락은 통과 사유가 아니다.
  if (!expected) {
    throw new AuthError(401, 'UNAUTHORIZED', `${def.envVar} 미설정 — 요청을 거부한다`);
  }

  const presented = extractBearer(req.headers.get('authorization'));
  if (!presented || !safeEqual(presented, expected)) {
    throw new AuthError(401, 'UNAUTHORIZED', '유효하지 않은 서버간 인증 토큰');
  }
}

/**
 * 환경 변수를 주입받아 서버간 검증 함수를 만든다.
 * 주입식이라 테스트가 전역 `process.env` 를 건드리지 않는다.
 */
export function createServerAuth(env: AuthEnv) {
  return {
    requireMasterKey: (req: AuthRequestLike) => verify(env, 'master', req),
    requirePodToken: (req: AuthRequestLike) => verify(env, 'pod', req),
    requireReconcileToken: (req: AuthRequestLike) => verify(env, 'reconcile', req),
    requireCallbackBearer: (req: AuthRequestLike) => verify(env, 'callback', req),
    /**
     * ⚠️ master key 로 대체되지 않는다 (`schemes.ts` 의 fallback 이 `null`).
     * 이 엔드포인트는 임의 규정에 대한 read_write 토큰을 발급할 수 있어, master key 를
     * 가진 모든 컴포넌트가 발급 권한을 얻으면 MCP 침해 시 침해자가 전 규정을 재작성할
     * 토큰을 스스로 발급하게 된다.
     */
    requireTokenIssuer: (req: AuthRequestLike) => verify(env, 'tokenIssuer', req),
  };
}

export type ServerAuth = ReturnType<typeof createServerAuth>;
