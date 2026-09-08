/**
 * 인증 미들웨어 — deny-by-default (SECURITY-08).
 *
 * 근거: requirements/01-auth-github.md §7
 *
 * ⚠️ Bearer 인증 엔드포인트(`/api/v1/sdlc/intake` 등)는 공개 경로에 넣지 않는다.
 *    여기서는 세션이 없으면 401 JSON 을 돌려주고, 실제 Bearer 검증은 라우트 핸들러가
 *    `@aiways/lib/auth` 의 함수로 수행한다. 리디렉션이 서버간 호출을 삼키지 않게 하려는 구조다.
 */
import type { NextRequest } from 'next/server';
// ⚠️ 배럴(`@aiways/lib/auth`)이 아니라 `guard` 를 직접 가져온다.
// 배럴은 `node:crypto` 를 쓰는 모듈을 함께 끌어와 Edge 미들웨어 번들을 깨뜨린다
// (실제 `next build` 에서 확인됨). `guard.ts` 는 런타임 의존이 없어 Edge 에서 안전하다.
import { isPublicPath } from '@aiways/lib/auth/guard';
import { auth } from '@/auth';

type AuthedRequest = NextRequest & { auth: unknown };

export default auth((req: AuthedRequest) => {
  const { pathname } = req.nextUrl;
  if (isPublicPath(pathname)) return;

  if (!req.auth) {
    if (pathname.startsWith('/api/')) {
      return Response.json({ code: 'UNAUTHORIZED', message: 'Login required' }, { status: 401 });
    }
    return Response.redirect(new URL('/login', req.nextUrl));
  }
  return;
});

export const config = {
  matcher: ['/((?!api/auth|api/health|_next|login|favicon).*)'],
};
