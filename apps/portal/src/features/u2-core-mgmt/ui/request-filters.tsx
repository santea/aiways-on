import { STAGE_VALUES } from '@aiways/lib/domain';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect } from '@/components/ui/field';
import { stageLabel } from '../status-badge';

/**
 * 목록 필터 — 상태·검색을 URL 로 유지한다.
 * 폼 GET 이므로 자바스크립트 없이도 동작하고, 필터 상태가 공유 가능한 링크가 된다.
 */
export function RequestFilters({
  status,
  search,
}: {
  status: string | null;
  search: string | null;
}) {
  return (
    <form className="flex flex-wrap items-end gap-2" data-testid="request-filters">
      <label className="flex flex-col gap-1">
        <span className="font-mono-id text-[10px] font-bold uppercase tracking-[0.08em] text-ink-faint">
          상태
        </span>
        <NativeSelect
          name="status"
          defaultValue={status ?? ''}
          className="w-44"
          data-testid="request-filters-status"
        >
          <option value="">전체</option>
          {STAGE_VALUES.map((stage) => (
            <option key={stage} value={stage}>
              {stageLabel(stage)}
            </option>
          ))}
        </NativeSelect>
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-mono-id text-[10px] font-bold uppercase tracking-[0.08em] text-ink-faint">
          검색
        </span>
        <Input
          name="search"
          defaultValue={search ?? ''}
          placeholder="요청 번호 또는 제출자"
          className="w-56"
          data-testid="request-filters-search"
        />
      </label>
      <Button type="submit" variant="subtle" data-testid="request-filters-submit">
        적용
      </Button>
    </form>
  );
}
