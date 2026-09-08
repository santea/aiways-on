import { describe, expect, it } from 'vitest';
import { AuthError } from '../../auth/guard';
import {
  ApiHttpError,
  conflict,
  invalidTransition,
  notFound,
  toApiErrorPayload,
  toErrorResponse,
  validationFailed,
} from '../api-error';

describe('toApiErrorPayload', () => {
  it('AuthError 의 상태·코드를 그대로 옮긴다', () => {
    const r = toApiErrorPayload(new AuthError(403, 'FORBIDDEN', '관리자 권한이 필요하다'));
    expect(r.status).toBe(403);
    expect(r.body.code).toBe('FORBIDDEN');
    expect(r.body.message).toBe('관리자 권한이 필요하다');
  });

  it('401 도 동일하게 옮긴다', () => {
    expect(toApiErrorPayload(new AuthError(401, 'UNAUTHORIZED', 'x')).status).toBe(401);
  });

  it.each([
    [validationFailed('필수 필드 누락'), 400, 'VALIDATION_ERROR'],
    [notFound('SR 을 찾을 수 없다'), 404, 'NOT_FOUND'],
    [conflict('STALE_FROM', '상태가 바뀌었다'), 409, 'STALE_FROM'],
    [invalidTransition('불법 전이'), 422, 'INVALID_TRANSITION'],
  ])('%# 표준 오류가 §7 매핑을 따른다', (err, status, code) => {
    const r = toApiErrorPayload(err);
    expect(r.status).toBe(status);
    expect(r.body.code).toBe(code);
  });

  it('검증 실패는 details 를 담을 수 있다', () => {
    const r = toApiErrorPayload(validationFailed('누락', [{ field: 'devType' }]));
    expect(r.body.details).toEqual([{ field: 'devType' }]);
  });

  it('알 수 없는 오류는 500 INTERNAL_ERROR 로 덮고 내부 정보를 노출하지 않는다', () => {
    const r = toApiErrorPayload(new Error('connect ECONNREFUSED 10.0.0.5:5432'));
    expect(r.status).toBe(500);
    expect(r.body.code).toBe('INTERNAL_ERROR');
    expect(r.body.message).not.toContain('ECONNREFUSED');
    expect(r.body.message).not.toContain('10.0.0.5');
  });

  it('문자열이 던져져도 500 으로 처리한다', () => {
    expect(toApiErrorPayload('boom').status).toBe(500);
  });

  it('ApiHttpError 는 code 와 status 를 함께 갖는다', () => {
    const e = new ApiHttpError(500, 'GITHUB_ISSUE_CREATION_FAILED', 'GitHub 실패');
    expect(toApiErrorPayload(e).body.code).toBe('GITHUB_ISSUE_CREATION_FAILED');
  });
});

describe('toErrorResponse', () => {
  it('§7 포맷의 JSON 응답을 만든다', async () => {
    const res = toErrorResponse(notFound('없다'));
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toContain('application/json');
    await expect(res.json()).resolves.toEqual({ code: 'NOT_FOUND', message: '없다' });
  });
});
