/**
 * `PodPort` 테스트 더블 — B-1 (UOW-4). U3 T2 완료 후 교체한다.
 * `provision` 은 멱등이어야 한다 — 실제 구현의 계약이 그렇기 때문이다.
 */
import type { PodPort, PodSessionRef } from '@aiways/contracts';

export function createPodPortStub(): PodPort {
  const sessions = new Map<string, PodSessionRef>();

  return {
    async provision({ requestId, requestNo }) {
      const existing = sessions.get(requestId);
      if (existing) return existing;
      const ref: PodSessionRef = {
        podName: `sdlc-${requestNo}`,
        endpoint: `http://sdlc-${requestNo}.bia-systems.svc.cluster.local:8080`,
        status: 'RUNNING',
      };
      sessions.set(requestId, ref);
      return ref;
    },
    async terminate({ requestId }) {
      sessions.delete(requestId);
    },
    async getSession({ requestId }) {
      return sessions.get(requestId) ?? null;
    },
  };
}
