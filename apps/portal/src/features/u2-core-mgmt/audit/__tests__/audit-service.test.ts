import { describe, expect, it, vi } from 'vitest';
import { createAuditService, maskSecrets } from '../audit-service';

describe('maskSecrets (NFR-14 · SECURITY-03)', () => {
  it('키 이름이 비밀을 가리키면 값을 가린다', () => {
    expect(
      maskSecrets({ token: 'ghp_abc123', password: 'hunter2', normal: '보통 값' }),
    ).toEqual({ token: '***', password: '***', normal: '보통 값' });
  });

  it('대소문자·구분자 표기를 가리지 않는다', () => {
    expect(
      maskSecrets({ AUTH_SECRET: 'x', 'pat-value': 'y', apiKey: 'z', Authorization: 'w' }),
    ).toEqual({ AUTH_SECRET: '***', 'pat-value': '***', apiKey: '***', Authorization: '***' });
  });

  it('키가 평범해도 값이 토큰 모양이면 가린다', () => {
    expect(maskSecrets({ note: 'ghp_0123456789abcdefghij' })).toEqual({ note: '***' });
    expect(maskSecrets({ note: 'sdlcmem_abcdef0123456789' })).toEqual({ note: '***' });
    expect(maskSecrets({ note: 'Bearer abcdef.ghijkl.mnopqr' })).toEqual({ note: '***' });
  });

  it('중첩 구조와 배열 안쪽까지 훑는다 — 얕게 보면 새어 나간다', () => {
    expect(
      maskSecrets({
        repos: [{ url: 'https://github.com/org/x', token: 'ghp_zzz' }],
        deep: { deeper: { secret: 's' } },
      }),
    ).toEqual({
      repos: [{ url: 'https://github.com/org/x', token: '***' }],
      deep: { deeper: { secret: '***' } },
    });
  });

  it('비밀이 아닌 값은 건드리지 않는다', () => {
    const input = { action: 'clone', count: 3, ok: true, at: null };
    expect(maskSecrets(input)).toEqual(input);
  });

  it('원본을 바꾸지 않는다 (불변)', () => {
    const input = { token: 'ghp_abc' };
    maskSecrets(input);
    expect(input.token).toBe('ghp_abc');
  });
});

describe('audit 적재 (US-U2-08)', () => {
  const make = () => {
    const repository = { append: vi.fn(async () => undefined) };
    return { repository, service: createAuditService({ repository }) };
  };

  it('action 과 마스킹된 metadata 를 함께 남긴다', async () => {
    const { service, repository } = make();
    await service.record('req-1', {
      action: 'pod.run',
      metadata: { sessionId: 's1', token: 'ghp_secret' },
    });
    expect(repository.append).toHaveBeenCalledWith({
      resourceType: 'sdlc_request',
      resourceId: 'req-1',
      action: 'pod.run',
      metadata: { sessionId: 's1', token: '***' },
    });
  });

  it('알 수 없는 action 은 거부한다', async () => {
    const { service } = make();
    await expect(service.record('req-1', { action: 'rm -rf' as never })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('명세의 action 5종을 전부 받는다', async () => {
    const { service } = make();
    for (const action of ['clone', 'pod.clone', 'pod.run', 'pod.git-push', 'pod.session-close']) {
      await expect(service.record('req-1', { action: action as never })).resolves.toBeUndefined();
    }
  });

  it('저장소에는 append 만 있다 — 수정·삭제 경로를 만들지 않는다 (NFR-18)', () => {
    const { repository } = make();
    expect(Object.keys(repository)).toEqual(['append']);
  });
});
