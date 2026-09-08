import { beforeEach, describe, expect, it } from 'vitest';
import { AuthError } from '../guard';
import { createServerAuth } from '../server-auth';

/** 최소 요청 더블 — Authorization 헤더만 갖는다. */
const req = (authorization?: string) => ({
  url: 'https://portal.local/api/v1/sdlc/advance',
  headers: { get: (n: string) => (n.toLowerCase() === 'authorization' ? (authorization ?? null) : null) },
});

const ENV = {
  SDLC_MASTER_KEY: 'master-secret-value',
  POD_AUTH_TOKEN: 'pod-secret-value',
  SDLC_RECONCILE_TOKEN: 'reconcile-secret-value',
  SDLC_MEMORY_TOKEN_ISSUER_TOKEN: 'issuer-secret-value',
};

describe('서버간 인증 검증', () => {
  let auth: ReturnType<typeof createServerAuth>;
  beforeEach(() => {
    auth = createServerAuth({ ...ENV });
  });

  it('올바른 master key 를 통과시킨다', () => {
    expect(() => auth.requireMasterKey(req('Bearer master-secret-value'))).not.toThrow();
  });

  it('헤더가 없으면 401 로 거부한다', () => {
    expect(() => auth.requireMasterKey(req())).toThrow(AuthError);
    try {
      auth.requireMasterKey(req());
    } catch (e) {
      expect((e as AuthError).status).toBe(401);
    }
  });

  it('Bearer 접두가 없으면 거부한다', () => {
    expect(() => auth.requireMasterKey(req('master-secret-value'))).toThrow(AuthError);
  });

  it('값이 틀리면 거부한다', () => {
    expect(() => auth.requireMasterKey(req('Bearer wrong-value'))).toThrow(AuthError);
  });

  it('길이가 다른 값도 안전하게 거부한다 (상수 시간 비교 경로)', () => {
    expect(() => auth.requireMasterKey(req('Bearer x'))).toThrow(AuthError);
  });

  it('스킴을 교차 사용하면 거부한다 — pod 토큰으로 master 경로에 들어올 수 없다', () => {
    expect(() => auth.requireMasterKey(req('Bearer pod-secret-value'))).toThrow(AuthError);
    expect(() => auth.requirePodToken(req('Bearer master-secret-value'))).toThrow(AuthError);
  });

  it('reconcile 토큰은 전용 값만 통과시킨다 (F-1)', () => {
    expect(() => auth.requireReconcileToken(req('Bearer reconcile-secret-value'))).not.toThrow();
    expect(() => auth.requireReconcileToken(req('Bearer master-secret-value'))).toThrow(AuthError);
  });

  it('토큰 발급 검증은 master key 로 대체되지 않는다 (F-1 · 권한 분리)', () => {
    expect(() => auth.requireTokenIssuer(req('Bearer issuer-secret-value'))).not.toThrow();
    expect(() => auth.requireTokenIssuer(req('Bearer master-secret-value'))).toThrow(AuthError);
  });

  it('callback bearer 는 설정돼 있으면 전용 값을 요구한다', () => {
    const withCallback = createServerAuth({ ...ENV, SDLC_CALLBACK_BEARER: 'callback-secret-value' });
    expect(() => withCallback.requireCallbackBearer(req('Bearer callback-secret-value'))).not.toThrow();
    expect(() => withCallback.requireCallbackBearer(req('Bearer master-secret-value'))).toThrow(AuthError);
  });

  it('callback bearer 미설정 시 master key 로 검증한다 — fail-open 이 아니다 (C-1)', () => {
    expect(() => auth.requireCallbackBearer(req('Bearer master-secret-value'))).not.toThrow();
    expect(() => auth.requireCallbackBearer(req('Bearer anything-else'))).toThrow(AuthError);
  });

  it('필요한 환경 변수가 비어 있으면 통과가 아니라 거부한다 (fail-closed, SECURITY-15)', () => {
    const empty = createServerAuth({});
    expect(() => empty.requireMasterKey(req('Bearer '))).toThrow(AuthError);
    expect(() => empty.requireMasterKey(req('Bearer undefined'))).toThrow(AuthError);
    expect(() => empty.requireReconcileToken(req('Bearer reconcile-secret-value'))).toThrow(AuthError);
  });
});
