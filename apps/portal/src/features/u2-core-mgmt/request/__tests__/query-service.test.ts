import { AuthError, createSessionGuards } from '@aiways/lib/auth';
import { describe, expect, it, vi } from 'vitest';
import { createStateMachineReaderStub } from '../../stubs/state-machine-stub';
import { createQueryService } from '../query-service';
import type { SdlcRequestRepository } from '../repository';

const OWNER = { id: 'u-1', role: 'user' as const, login: 'owner', email: null };
const OTHER = { id: 'u-2', role: 'user' as const, login: 'other', email: null };
const ADMIN = { id: 'u-9', role: 'admin' as const, login: 'admin', email: null };

const summary = {
  id: 'req-1',
  requestNo: 'SR-20260901-001',
  submitter: '홍길동',
  submitterId: 'u-1',
  requestSystem: 'AIways On',
  devType: 'feature',
  status: '4_DEV_IN_PROGRESS' as const,
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T12:00:00.000Z',
};

function fakeRepository(): SdlcRequestRepository {
  return {
    list: vi.fn(async () => ({ items: [summary], total: 1 })),
    findDetail: vi.fn(async (id: string) =>
      id === 'req-1'
        ? {
            ...summary,
            requestSite: 'aiways-on.example.com',
            module: null,
            submitterEmail: null,
            submitterGithubLogin: 'hong',
            dedupKey: 'k',
            metadata: { channelTypes: ['dev'], autoMergeAllowed: false },
            profile: 'incident' as const,
          }
        : null,
    ),
    findChannels: vi.fn(async () => [
      { type: 'dev' as const, channelId: 'C003', channelName: 'inc-1-dev', archived: false },
    ]),
    findPod: vi.fn(async () => ({ podName: 'sdlc-SR-1', status: 'RUNNING', endpoint: null })),
    findGithubLinks: vi.fn(async () => ({
      issues: [{ repo: 'org/portal', number: 123, htmlUrl: null, state: 'open' }],
      pullRequests: [],
    })),
    nextSequence: vi.fn(async () => 4),
    saveIssue: vi.fn(async () => undefined),
  };
}

function make(user: typeof OWNER | typeof ADMIN | null) {
  const repository = fakeRepository();
  const guards = createSessionGuards(async () => user);
  const service = createQueryService({
    repository,
    stateReader: createStateMachineReaderStub(),
    guards,
  });
  return { repository, service };
}

describe('listRequests — 소유권 (NFR-12)', () => {
  it('user 는 본인 SR 만 조회한다 — 필터를 서버가 강제한다', async () => {
    const { service, repository } = make(OWNER);
    await service.listRequests({});
    expect(repository.list).toHaveBeenCalledWith(
      expect.objectContaining({ submitterId: 'u-1' }),
    );
  });

  it('admin 은 전체를 조회한다', async () => {
    const { service, repository } = make(ADMIN);
    await service.listRequests({});
    expect(repository.list).toHaveBeenCalledWith(
      expect.objectContaining({ submitterId: null }),
    );
  });

  it('user 가 남의 id 를 필터로 넣어도 본인으로 덮인다', async () => {
    const { service, repository } = make(OWNER);
    await service.listRequests({ submitterId: 'u-2' } as never);
    expect(repository.list).toHaveBeenCalledWith(
      expect.objectContaining({ submitterId: 'u-1' }),
    );
  });

  it('비로그인은 401 이다', async () => {
    const { service } = make(null);
    await expect(service.listRequests({})).rejects.toBeInstanceOf(AuthError);
  });

  it('페이지·크기는 범위를 벗어나면 기본값으로 되돌린다', async () => {
    const { service, repository } = make(OWNER);
    await service.listRequests({ page: 0, limit: 5000 });
    expect(repository.list).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 20 }),
    );
  });

  it('응답은 items·total·page·limit 형태다', async () => {
    const { service } = make(OWNER);
    await expect(service.listRequests({})).resolves.toEqual({
      items: [summary],
      total: 1,
      page: 1,
      limit: 20,
    });
  });
});

describe('getRequest — 상세 (US-U2-03)', () => {
  it('소유자는 상세를 본다', async () => {
    const { service } = make(OWNER);
    const detail = await service.getRequest('req-1');
    expect(detail.requestNo).toBe('SR-20260901-001');
  });

  it('타인의 SR 은 403 이다 (IDOR 방지)', async () => {
    const repository = fakeRepository();
    const service = createQueryService({
      repository,
      stateReader: createStateMachineReaderStub(),
      guards: createSessionGuards(async () => OTHER),
    });
    await expect(service.getRequest('req-1')).rejects.toMatchObject({ status: 403 });
  });

  it('없는 SR 은 404 다', async () => {
    const { service } = make(ADMIN);
    await expect(service.getRequest('req-없음')).rejects.toMatchObject({ status: 404 });
  });

  it('상태·substage·이력은 StateMachineReader 에서 온다 (B-3)', async () => {
    const { service } = make(ADMIN);
    const detail = await service.getRequest('req-1');
    expect(detail.status).toBe('4_DEV_IN_PROGRESS');
    expect(detail.devSubStage?.current).toBe('code_review');
    expect(detail.stageHistory).toHaveLength(3);
  });

  it('채널·Pod·GitHub 링크가 함께 실린다', async () => {
    const { service } = make(ADMIN);
    const detail = await service.getRequest('req-1');
    expect(detail.channels[0]?.channelId).toBe('C003');
    expect(detail.pod?.podName).toBe('sdlc-SR-1');
    expect(detail.github.issues).toHaveLength(1);
  });

  it('각인된 프로파일을 그대로 실어 화면이 Flow 를 고를 수 있게 한다 (AD-3 읽기만)', async () => {
    const { service } = make(ADMIN);
    expect((await service.getRequest('req-1')).profile).toBe('incident');
  });
});

describe('등록 폼 보조 (US-U2-01)', () => {
  it('요청 번호는 서버 시각 + DB 일련번호로 만든다', async () => {
    const { service } = make(OWNER);
    const { requestNo } = await service.nextRequestNo(new Date('2026-09-03T05:00:00Z'));
    expect(requestNo).toBe('SR-20260903-004');
  });

  it('개발 유형 목록은 명세의 4종이다', async () => {
    const { service } = make(OWNER);
    await expect(service.devTypes()).resolves.toEqual({
      devTypes: ['feature', 'bugfix', 'refactor', 'hotfix'],
    });
  });

  it('보조 API 도 로그인을 요구한다', async () => {
    const { service } = make(null);
    await expect(service.devTypes()).rejects.toBeInstanceOf(AuthError);
  });
});
