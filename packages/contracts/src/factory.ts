/**
 * SdlcRequestFactory 시그니처 — UOW-6.
 *
 * **시그니처는 U1 이 소유하고, 구현은 U3 단독이다.**
 * U2(`/intake`) · U4(incident 승격) · U5(finding 승격) 세 유닛이 모두 이 계약을 호출하므로,
 * 시그니처를 U1 에 두어야 세 유닛이 U3 구현을 기다리지 않고 착수할 수 있다.
 *
 * AD-3: `validateAndStampPolicy` 는 시스템에 **단 하나만 존재**한다.
 * 이 함수를 우회한 SR 생성(직접 INSERT)은 금지다 — 정책이 각인되지 않은 SR 은
 * 하위 단계에서 실패해야 한다.
 */
import type { CreateSdlcRequestInput, SdlcRequestDetail } from './dto';
import type { PipelineProfile, StampedPolicy } from './stage';

/** 검증 실패 사유. 구현은 이 코드 집합만 반환한다. */
export type ValidationFailureCode =
  | 'MISSING_REQUIRED_FIELD'
  | 'INVALID_PROFILE'
  | 'INVALID_DEDUP_KEY'
  | 'INVALID_FIELD_FORMAT';

export interface ValidationFailure {
  readonly code: ValidationFailureCode;
  readonly field: string;
  readonly message: string;
}

/** 검증 + 정책 각인 결과. 실패 시 `ok: false` 이며 정책은 만들어지지 않는다. */
export type ValidateAndStampResult =
  | { readonly ok: true; readonly policy: StampedPolicy }
  | { readonly ok: false; readonly failures: readonly ValidationFailure[] };

/**
 * 입력을 검증하고 프로파일 정책을 결정해 반환한다.
 * 반환된 정책은 호출자가 아니라 `createSdlcRequest` 가 SR 에 각인한다.
 */
export type ValidateAndStampPolicy = (
  input: CreateSdlcRequestInput,
  profile: PipelineProfile,
) => ValidateAndStampResult;

/**
 * SR 을 생성한다. 내부에서 반드시 `validateAndStampPolicy` 를 거친다.
 * `dedupKey` 가 이미 존재하면 **기존 SR 을 그대로 반환**한다 (B-1 멱등).
 */
export type CreateSdlcRequest = (
  input: CreateSdlcRequestInput,
  profile: PipelineProfile,
) => Promise<SdlcRequestDetail>;

/** 세 유닛이 주입받는 Factory 계약. */
export interface SdlcRequestFactory {
  readonly validateAndStampPolicy: ValidateAndStampPolicy;
  readonly createSdlcRequest: CreateSdlcRequest;
}
