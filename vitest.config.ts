import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@aiways/contracts': r('./packages/contracts/src/index.ts'),
      '@aiways/lib': r('./packages/lib/src'),
    },
  },
  test: {
    environment: 'node',
    include: ['packages/**/*.test.ts', 'apps/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      // D-20 — CI 커버리지 게이트. 낮추려면 U1 승인이 필요하다.
      thresholds: { lines: 80, functions: 80, branches: 75, statements: 80 },
      include: ['packages/lib/src/**/*.ts'],
      exclude: [
        '**/__tests__/**',
        '**/db/schema/**',
        '**/index.ts',
        // Auth.js 프로바이더 배선. 우리 로직은 `resolveInitialRole` 하나이고 그것은
        // session.test.ts 가 직접 검사한다. 나머지는 라이브러리 설정이라 단위 테스트로
        // 검증할 대상이 없어 제외한다 — 커버리지 숫자를 맞추려는 제외가 아니다.
        '**/auth/next-auth.ts',
      ],
    },
  },
});
