/**
 * GitHub primary email 보강 — 01-auth-github.md §3.2.
 *
 * GitHub 는 이메일이 private 이면 `profile.email` 을 비워 보낸다. 로그인 시
 * primary verified email 을 조회해 User 레코드를 채운다.
 *
 * ⚠️ 로그에 이메일 원문을 남기지 않는다 — 필요하면 `emailFingerprint()` 를 쓴다 (§6.2).
 */
import { createHash } from 'node:crypto';

interface GitHubEmail {
  readonly email: string;
  readonly primary: boolean;
  readonly verified: boolean;
}

export async function fetchPrimaryEmail(
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  const res = await fetchImpl('https://api.github.com/user/emails', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
    },
  });
  if (!res.ok) return null;
  const emails = (await res.json()) as GitHubEmail[];
  return emails.find((e) => e.primary && e.verified)?.email ?? emails[0]?.email ?? null;
}

/** 운영 로그용 지문. 이메일·토큰 원문 대신 이 값을 남긴다 (01-auth-github.md §6.2). */
export function emailFingerprint(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
}
