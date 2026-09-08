/**
 * 요청 번호와 dedup 키 — 순수 함수 (US-U2-01 · US-U2-04).
 * 근거: `08-sr-registration-ui.md` §4.2 — `SR-YYYYMMDD-NNN`
 *
 * 시각 생성은 여기서 하지 않는다. `new Date()` 는 서버 액션·라우트에서만 부르고
 * 이 모듈에는 이미 정해진 `ymd` 를 넘긴다 — 그래야 순수 함수로 남고 PBT 가 가능하다.
 */
import { createHash } from 'node:crypto';

const REQUEST_NO_PATTERN = /^SR-(\d{8})-(\d{3,})$/;
const MIN_SEQ_DIGITS = 3;

/** `SR-20260901-001`. 일련번호가 999 를 넘으면 자릿수가 늘어난다 — 잘라내면 충돌한다. */
export function formatRequestNo(ymd: string, seq: number): string {
  return `SR-${ymd}-${String(seq).padStart(MIN_SEQ_DIGITS, '0')}`;
}

export interface ParsedRequestNo {
  readonly ymd: string;
  readonly seq: number;
}

/** 형식에 맞지 않으면 `null`. 예외를 던지지 않는다 — 호출부가 분기하기 쉽게 한다. */
export function parseRequestNo(value: string): ParsedRequestNo | null {
  const matched = REQUEST_NO_PATTERN.exec(value);
  const ymd = matched?.[1];
  const seq = matched?.[2];
  if (!ymd || !seq) return null;
  return { ymd, seq: Number(seq) };
}

export function isRequestNo(value: string): boolean {
  return REQUEST_NO_PATTERN.test(value);
}

/** 서버 시각으로 오늘의 `YYYYMMDD` 를 만든다. 클라이언트에서 부르지 않는다. */
export function todayYmd(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10).replace(/-/g, '');
}

export interface DedupKeyInput {
  readonly requestNo: string;
  readonly submitterId: string;
  readonly devType: string;
}

/**
 * 접수 멱등 키 — 같은 입력이면 언제나 같은 값이다 (B-1).
 * 키를 만드는 책임은 **호출자**에게 있다 (`CreateSdlcRequestInput.dedupKey` 주석 참조).
 */
export function buildDedupKey(input: DedupKeyInput): string {
  return createHash('sha256')
    .update([input.requestNo, input.submitterId, input.devType].join(' '))
    .digest('hex')
    .slice(0, 32);
}
