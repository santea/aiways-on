import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * 상태 배지 — design §5. 색은 accent 4단계 + 중성만 쓰고 새 색을 늘리지 않는다.
 * raw hex 를 직접 쓰지 않는다 (design §2.1).
 */
export type BadgeTone = 'accent' | 'success' | 'warning' | 'error' | 'neutral';

const TONE_CLASS: Record<BadgeTone, string> = {
  accent: 'bg-accent-wash text-accent',
  success: 'bg-success-wash text-success',
  warning: 'bg-warning-wash text-warning',
  error: 'bg-error-wash text-error',
  neutral: 'bg-surface-3 text-ink-variant',
};

export function Badge({
  tone = 'neutral',
  children,
  className,
  ...rest
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
} & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 font-mono-id text-[10px] font-bold uppercase tracking-[0.05em]',
        TONE_CLASS[tone],
        className,
      )}
      {...rest}
    >
      <span aria-hidden="true" className="size-[5px] rounded-full bg-current" />
      {children}
    </span>
  );
}
