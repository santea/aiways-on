import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** 조건부 클래스 병합 — 뒤에 온 유틸리티가 앞을 확실히 덮게 한다. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
