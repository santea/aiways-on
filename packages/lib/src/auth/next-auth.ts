/**
 * Auth.js v5 설정 — US-U1-01.
 * 근거: requirements/01-auth-github.md §3
 *
 * `session.strategy = 'jwt'` — Portal 은 stateless 여야 하므로 서버 메모리 세션을 쓰지 않는다
 * (NFR-01). GitHub access token 은 JWT 안에만 두고 **클라이언트로 내보내지 않는다** (§6.2).
 */
import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import type { UserRole } from '@aiways/contracts';
import { getDb } from '../db/client';
import { accounts, sessions, users, verificationTokens } from '../db/schema/core';
import { resolveInitialRole } from './session';

export function createAuth() {
  const db = getDb();

  return NextAuth({
    adapter: DrizzleAdapter(db, {
      usersTable: users,
      accountsTable: accounts,
      sessionsTable: sessions,
      verificationTokensTable: verificationTokens,
    }),
    session: { strategy: 'jwt' },
    pages: { signIn: '/login' },
    providers: [
      GitHub({
        clientId: process.env['AUTH_GITHUB_ID'],
        clientSecret: process.env['AUTH_GITHUB_SECRET'],
        // Pod 용 PAT 는 별도 관리한다. 사용자 세션은 조회 권한만 받는다 (§6.2).
        authorization: { params: { scope: 'read:user user:email' } },
      }),
    ],
    callbacks: {
      jwt({ token, profile, account }) {
        if (account?.access_token) {
          // 서버 전용. session 콜백에서 클라이언트로 내보내지 않는다.
          token['githubAccessToken'] = account.access_token;
        }
        if (profile) {
          const login = typeof profile['login'] === 'string' ? profile['login'] : '';
          token['githubId'] = String(profile['id'] ?? '');
          token['login'] = login;
          token['avatarUrl'] = profile['avatar_url'];
          token['name'] = profile['name'] ?? login;
          token['role'] = resolveInitialRole(login, process.env['INITIAL_ADMIN_GITHUB_LOGINS']);
        }
        return token;
      },
      session({ session, token }) {
        if (token.sub) {
          Object.assign(session.user, {
            id: token.sub,
            githubId: token['githubId'] as string,
            login: token['login'] as string,
            avatarUrl: token['avatarUrl'] as string,
            role: (token['role'] as UserRole) ?? 'user',
          });
        }
        return session;
      },
    },
  });
}
