/**
 * `SdlcRequestFactory` 테스트 더블 — B-1 (UOW-4).
 *
 * **필수 조건**: 반환하는 SR 의 `metadata` 에 `channelTypes`·`autoMergeAllowed` 가
 * 각인돼 있어야 한다. 각인 없이 돌려주면 소비 유닛이 프로파일을 스스로 재판정하는
 * 코드를 쓰게 되고 AD-3 이 무력화된다 (`unit-of-work-dependency.md` §6 필수 조건 ②).
 *
 * U3 T1 완료 후 실제 구현으로 교체한다. 교체 지점은 `deps.ts` 한 곳이다.
 */
import type {
  CreateSdlcRequestInput,
  PipelineProfile,
  SdlcRequestDetail,
  SdlcRequestFactory,
  StampedPolicy,
  ValidateAndStampResult,
  ValidationFailure,
} from '@aiways/contracts';
import { PIPELINE_PROFILES, PROFILE_CHANNELS } from '@aiways/lib/domain';

const REQUIRED_FIELDS = [
  'submitter',
  'requestSite',
  'devType',
  'requestSystem',
  'dedupKey',
] as const satisfies readonly (keyof CreateSdlcRequestInput)[];

/** 프로파일 정책 결정 — 실제 구현(U3)도 같은 표를 쓴다. */
function stampPolicy(profile: PipelineProfile): StampedPolicy {
  return {
    channelTypes: PROFILE_CHANNELS[profile],
    // incident 는 repo 설정과 무관하게 항상 자동머지 금지 (03-state-machine.md §4.4).
    autoMergeAllowed: profile === 'feature',
  };
}

export function createSdlcRequestFactoryStub(): SdlcRequestFactory {
  const byDedupKey = new Map<string, SdlcRequestDetail>();
  let sequence = 0;

  const validateAndStampPolicy = (
    input: CreateSdlcRequestInput,
    profile: PipelineProfile,
  ): ValidateAndStampResult => {
    const failures: ValidationFailure[] = REQUIRED_FIELDS.filter(
      (field) => !String(input[field] ?? '').trim(),
    ).map((field) => ({
      code: 'MISSING_REQUIRED_FIELD',
      field,
      message: `${field} 는 필수다`,
    }));

    if (!(PIPELINE_PROFILES as readonly string[]).includes(profile)) {
      failures.push({
        code: 'INVALID_PROFILE',
        field: 'profile',
        message: `알 수 없는 프로파일: ${profile}`,
      });
    }

    return failures.length > 0
      ? { ok: false, failures }
      : { ok: true, policy: stampPolicy(profile) };
  };

  return {
    validateAndStampPolicy,
    async createSdlcRequest(input, profile) {
      const existing = byDedupKey.get(input.dedupKey);
      if (existing) return existing;

      const validated = validateAndStampPolicy(input, profile);
      if (!validated.ok) {
        throw new Error(validated.failures.map((f) => f.message).join(', '));
      }

      const now = new Date().toISOString();
      const requestNo = input.requestNo ?? `SR-STUB-${String(++sequence).padStart(3, '0')}`;
      const created: SdlcRequestDetail = {
        id: `stub-${requestNo}`,
        requestNo,
        submitter: input.submitter,
        submitterId: input.submitterId ?? null,
        submitterEmail: input.submitterEmail ?? null,
        submitterGithubLogin: input.submitterGithubLogin ?? null,
        requestSite: input.requestSite,
        requestSystem: input.requestSystem,
        devType: input.devType,
        module: input.module ?? null,
        dedupKey: input.dedupKey,
        status: '1_REGISTERED',
        createdAt: now,
        updatedAt: now,
        // ⬇ 각인. 이 두 필드를 빼면 AD-3 이 깨진다.
        metadata: { ...input.metadata, ...validated.policy },
      };
      byDedupKey.set(input.dedupKey, created);
      return created;
    },
  };
}
