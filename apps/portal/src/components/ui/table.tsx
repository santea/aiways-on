import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/** 넓은 표는 자기 컨테이너 안에서만 가로 스크롤한다 — 페이지 본문은 흔들리지 않는다. */
export function TableWrap({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('overflow-x-auto rounded-[var(--radius-token)] bg-surface-1', className)}
      {...props}
    />
  );
}

export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <table
      className={cn('w-full min-w-[34rem] border-collapse text-[12.5px]', className)}
      {...props}
    />
  );
}

export function Th({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cn(
        'bg-surface-3 px-3.5 py-2.5 text-left font-mono-id text-[10px] font-bold uppercase tracking-[0.08em] text-ink-faint',
        className,
      )}
      {...props}
    />
  );
}

export function Td({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('px-3.5 py-2.5 align-top text-ink-variant', className)} {...props} />;
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3.5 py-10 text-center text-[12.5px] text-ink-faint">
        {children}
      </td>
    </tr>
  );
}
