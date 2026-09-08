/**
 * 사용자 세션 가드 — AD-2.
 *
 * 세션 조회를 주입받는 팩토리 형태다. Auth.js 를 띄우지 않고도 인가 규칙 자체를
 * 테스트할 수 있고, 규칙이 Auth.js 버전에 묶이지 않는다.
 */
import type { AuthenticatedUser, UserRole } from '@aiways/contracts';
import { AuthError } from './guard';

export type GetSessionUser = () => Promise<AuthenticatedUser | null>;

export function createSessionGuards(getSessionUser: GetSessionUser) {
  const requireUser = async (): Promise<AuthenticatedUser> => {
    const user = await getSessionUser();
    if (!user) {
      throw new AuthError(401, 'UNAUTHORIZED', '로그인이 필요하다');
    }
    return user;
  };

  const requireAdmin = async (): Promise<AuthenticatedUser> => {
    const user = await requireUser();
    // 역할은 **서버측 세션에서만** 읽는다. 클라이언트가 보낸 값은 신뢰하지 않는다.
    if (user.role !== 'admin') {
      throw new AuthError(403, 'FORBIDDEN', '관리자 권한이 필요하다');
    }
    return user;
  };

  /**
   * 리소스 소유권 검사 — IDOR 방지 (NFR-12).
   * `ownerId` 가 비어 있으면 일반 사용자에게 열지 않는다. 소유자를 모르는 리소스를
   * 통과시키는 것이 이 방어의 전형적인 구멍이다.
   */
  const requireOwnership = async (ownerId: string | null): Promise<AuthenticatedUser> => {
    const user = await requireUser();
    if (user.role === 'admin') return user;
    if (!ownerId || ownerId !== user.id) {
      throw new AuthError(403, 'FORBIDDEN', '본인의 리소스만 접근할 수 있다');
    }
    return user;
  };

  return { requireUser, requireAdmin, requireOwnership };
}

/**
 * 최초 로그인 시 역할을 정한다.
 * 근거: 01-auth-github.md §5.1 — `INITIAL_ADMIN_GITHUB_LOGINS` 콤마 구분 목록.
 */
export function resolveInitialRole(
  githubLogin: string,
  initialAdmins: string | undefined,
): UserRole {
  if (!githubLogin) return 'user';
  const admins = (initialAdmins ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return admins.includes(githubLogin) ? 'admin' : 'user';
}
