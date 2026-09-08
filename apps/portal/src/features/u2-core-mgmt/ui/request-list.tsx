import type { SdlcRequestSummary } from '@aiways/contracts';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { EmptyRow, Table, TableWrap, Td, Th } from '@/components/ui/table';
import { DASHBOARD_BUCKETS, bucketOfStage } from '../status-badge';
import { StatusBadge } from './pipeline';

const dateOnly = (iso: string) => iso.slice(0, 10);

/**
 * 진행 현황 카드 — **3장** (`08-sr-registration-ui.md` §5.2).
 * 카드를 누르면 그 상태로 필터된 목록으로 간다.
 */
export function SummaryCards({ counts }: { counts: Record<string, number> }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-px overflow-hidden rounded-[var(--radius-token)] bg-surface">
      {DASHBOARD_BUCKETS.map((bucket) => (
        <Link
          key={bucket.key}
          href={`/requests?bucket=${bucket.key}`}
          data-testid={`summary-card-${bucket.key}`}
          className="flex flex-col gap-1 bg-surface-1 px-4 py-3.5 transition-colors hover:bg-surface-2"
        >
          <Badge tone={bucket.tone}>{bucket.label}</Badge>
          <span className="font-headline text-2xl font-extrabold tabular-nums tracking-tight text-ink">
            {counts[bucket.key] ?? 0}
          </span>
        </Link>
      ))}
    </div>
  );
}

export function countByBucket(items: readonly SdlcRequestSummary[]): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, item) => {
    const bucket = bucketOfStage(item.status);
    return { ...acc, [bucket]: (acc[bucket] ?? 0) + 1 };
  }, {});
}

/** SR 목록 테이블 — `08-sr-registration-ui.md` §5.3 의 5개 컬럼 */
export function RequestTable({ items }: { items: readonly SdlcRequestSummary[] }) {
  return (
    <TableWrap>
      <Table data-testid="request-list-table">
        <thead>
          <tr>
            <Th>요청 번호</Th>
            <Th>제출자</Th>
            <Th>시스템</Th>
            <Th>상태</Th>
            <Th>요청일</Th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <EmptyRow colSpan={5}>표시할 요청이 없다</EmptyRow>
          ) : (
            items.map((item) => (
              <tr key={item.id} className="odd:bg-surface-2/40">
                <Td>
                  <Link
                    href={`/requests/${item.id}`}
                    data-testid={`request-link-${item.requestNo}`}
                    className="font-mono-id text-[11.5px] font-bold text-ink hover:text-accent"
                  >
                    {item.requestNo}
                  </Link>
                </Td>
                <Td>{item.submitter}</Td>
                <Td>{item.requestSystem}</Td>
                <Td>
                  <StatusBadge stage={item.status} />
                </Td>
                <Td className="tabular-nums">{dateOnly(item.createdAt)}</Td>
              </tr>
            ))
          )}
        </tbody>
      </Table>
    </TableWrap>
  );
}
