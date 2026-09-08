import { describe, expect, it, vi } from 'vitest';
import { createImageService } from '../image-service';

const ENV = { SDLC_IMAGE_SIGNING_SECRET: 'unit-test-image-signing-secret' };

function make() {
  const stored: { objectKey: string; body: Uint8Array }[] = [];
  const storage = {
    put: vi.fn(async (objectKey: string, body: Uint8Array) => {
      stored.push({ objectKey, body });
    }),
    get: vi.fn(async (objectKey: string) => {
      const found = stored.find((s) => s.objectKey === objectKey);
      return found ? { body: found.body, mimeType: 'image/png' } : null;
    }),
  };
  // 실제로 저장된 objectKey 를 기억한다 — 고정 문자열을 쓰면 서비스가 만든 키와
  // 어긋나 테스트가 통과 여부와 무관하게 404 가 된다.
  const saved = new Map<string, { objectKey: string; mimeType: string }>();
  const repository = {
    saveImage: vi.fn(async (row: { objectKey: string; mimeType: string }) => {
      saved.set('img-1', { objectKey: row.objectKey, mimeType: row.mimeType });
      return 'img-1';
    }),
    findImage: vi.fn(async (id: string) => saved.get(id) ?? null),
  };
  return {
    storage,
    repository,
    stored,
    service: createImageService({ env: ENV, storage, repository, baseUrl: 'https://portal' }),
  };
}

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

describe('upload (US-U2-07)', () => {
  it('S3 에 저장하고 서명된 서빙 URL 을 돌려준다', async () => {
    const { service, storage } = make();
    const result = await service.upload('req-1', {
      file: png,
      fileName: 'before.png',
      mimeType: 'image/png',
      kind: 'before',
      screenName: '대시보드',
    });
    expect(storage.put).toHaveBeenCalled();
    expect(result.imageId).toBe('img-1');
    expect(result.servingUrl).toContain('/api/v1/sdlc/images/img-1?token=');
  });

  it('kind 가 명세의 4종이 아니면 400 이다', async () => {
    const { service } = make();
    await expect(
      service.upload('req-1', {
        file: png,
        fileName: 'x.png',
        mimeType: 'image/png',
        kind: 'sideways' as never,
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('파일이 비면 400 이다', async () => {
    const { service } = make();
    await expect(
      service.upload('req-1', {
        file: new Uint8Array(),
        fileName: 'x.png',
        mimeType: 'image/png',
        kind: 'before',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('이미지가 아닌 mime 은 거부한다 — 임의 파일 저장소가 되지 않게 한다', async () => {
    const { service } = make();
    await expect(
      service.upload('req-1', {
        file: png,
        fileName: 'x.sh',
        mimeType: 'application/x-sh',
        kind: 'before',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('objectKey 에 요청 id 가 들어가 SR 별로 나뉜다', async () => {
    const { service, storage } = make();
    await service.upload('req-1', {
      file: png,
      fileName: 'a.png',
      mimeType: 'image/png',
      kind: 'after',
    });
    expect(storage.put.mock.calls[0]?.[0]).toContain('req-1');
  });
});

/**
 * F-8 — 스토리와 명세가 어긋난다.
 * US-U2-07 인수 조건은 "토큰이 없거나 만료되면 **403**" 이라고 적혀 있지만,
 * `05-portal-api.md` §2.11 표는 **401** 이고 §7 의 매핑 관례(인증=401, 권한=403)도
 * 401 을 가리킨다. U1 의 `verifyImageToken` 도 401 을 던진다.
 * Q5=A(명세 우선)에 따라 **401 을 따른다.** 문서는 고치지 않았다.
 */
describe('serve (US-U2-07)', () => {
  async function uploaded() {
    const ctx = make();
    const { servingUrl } = await ctx.service.upload('req-1', {
      file: png,
      fileName: 'a.png',
      mimeType: 'image/png',
      kind: 'before',
    });
    return { ...ctx, token: new URL(servingUrl).searchParams.get('token') ?? '' };
  }

  it('유효한 토큰이면 이미지를 돌려준다', async () => {
    const { service, token } = await uploaded();
    const result = await service.serve('img-1', token);
    expect(result.mimeType).toBe('image/png');
    expect(result.body).toBeInstanceOf(Uint8Array);
  });

  it('토큰이 없으면 401 이다 (F-8 — 명세 §2.11 을 따른다)', async () => {
    const { service } = await uploaded();
    await expect(service.serve('img-1', null)).rejects.toMatchObject({ status: 401 });
  });

  it('서명이 어긋나면 401 이다', async () => {
    const { service, token } = await uploaded();
    await expect(service.serve('img-1', `${token}tampered`)).rejects.toMatchObject({
      status: 401,
    });
  });

  it('다른 이미지 id 로 만든 토큰은 통하지 않는다 — 토큰이 이미지에 묶여 있다', async () => {
    const { service, token } = await uploaded();
    await expect(service.serve('img-2', token)).rejects.toMatchObject({ status: 401 });
  });

  it('DB 에 없는 이미지는 404 다', async () => {
    const { service } = await uploaded();
    const other = await service.signServingUrl('img-없음');
    const token = new URL(other).searchParams.get('token') ?? '';
    await expect(service.serve('img-없음', token)).rejects.toMatchObject({ status: 404 });
  });
});
