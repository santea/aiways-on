'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { visibleNavItems } from '@aiways/lib/ui';
import type { UserRole } from '@aiways/contracts';

/**
 * 글로벌 사이드바 — design/ §3.
 *
 * 상단 네비게이션이 없다(No Top Nav). 모든 메뉴가 여기 모인다.
 * active 항목은 좌측 4px cyan blade + `--sidebar-active` 배경 + glow (design §2.4).
 *
 * ⚠️ 역할로 항목을 거르는 것은 **표시 제어일 뿐**이다. 실제 인가는 서버의
 *    `requireAdmin()` 이 수행한다 — 메뉴를 숨기는 것으로 권한을 지키지 않는다.
 */
export function Sidebar({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const items = visibleNavItems(role);

  return (
    <nav className="sidebar" aria-label="주 메뉴" data-testid="global-sidebar">
      <div className="sidebar-brand">
        <b>AIways-On</b>
        <span className="label-tech">SDLC Portal</span>
      </div>
      <ul className="sidebar-nav">
        {items.map((item) => {
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={active ? 'sidebar-link is-active' : 'sidebar-link'}
                aria-current={active ? 'page' : undefined}
                data-testid={`sidebar-link-${item.href === '/' ? 'dashboard' : item.href.replace(/\//g, '-').replace(/^-/, '')}`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
