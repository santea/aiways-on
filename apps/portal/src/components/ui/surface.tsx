import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * 표면 계층 — design §2.1 No-Line 규칙.
 * 구분선을 쓰지 않고 surface 명도 차이로만 영역을 나눈다. 따라서 border 를 두지 않는다.
 */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-[var(--radius-token)] bg-surface-1 p-5', className)}
      {...props}
    />
  );
}

interface SectionProps {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Section({ title, action, children, className }: SectionProps) {
  return (
    <section className={cn('flex flex-col gap-3', className)}>
      <header className="flex items-baseline justify-between gap-4">
        <h2 className="font-headline text-[15px] font-bold tracking-tight text-ink">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

export function Alert({
  tone = 'error',
  children,
}: {
  tone?: 'error' | 'success' | 'warning';
  children: ReactNode;
}) {
  const toneClass = {
    error: 'bg-error-wash text-error',
    success: 'bg-success-wash text-success',
    warning: 'bg-warning-wash text-warning',
  }[tone];
  return (
    <p role="status" className={cn('rounded-[var(--radius-token)] px-3 py-2 text-[12.5px]', toneClass)}>
      {children}
    </p>
  );
}
