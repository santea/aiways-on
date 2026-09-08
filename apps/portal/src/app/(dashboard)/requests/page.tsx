/** 내 요청 목록 — US-U2-02 (`05-portal-api.md` §2.13). */
import { Section } from '@/components/ui/surface';
import { u2Deps } from '@/features/u2-core-mgmt/deps';
import { RequestTable } from '@/features/u2-core-mgmt/ui/request-list';
import { RequestFilters } from '@/features/u2-core-mgmt/ui/request-filters';

export const dynamic = 'force-dynamic';

const BUCKET_STATUS: Record<string, string | null> = {
  complete: '9_COMPLETE',
  failed: 'X_FAILED',
  active: null,
};

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const single = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
  };

  const bucket = single('bucket');
  const status = single('status') ?? (bucket ? (BUCKET_STATUS[bucket] ?? null) : null);
  const search = single('search');
  const page = Number(single('page') ?? '1');

  const result = await u2Deps().query.listRequests({ status, search, page });

  return (
    <div className="flex flex-col gap-6" data-testid="requests-page">
      <h1 className="font-headline text-2xl font-extrabold tracking-tight text-ink">내 요청</h1>
      <Section title={`요청 ${result.total}건`}>
        <RequestFilters status={status} search={search} />
        <RequestTable items={result.items} />
        <p className="font-mono-id text-[11px] text-ink-faint">
          {result.page} 페이지 · 페이지당 {result.limit}건
        </p>
      </Section>
    </div>
  );
}
