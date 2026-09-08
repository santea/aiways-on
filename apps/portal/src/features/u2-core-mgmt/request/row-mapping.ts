/**
 * DB 행 → DTO 변환의 **판단이 들어간 부분**.
 *
 * `repository.ts` 에는 Drizzle 쿼리만 남기고 이 규칙들을 여기로 뺐다. 그래야
 * 규칙을 DB 없이 검증할 수 있고, 쿼리 파일은 통합 테스트에만 맡길 수 있다.
 */
import type { PipelineProfile, Stage } from '@aiways/contracts';

const EPOCH = new Date(0).toISOString();

/** timestamp 컬럼은 드라이버에 따라 `Date` 로도 문자열로도 온다. 양쪽을 ISO 로 맞춘다. */
export function toIso(value: Date | string | null | undefined): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value.length > 0) return value;
  return EPOCH;
}

const PROFILES: readonly string[] = ['feature', 'incident', 'improvement'];

/**
 * SR 에 **각인된** 프로파일을 읽는다 (AD-3). 재판정하지 않는다.
 * 각인 값이 없거나 알 수 없는 값이면 `feature` 로 본다 — 화면이 Flow 를 고르기 위한
 * 표시용 기본값일 뿐이며, 정책 판단에는 쓰이지 않는다.
 */
export function readStampedProfile(metadata: Record<string, unknown>): PipelineProfile {
  const value = metadata['profile'];
  return typeof value === 'string' && PROFILES.includes(value)
    ? (value as PipelineProfile)
    : 'feature';
}

/** `status` 컬럼은 VARCHAR 다. 알 수 없는 값이 와도 화면이 죽지 않게 좁힌다. */
export function readStage(value: string | null | undefined, fallback: Stage = '1_REGISTERED'): Stage {
  return value ? (value as Stage) : fallback;
}

/** 목록 페이지의 OFFSET. 1-based 페이지를 0-based 오프셋으로 바꾼다. */
export function offsetOf(page: number, limit: number): number {
  return Math.max(0, (page - 1) * limit);
}

/** 그날의 다음 일련번호 — 기존 개수 + 1. */
export function nextSequenceFrom(existingCount: number): number {
  return Math.max(0, existingCount) + 1;
}
