import * as LabelPrimitive from '@radix-ui/react-label';
import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const controlBase =
  'w-full rounded-[var(--radius-token)] bg-surface-2 px-3 py-2 text-[13px] text-ink placeholder:text-ink-faint transition-colors hover:bg-surface-3 disabled:opacity-45';

export function Label({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      className={cn(
        'font-mono-id text-[10px] font-bold uppercase tracking-[0.08em] text-ink-faint',
        className,
      )}
      {...props}
    />
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(controlBase, 'h-9 py-0', className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(controlBase, 'min-h-28 resize-y leading-relaxed', className)} {...props} />;
}

export function NativeSelect({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(controlBase, 'h-9 py-0', className)} {...props} />;
}

interface FieldProps {
  label: string;
  htmlFor: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
}

/** 라벨·컨트롤·오류를 한 덩어리로 묶는다. 오류는 `aria-describedby` 로 연결된다. */
export function Field({ label, htmlFor, required, hint, error, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>
        {label}
        {required ? <span className="ml-1 text-error">*</span> : null}
      </Label>
      {children}
      {hint && !error ? <p className="text-[11.5px] text-ink-faint">{hint}</p> : null}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-[11.5px] text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
