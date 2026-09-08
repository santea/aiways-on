/**
 * 감사 로그 적재 — `05-portal-api.md` §2.3 (US-U2-08).
 *
 * 두 가지를 지킨다:
 *  - **마스킹** — 토큰·비밀번호가 들어간 채로 저장되지 않는다 (NFR-14, SECURITY-03).
 *    감사 로그는 오래 남고 넓게 읽히므로, 여기 새면 회수할 방법이 없다.
 *  - **append-only** — 이 모듈에도 저장소 인터페이스에도 UPDATE·DELETE 가 없다 (NFR-18).
 */
import { validationFailed } from '@aiways/lib/http';
import { z } from 'zod';

/** 명세가 정의한 액션 타입 (§2.3). 목록 밖의 값은 받지 않는다. */
export const AUDIT_ACTIONS = [
  'clone',
  'pod.clone',
  'pod.run',
  'pod.git-push',
  'pod.session-close',
] as const;

const auditSchema = z.object({
  action: z.enum(AUDIT_ACTIONS),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type AuditInput = z.input<typeof auditSchema>;

/** 키 이름만으로 비밀이라고 판단할 수 있는 것들. */
const SECRET_KEY_PATTERN = /(token|password|secret|passwd|pat|api[-_]?key|authorization|bearer|credential)/i;

/** 키가 평범해도 값 모양이 토큰이면 가린다 — 실수로 본문에 붙여 넣는 경우가 실제로 흔하다. */
const SECRET_VALUE_PATTERNS = [
  /\bgh[pousr]_[A-Za-z0-9]{16,}\b/,
  /\bsdlcmem_[A-Za-z0-9]{8,}\b/,
  /\bxox[baprs]-[A-Za-z0-9-]{8,}\b/,
  /\bBearer\s+[A-Za-z0-9._-]{12,}\b/i,
];

const MASK = '***';

function looksSecret(value: string): boolean {
  return SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(value));
}

/**
 * 비밀로 보이는 값을 `***` 로 바꾼 **새 구조**를 돌려준다. 원본은 바꾸지 않는다.
 * 중첩 객체와 배열 안쪽까지 훑는다 — 얕게 보면 `repos[0].token` 같은 값이 그대로 남는다.
 */
export function maskSecrets(value: unknown, keyHint = ''): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => maskSecrets(item, keyHint));
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        maskSecrets(item, key),
      ]),
    );
  }
  if (typeof value === 'string') {
    if (SECRET_KEY_PATTERN.test(keyHint) || looksSecret(value)) return MASK;
    return value;
  }
  if (SECRET_KEY_PATTERN.test(keyHint) && value !== null && value !== undefined) return MASK;
  return value;
}

export interface AuditEventInput {
  readonly resourceType: string;
  readonly resourceId: string;
  readonly action: string;
  readonly metadata: Record<string, unknown>;
}

/**
 * **append 만 있다.** update·delete 를 여기 추가하면 NFR-18 이 깨진다.
 * 삭제가 필요하다는 요구가 오면 코드가 아니라 요구사항을 먼저 고쳐야 한다.
 */
export interface AuditRepository {
  append(event: AuditEventInput): Promise<void>;
}

export function createAuditService({ repository }: { repository: AuditRepository }) {
  return {
    async record(requestId: string, input: AuditInput): Promise<void> {
      const parsed = auditSchema.safeParse(input);
      if (!parsed.success) {
        throw validationFailed(parsed.error.issues[0]?.message ?? 'action 이 올바르지 않다');
      }
      await repository.append({
        resourceType: 'sdlc_request',
        resourceId: requestId,
        action: parsed.data.action,
        metadata: maskSecrets(parsed.data.metadata ?? {}) as Record<string, unknown>,
      });
    },
  };
}

export type AuditService = ReturnType<typeof createAuditService>;
