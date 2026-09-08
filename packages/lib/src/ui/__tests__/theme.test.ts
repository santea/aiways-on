import { describe, expect, it } from 'vitest';
import { SIDEBAR_ITEMS, accentTokens, visibleNavItems } from '../theme';

describe('사이드바', () => {
  it('12항목이다 (design §3)', () => {
    expect(SIDEBAR_ITEMS).toHaveLength(12);
  });

  it('일반 사용자에게는 관리 항목을 보여주지 않는다', () => {
    const items = visibleNavItems('user');
    expect(items).toHaveLength(6);
    expect(items.every((i) => !i.requiresAdmin)).toBe(true);
  });

  it('admin 에게는 12항목 전부 보인다', () => {
    expect(visibleNavItems('admin')).toHaveLength(12);
  });

  it('경로가 중복되지 않는다', () => {
    const hrefs = SIDEBAR_ITEMS.map((i) => i.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it('순서가 명세와 같다 — 대시보드가 처음, MCP 토큰이 마지막', () => {
    expect(SIDEBAR_ITEMS[0]?.href).toBe('/');
    expect(SIDEBAR_ITEMS.at(-1)?.href).toBe('/admin/memory-tokens');
  });
});

describe('accent 토큰', () => {
  it('raw hex 가 아니라 CSS 변수 참조를 돌려준다 (design §2.1)', () => {
    for (const level of ['accent', 'success', 'warning', 'error', 'neutral'] as const) {
      const t = accentTokens(level);
      expect(t.color).toMatch(/^var\(--/);
      expect(t.background).toMatch(/^var\(--/);
    }
  });
});
