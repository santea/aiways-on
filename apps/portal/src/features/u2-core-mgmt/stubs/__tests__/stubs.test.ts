import { describe, expect, it } from 'vitest';
import { createSdlcRequestFactoryStub } from '../factory-stub';
import { createPodPortStub } from '../pod-port-stub';
import { createStateMachineReaderStub } from '../state-machine-stub';

describe('SdlcRequestFactoryStub — B-1', () => {
  const input = {
    submitter: '홍길동',
    requestSite: 'aiways-on.example.com',
    devType: 'feature',
    requestSystem: 'AIways On',
    dedupKey: 'dedup-1',
  };

  it('정책이 각인된 metadata 를 돌려준다 — 이게 없으면 AD-3 이 무력화된다', async () => {
    const sr = await createSdlcRequestFactoryStub().createSdlcRequest(input, 'feature');
    expect(sr.metadata.channelTypes).toEqual(['requirements', 'design', 'dev']);
    expect(sr.metadata.autoMergeAllowed).toBe(true);
  });

  it('incident 는 dev 채널 1개 · 자동머지 금지가 각인된다', async () => {
    const sr = await createSdlcRequestFactoryStub().createSdlcRequest(input, 'incident');
    expect(sr.metadata.channelTypes).toEqual(['dev']);
    expect(sr.metadata.autoMergeAllowed).toBe(false);
  });

  it('improvement 도 dev 채널 1개다', async () => {
    const sr = await createSdlcRequestFactoryStub().createSdlcRequest(input, 'improvement');
    expect(sr.metadata.channelTypes).toEqual(['dev']);
  });

  it('생성된 SR 은 1_REGISTERED 로 시작한다', async () => {
    const sr = await createSdlcRequestFactoryStub().createSdlcRequest(input, 'feature');
    expect(sr.status).toBe('1_REGISTERED');
  });

  it('같은 dedupKey 로 다시 부르면 기존 SR 을 그대로 돌려준다 (멱등)', async () => {
    const factory = createSdlcRequestFactoryStub();
    const first = await factory.createSdlcRequest(input, 'feature');
    const second = await factory.createSdlcRequest({ ...input, submitter: '다른사람' }, 'feature');
    expect(second.id).toBe(first.id);
    expect(second.requestNo).toBe(first.requestNo);
  });

  it('필수 필드가 없으면 검증이 실패하고 정책도 만들어지지 않는다', () => {
    const r = createSdlcRequestFactoryStub().validateAndStampPolicy(
      { ...input, submitter: '' },
      'feature',
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.failures[0]?.code).toBe('MISSING_REQUIRED_FIELD');
  });

  it('알 수 없는 프로파일은 INVALID_PROFILE 이다', () => {
    const r = createSdlcRequestFactoryStub().validateAndStampPolicy(
      input,
      'nope' as 'feature',
    );
    expect(r.ok).toBe(false);
  });
});

describe('PodPortStub — B-1', () => {
  it('provision 은 고정 Pod 이름을 돌려준다', async () => {
    const ref = await createPodPortStub().provision({
      requestId: 'r1',
      requestNo: 'SR-20260908-001',
    });
    expect(ref.podName).toBe('sdlc-SR-20260908-001');
    expect(ref.status).toBe('RUNNING');
  });

  it('provision 은 멱등이다 — 두 번 불러도 같은 Pod 이다', async () => {
    const pod = createPodPortStub();
    const a = await pod.provision({ requestId: 'r1', requestNo: 'SR-1' });
    const b = await pod.provision({ requestId: 'r1', requestNo: 'SR-1' });
    expect(b).toEqual(a);
  });

  it('terminate 후에는 세션이 없다', async () => {
    const pod = createPodPortStub();
    await pod.provision({ requestId: 'r1', requestNo: 'SR-1' });
    await pod.terminate({ requestId: 'r1' });
    expect(await pod.getSession({ requestId: 'r1' })).toBeNull();
  });
});

describe('StateMachineStub — B-3', () => {
  it('읽기 함수만 노출한다 — advance·setSubStage 가 있으면 B-3 이 stub 단계에서 이미 깨진다', () => {
    const reader = createStateMachineReaderStub();
    expect(Object.keys(reader).sort()).toEqual(['getStage', 'getSubStage', 'getTransitions']);
  });

  it('고정 stage 와 substage 를 돌려준다', async () => {
    const reader = createStateMachineReaderStub();
    expect(await reader.getStage('r1')).toBe('4_DEV_IN_PROGRESS');
    expect((await reader.getSubStage('r1'))?.current).toBe('code_review');
  });

  it('전이 이력은 시간순이다', async () => {
    const t = await createStateMachineReaderStub().getTransitions('r1');
    expect(t.length).toBeGreaterThan(0);
    const times = t.map((x) => Date.parse(x.createdAt));
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });
});
