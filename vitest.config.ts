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
    include: ['packages/**/*.test.ts', 'apps/**/*.test.ts', 'apps/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      // D-20 — CI 커버리지 게이트. 낮추려면 U1 승인이 필요하다.
      thresholds: { lines: 80, functions: 80, branches: 75, statements: 80 },
      // U2 F-4 — `apps/` 가 빠져 있어 U2~U6 다섯 유닛의 코드가 게이트에 잡히지 않았다.
      // 화면 컴포넌트(page.tsx)는 제외한다 — 렌더 검증은 Build and Test 의 E2E 몫이다.
      include: [
        'packages/lib/src/**/*.ts',
        'apps/portal/src/features/**/*.ts',
        'apps/portal/src/app/api/**/*.ts',
      ],
      exclude: [
        '**/__tests__/**',
        '**/db/schema/**',
        '**/index.ts',
        // Auth.js 프로바이더 배선. 우리 로직은 `resolveInitialRole` 하나이고 그것은
        // session.test.ts 가 직접 검사한다. 나머지는 라이브러리 설정이라 단위 테스트로
        // 검증할 대상이 없어 제외한다 — 커버리지 숫자를 맞추려는 제외가 아니다.
        '**/auth/next-auth.ts',
        // Drizzle 쿼리 빌더. 살아 있는 Postgres 없이는 실행되지 않고, 실행해도
        // 검증되는 것은 우리 로직이 아니라 드라이버다. **판단이 들어간 부분은
        // 일부러 밖으로 뺐다** — `request/row-mapping.ts` 가 그것이며 단위 테스트가 있다.
        // 쿼리 자체는 Build and Test 의 통합 테스트가 실제 DB에 대고 검증한다.
        'apps/portal/src/features/**/repository.ts',
      ],
    },
  },
});
