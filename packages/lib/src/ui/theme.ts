/**
 * 디자인 시스템의 타입 표면 — C-1.4.
 *
 * 색 값 자체는 `tokens.css` 의 CSS 변수에만 존재한다. 여기서는 **토큰 이름만** 다뤄
 * "raw hex 직접 사용 금지"(design §2.1) 규칙이 코드에서도 지켜지게 한다.
 */

/** 상태 배지에 쓰는 accent 등급. 새 색을 늘리지 않고 이 4단계를 재사용한다. */
export type AccentLevel = 'accent' | 'success' | 'warning' | 'error' | 'neutral';

const ACCENT_VAR: Record<AccentLevel, { fg: string; bg: string }> = {
  accent: { fg: 'var(--accent)', bg: 'var(--accent-wash)' },
  success: { fg: 'var(--accent-success)', bg: 'var(--accent-success-wash)' },
  warning: { fg: 'var(--accent-warning)', bg: 'var(--accent-warning-wash)' },
  error: { fg: 'var(--accent-error)', bg: 'var(--accent-error-wash)' },
  neutral: { fg: 'var(--on-surface-variant)', bg: 'var(--surface-container-3)' },
};

/** 배지 색을 토큰 참조로 돌려준다. 호출부는 hex 를 알 필요가 없다. */
export function accentTokens(level: AccentLevel): { color: string; background: string } {
  const t = ACCENT_VAR[level];
  return { color: t.fg, background: t.bg };
}

/** 사이드바 항목. 근거: design §3 — 12항목, 순서 고정. */
export interface NavItem {
  readonly label: string;
  readonly href: string;
  readonly requiresAdmin: boolean;
}

export const SIDEBAR_ITEMS = [
  { label: '대시보드', href: '/', requiresAdmin: false },
  { label: 'SR 등록', href: '/register', requiresAdmin: false },
  { label: '내 요청', href: '/requests', requiresAdmin: false },
  { label: '장애 대응', href: '/incidents', requiresAdmin: false },
  { label: '자체개선', href: '/improvements', requiresAdmin: false },
  { label: '개발 규정', href: '/memory', requiresAdmin: false },
  { label: '관리 > Org', href: '/admin/orgs', requiresAdmin: true },
  { label: '관리 > Repo', href: '/admin/repos', requiresAdmin: true },
  { label: '관리 > 장애 템플릿', href: '/admin/incident-templates', requiresAdmin: true },
  { label: '관리 > 개선 대상', href: '/admin/improvement-targets', requiresAdmin: true },
  { label: '관리 > 규정 시스템', href: '/admin/memory-systems', requiresAdmin: true },
  { label: '관리 > MCP 토큰', href: '/admin/memory-tokens', requiresAdmin: true },
] as const satisfies readonly NavItem[];

/** 역할에 따라 보이는 항목만 남긴다. 표시 제어일 뿐 — 실제 인가는 서버가 한다. */
export function visibleNavItems(role: 'user' | 'admin'): readonly NavItem[] {
  return role === 'admin' ? SIDEBAR_ITEMS : SIDEBAR_ITEMS.filter((i) => !i.requiresAdmin);
}
