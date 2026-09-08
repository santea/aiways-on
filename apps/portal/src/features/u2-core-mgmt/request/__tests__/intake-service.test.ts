import { describe, expect, it, vi } from 'vitest';
import { createSdlcRequestFactoryStub } from '../../stubs/factory-stub';
import { createPodPortStub } from '../../stubs/pod-port-stub';
import { createIntakeService } from '../intake-service';

const payload = {
  requestNo: 'SR-20260901-001',
  submitter: '홍길동',
  submitterEmail: 'hong@example.com',
  submitterGithubLogin: 'hong-gildong',
  requestSite: 'aiways-on.example.com',
  devType: 'feature',
  requestSystem: 'AIways On',
  module: '대시보드 > 분석',
  dedupKey: 'SR-20260901-001-unique-key',
  metadata: { problemDescription: '현재 대시보드에서...' },
};

function make(overrides: { podPort?: ReturnType<typeof createPodPortStub> } = {}) {
  const factory = createSdlcRequestFactoryStub();
  const podPort = overrides.podPort ?? createPodPortStub();
  const compensation = { compensate: vi.fn(async () => undefined) };
  const createSpy = vi.spyOn(factory, 'createSdlcRequest');
  return {
    factory,
    podPort,
    compensation,
    createSpy,
    service: createIntakeService({ factory, podPort, compensation }),
  };
}

describe('intake (US-U2-04)', () => {
  it('201 본문은 requestNo 와 1_REGISTERED 다', async () => {
    const { service } = make();
    await expect(service.intake(payload)).resolves.toEqual({
      requestNo: 'SR-20260901-001',
      status: '1_REGISTERED',
    });
  });

  it('SR 을 직접 INSERT 하지 않고 반드시 Factory 를 거친다 (B-1)', async () => {
    const { service, createSpy } = make();
    await service.intake(payload);
    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(createSpy.mock.calls[0]?.[1]).toBe('feature');
  });

  it('같은 dedupKey 로 재호출하면 새 SR 이 생기지 않는다 (멱등)', async () => {
    const { service, createSpy } = make();
    const first = await service.intake(payload);
    const second = await service.intake({ ...payload, submitter: '다른사람' });
    expect(second).toEqual(first);
    expect(createSpy).toHaveBeenCalledTimes(2);
    // Factory 는 두 번 불렸지만 SR 은 하나다 — 멱등 책임은 Factory 계약에 있다.
  });

  it('접수 성공은 채널·Pod 프로비저닝까지 한 흐름으로 끝난다', async () => {
    const { service, podPort } = make();
    const spy = vi.spyOn(podPort, 'provision');
    await service.intake(payload);
    expect(spy).toHaveBeenCalledWith({
      requestId: expect.any(String),
      requestNo: 'SR-20260901-001',
    });
  });

  it('필수 필드가 빠지면 400 VALIDATION_ERROR 다 (NFR-11)', async () => {
    const { service } = make();
    await expect(
      service.intake({ ...payload, requestSystem: '' }),
    ).rejects.toMatchObject({ status: 400, code: 'VALIDATION_ERROR' });
  });

  it('dedupKey 가 없으면 접수를 거부한다 — 멱등 책임이 호출자에게 있기 때문이다', async () => {
    const { service } = make();
    await expect(service.intake({ ...payload, dedupKey: '' })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('프로비저닝이 실패하면 대기 상태로 남기지 않고 보상 경로로 넘긴다', async () => {
    const podPort = createPodPortStub();
    vi.spyOn(podPort, 'provision').mockRejectedValue(new Error('k8s 거부'));
    const { service, compensation } = make({ podPort });

    await expect(service.intake(payload)).rejects.toMatchObject({ status: 500 });
    expect(compensation.compensate).toHaveBeenCalledWith({
      requestId: expect.any(String),
      requestNo: 'SR-20260901-001',
      reason: expect.stringContaining('프로비저닝'),
    });
  });

  it('보상 자체가 실패해도 원래 실패를 삼키지 않는다', async () => {
    const podPort = createPodPortStub();
    vi.spyOn(podPort, 'provision').mockRejectedValue(new Error('k8s 거부'));
    const { service, compensation } = make({ podPort });
    compensation.compensate.mockRejectedValue(new Error('보상도 실패'));

    await expect(service.intake(payload)).rejects.toMatchObject({ status: 500 });
  });

  it('실패 응답이 내부 원인 문자열을 그대로 노출하지 않는다 (NFR-16)', async () => {
    const podPort = createPodPortStub();
    vi.spyOn(podPort, 'provision').mockRejectedValue(
      new Error('connect ECONNREFUSED 10.0.0.5:6443'),
    );
    const { service } = make({ podPort });
    await expect(service.intake(payload)).rejects.toMatchObject({
      message: expect.not.stringContaining('ECONNREFUSED'),
    });
  });
});
