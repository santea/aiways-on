import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * 상수 시간 문자열 비교.
 *
 * 명세(01-auth-github.md §7)가 서버간 토큰 검증에 상수 시간 비교를 요구한다.
 * 두 값을 먼저 sha256 으로 고정 길이화한 뒤 비교하므로, 길이가 다를 때
 * `timingSafeEqual` 이 던지는 문제도 없고 길이 자체가 새어나가지도 않는다.
 */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a, 'utf8').digest();
  const hb = createHash('sha256').update(b, 'utf8').digest();
  return timingSafeEqual(ha, hb);
}

/** `Authorization: Bearer <token>` 에서 토큰만 꺼낸다. 형식이 아니면 `null`. */
export function extractBearer(header: string | null): string | null {
  if (!header) return null;
  const [scheme, ...rest] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer') return null;
  const token = rest.join(' ').trim();
  return token.length > 0 ? token : null;
}
