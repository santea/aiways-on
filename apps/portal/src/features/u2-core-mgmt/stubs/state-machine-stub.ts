/**
 * `StateMachineReader` 테스트 더블 — B-3 (UOW-4).
 *
 * **Reader 만 구현한다.** `advance`·`setSubStage` 를 여기에 만들면 "U2 는 상태를
 * 전이시키지 않는다"는 B-3 경계가 stub 단계에서 이미 깨진다. U2 코드가 그 함수를
 * 부를 수 있게 되는 순간, U3 구현으로 교체할 때 컴파일이 아니라 런타임에 문제가 드러난다.
 */
import type { StateMachineReader } from '@aiways/contracts';

export function createStateMachineReaderStub(): StateMachineReader {
  return {
    async getStage() {
      return '4_DEV_IN_PROGRESS';
    },
    async getSubStage() {
      return {
        current: 'code_review',
        history: [
          { stage: 'dev', completedAt: '2026-09-08T01:00:00.000Z' },
          { stage: 'qa', completedAt: '2026-09-08T03:00:00.000Z' },
        ],
      };
    },
    async getTransitions(requestId) {
      return [
        {
          id: 'tr-1',
          requestId,
          fromStatus: '1_REGISTERED',
          toStatus: '2_REQUIREMENTS_IN_PROGRESS',
          idempotencyKey: `${requestId}:1-2`,
          actor: 'n8n-agent',
          createdAt: '2026-09-08T00:10:00.000Z',
        },
        {
          id: 'tr-2',
          requestId,
          fromStatus: '2_REQUIREMENTS_IN_PROGRESS',
          toStatus: '3_DEV_DESIGN_IN_PROGRESS',
          idempotencyKey: `${requestId}:2-3`,
          actor: 'n8n-agent-fb',
          createdAt: '2026-09-08T00:40:00.000Z',
        },
        {
          id: 'tr-3',
          requestId,
          fromStatus: '3_DEV_DESIGN_IN_PROGRESS',
          toStatus: '4_DEV_IN_PROGRESS',
          idempotencyKey: `${requestId}:3-4`,
          actor: 'n8n-agent-fb',
          createdAt: '2026-09-08T01:05:00.000Z',
        },
      ];
    },
  };
}
