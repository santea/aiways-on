/**
 * 앱 단일 Auth.js 인스턴스. 라우트·미들웨어는 여기서만 가져온다.
 * 실제 설정은 U1 이 소유한 `@aiways/lib` 에 있다 (AD-2).
 *
 * ⚠️ `@aiways/lib/auth` (가드 배럴) 이 아니라 `@aiways/lib/auth/next-auth` 에서 가져온다.
 *    가드 배럴은 미들웨어가 쓰므로 DB 드라이버·어댑터를 끌어오면 안 된다.
 */
import { createAuth } from '@aiways/lib/auth/next-auth';

export const { handlers, auth, signIn, signOut } = createAuth();
