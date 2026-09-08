/**
 * `RequestIntake` — C-2.1 (US-U2-04).
 *
 * `POST /intake` 는 등록과 프로비저닝을 **한 흐름으로** 끝낸다. 대기 큐도 자원 게이트도
 * 없다 (`03-state-machine.md` §1.2).
 *
 * 경계 두 가지를 여기서 지킨다:
 *  - **SR 을 직접 INSERT 하지 않는다.** 반드시 Factory 를 거친다 (B-1). Factory 만이
 *    프로파일 정책을 각인하므로, 우회하면 각인 없는 SR 이 생겨 하위 단계가 깨진다 (AD-3).
 *  - **실패를 대기 상태로 남기지 않는다.** 프로비저닝이 실패하면 보상 경로로 넘긴다.
 */
import type { PipelineProfile, SdlcRequestFactory, PodPort, Stage } from '@aiways/contracts';
import { ApiHttpError, validationFailed } from '@aiways/lib/http';
import { z } from 'zod';

/**
 * F-7 (U2 Part 2 발견) — **이 인터페이스는 `packages/contracts` 에 없다.**
 *
 * `03-state-machine.md` §6 은 실패 시 `compensateFailedSdlc(requestNo)` 를 부르라고
 * 정하고 그 구현은 U3 의 `CompensationHandler`(C-3.4) 소유다. 그런데 PR #1 동결 목록
 * (`contracts/factory.ts`·`ports.ts`·`state.ts`)에 보상 진입점이 없다. 접수 실패를
 * 대기 상태로 남기지 않으려면 U2 가 그것을 불러야 하므로, 여기에 **임시로** 선언한다.
 *
 * U3 T1 구현 시 `packages/contracts/ports.ts` 로 옮기고 여기서는 지운다 — **U1 승인 대상**.
 * 지금 contracts 를 직접 고치지 않는 이유는 AD-4(인터페이스 소유자는 U1)를 지키기 위해서다.
 */
export interface CompensationPort {
  compensate(input: {
    requestId: string;
    requestNo: string;
    reason: string;
  }): Promise<void>;
}

const intakeSchema = z.object({
  requestNo: z.string().trim().min(1).optional(),
  submitter: z.string().trim().min(1, 'submitter 는 필수다'),
  submitterId: z.string().nullable().optional(),
  submitterEmail: z.email().nullable().optional(),
  submitterGithubLogin: z.string().nullable().optional(),
  requestSite: z.string().trim().min(1, 'requestSite 는 필수다'),
  devType: z.string().trim().min(1, 'devType 은 필수다'),
  requestSystem: z.string().trim().min(1, 'requestSystem 은 필수다'),
  module: z.string().nullable().optional(),
  dedupKey: z.string().trim().min(1, 'dedupKey 는 필수다'),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type IntakeInput = z.input<typeof intakeSchema>;

export interface IntakeResult {
  readonly requestNo: string;
  readonly status: Stage;
}

export interface IntakeServiceDeps {
  readonly factory: SdlcRequestFactory;
  readonly podPort: PodPort;
  readonly compensation: CompensationPort;
}

const INTAKE_PROFILE: PipelineProfile = 'feature';

export function createIntakeService({ factory, podPort, compensation }: IntakeServiceDeps) {
  return {
    async intake(input: IntakeInput): Promise<IntakeResult> {
      const parsed = intakeSchema.safeParse(input);
      if (!parsed.success) {
        throw validationFailed(
          parsed.error.issues[0]?.message ?? '입력이 올바르지 않다',
          parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
        );
      }

      // B-1 — Factory 경유. 같은 dedupKey 면 기존 SR 이 그대로 돌아온다.
      const request = await factory.createSdlcRequest(parsed.data, INTAKE_PROFILE);

      try {
        await podPort.provision({
          requestId: request.id,
          requestNo: request.requestNo,
        });
      } catch (cause) {
        // 대기 상태로 남기지 않는다 — 보상 경로로 넘긴다 (`03-state-machine.md` §1.2·§6).
        // 보상이 또 실패해도 원래 실패를 삼키지 않는다.
        await compensation
          .compensate({
            requestId: request.id,
            requestNo: request.requestNo,
            reason: `프로비저닝 실패: ${describeCause(cause)}`,
          })
          .catch(() => undefined);

        // 원인 문자열은 응답에 싣지 않는다 (NFR-16).
        throw new ApiHttpError(500, 'INTERNAL_ERROR', '접수는 되었으나 프로비저닝에 실패했다');
      }

      return { requestNo: request.requestNo, status: request.status };
    },
  };
}

export type IntakeService = ReturnType<typeof createIntakeService>;

/** 보상 사유에 남길 짧은 설명. 응답이 아니라 내부 기록용이다. */
function describeCause(cause: unknown): string {
  return cause instanceof Error ? cause.name : 'UnknownError';
}
