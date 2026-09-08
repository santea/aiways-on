/**
 * 대시보드 — US-U2-02 (`08-sr-registration-ui.md` §5).
 *
 * U1 이 두었던 `app/page.tsx` 자리표시자를 대체한다. 같은 경로를 두 파일이 해석하면
 * 빌드가 깨지므로 그 파일은 삭제했다 (PR 설명에 기재).
 */
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Section } from '@/components/ui/surface';
import { u2Deps } from '@/features/u2-core-mgmt/deps';
import { RequestTable, SummaryCards, countByBucket } from '@/features/u2-core-mgmt/ui/request-list';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const { items, total } = await u2Deps().query.listRequests({ limit: 10 });

  return (
    <div className="flex flex-col gap-8" data-testid="dashboard-page">
      <header className="flex flex-col gap-1">
        <p className="font-mono-id text-[10px] font-bold uppercase tracking-[0.08em] text-accent">
          SDLC
        </p>
        <h1 className="font-headline text-2xl font-extrabold tracking-tight text-ink">
          대시보드
        </h1>
      </header>

      <Section title="진행 현황">
        <SummaryCards counts={countByBucket(items)} />
      </Section>

      <Section
        title="최근 요청"
        action={
          <Link
            href="/requests"
            className="font-mono-id text-[11px] font-bold text-accent hover:underline"
            data-testid="dashboard-see-all-link"
          >
            전체 {total}건 보기
          </Link>
        }
      >
        <RequestTable items={items} />
      </Section>

      <Button asChild data-testid="dashboard-register-button">
        <Link href="/register">+ SDLC 요청 등록</Link>
      </Button>
    </div>
  );
}
