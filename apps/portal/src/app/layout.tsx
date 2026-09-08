import type { ReactNode } from 'react';
import type { UserRole } from '@aiways/contracts';
// globals.css 가 tokens.css · layout.css · Tailwind v4 를 함께 들여온다 (F-1 A안).
import './globals.css';
import { Sidebar } from '@/components/Sidebar';
import { auth } from '@/auth';

export const metadata = {
  title: 'AIways-On',
  description: 'SDLC 자동화 포털',
};

/**
 * 글로벌 레이아웃 — US-U1-05.
 * 근거: design/ §3 (No Top Nav · 사이드바 12항목)
 *
 * 테마는 `prefers-color-scheme` 이 자동으로 정한다 (Q14=C). 토큰은 `tokens.css` 에 있다.
 */
export default async function RootLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  const role: UserRole | null = session?.user
    ? ((session.user as { role?: UserRole }).role ?? 'user')
    : null;

  return (
    <html lang="ko">
      <body>
        {role ? (
          <div className="app-shell">
            <Sidebar role={role} />
            <main className="app-canvas">{children}</main>
          </div>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
