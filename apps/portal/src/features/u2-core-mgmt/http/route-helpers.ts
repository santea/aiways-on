/**
 * 라우트 공통 배선.
 *
 * 모든 U2 라우트가 이 래퍼를 통과한다. 그래서 오류 포맷이 갈라지지 않고
 * (§7), 예상 못 한 예외가 스택째 새어 나가지 않는다 (NFR-16).
 */
import { toErrorResponse, validationFailed } from '@aiways/lib/http';

export type RouteHandler = (request: Request, context?: unknown) => Promise<Response>;

/** 핸들러를 감싸 §7 오류 포맷을 보장한다. */
export function handle(fn: RouteHandler): RouteHandler {
  return async (request, context) => {
    try {
      return await fn(request, context);
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}

/** JSON 본문을 읽는다. 깨진 본문은 500 이 아니라 400 이다. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw validationFailed('요청 본문이 올바른 JSON 이 아니다');
  }
}

/** Next.js 동적 라우트 컨텍스트에서 경로 파라미터를 꺼낸다. */
export async function routeParam(context: unknown, name: string): Promise<string> {
  const params = await (context as { params?: Promise<Record<string, string>> } | undefined)
    ?.params;
  const value = params?.[name];
  if (!value) throw validationFailed(`경로 파라미터 ${name} 가 없다`);
  return value;
}

/** 쿼리 파라미터를 정수로 읽는다. 범위를 벗어나면 기본값으로 되돌린다. */
export function intParam(
  url: URL,
  name: string,
  fallback: number,
  { min, max }: { min: number; max: number },
): number {
  const raw = url.searchParams.get(name);
  if (raw === null) return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) return fallback;
  return parsed;
}
