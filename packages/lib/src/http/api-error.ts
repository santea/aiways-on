/**
 * 표준 오류 응답 — `05-portal-api.md` §7. F-2 (U2 Part 1 발견).
 *
 * 모든 오류는 `{ code, message }` 한 포맷으로 나간다. 이 매퍼가 없으면 네 유닛의
 * 라우트가 각자 try/catch 를 써서 포맷이 갈라진다. **알 수 없는 오류는 반드시
 * `INTERNAL_ERROR` 로 덮는다** — 스택·DSN·호스트가 응답에 새어 나가면 NFR-16 위반이다.
 */
import type { ApiError } from '@aiways/contracts';
import { AuthError } from '../auth/guard';

/** §7 에 정의된 오류 코드. 새 코드는 이 합집합에 추가한다. */
export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'STALE_FROM'
  | 'INVALID_TRANSITION'
  | 'GITHUB_ISSUE_CREATION_FAILED'
  | 'INTERNAL_ERROR';

/** 라우트가 의도적으로 던지는 오류. 상태·코드를 함께 들고 다닌다. */
export class ApiHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiHttpError';
  }
}

export const validationFailed = (message: string, details?: unknown): ApiHttpError =>
  new ApiHttpError(400, 'VALIDATION_ERROR', message, details);

export const notFound = (message: string): ApiHttpError =>
  new ApiHttpError(404, 'NOT_FOUND', message);

export const conflict = (code: Extract<ApiErrorCode, 'STALE_FROM'>, message: string): ApiHttpError =>
  new ApiHttpError(409, code, message);

export const invalidTransition = (message: string): ApiHttpError =>
  new ApiHttpError(422, 'INVALID_TRANSITION', message);

export const githubIssueFailed = (message: string, details?: unknown): ApiHttpError =>
  new ApiHttpError(500, 'GITHUB_ISSUE_CREATION_FAILED', message, details);

export interface ApiErrorPayload {
  readonly status: number;
  readonly body: ApiError;
}

/** 던져진 값이 무엇이든 §7 포맷으로 정규화한다. */
export function toApiErrorPayload(error: unknown): ApiErrorPayload {
  if (error instanceof ApiHttpError) {
    return {
      status: error.status,
      body:
        error.details === undefined
          ? { code: error.code, message: error.message }
          : { code: error.code, message: error.message, details: error.details },
    };
  }
  if (error instanceof AuthError) {
    return { status: error.status, body: { code: error.code, message: error.message } };
  }
  // 알 수 없는 오류의 원본 메시지는 절대 내보내지 않는다 (NFR-16, SECURITY-04).
  return {
    status: 500,
    body: { code: 'INTERNAL_ERROR', message: '요청을 처리하지 못했다' },
  };
}

/** 라우트 핸들러가 그대로 반환할 수 있는 JSON 응답. */
export function toErrorResponse(error: unknown): Response {
  const { status, body } = toApiErrorPayload(error);
  return Response.json(body, { status });
}
