import { AuthError } from '@aiways/lib/auth';
import { describe, expect, it, vi } from 'vitest';
import { createImageServeHandlers, createImageUploadHandlers } from '../handlers';

const ctx = (params: Record<string, string>) => ({ params: Promise.resolve(params) });
const okKey = vi.fn(() => undefined);
const badKey = vi.fn(() => {
  throw new AuthError(401, 'UNAUTHORIZED', '유효하지 않은 서버간 인증 토큰');
});

function uploadRequest(fields: Record<string, string | File>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  return new Request('http://portal/requests/req-1/channel-image', {
    method: 'POST',
    body: form,
  });
}

const pngFile = () =>
  new File([new Uint8Array([0x89, 0x50])], 'before.png', { type: 'image/png' });

describe('POST /requests/{id}/channel-image (§2.10)', () => {
  it('파일과 kind 를 서비스로 넘기고 결과를 돌려준다', async () => {
    const upload = vi.fn(async () => ({
      ok: true,
      imageId: 'img-1',
      servingUrl: 'https://portal/api/v1/sdlc/images/img-1?token=t',
    }));
    const res = await createImageUploadHandlers({
      requireMasterKey: okKey,
      service: () => ({ upload }) as never,
    }).POST(uploadRequest({ file: pngFile(), kind: 'before', screenName: '대시보드' }), ctx({ id: 'req-1' }));

    expect(res.status).toBe(200);
    expect(upload).toHaveBeenCalledWith(
      'req-1',
      expect.objectContaining({ kind: 'before', screenName: '대시보드', mimeType: 'image/png' }),
    );
  });

  it('마스터 키가 없으면 401 이고 업로드는 시도조차 하지 않는다', async () => {
    const upload = vi.fn();
    const res = await createImageUploadHandlers({
      requireMasterKey: badKey,
      service: () => ({ upload }) as never,
    }).POST(uploadRequest({ file: pngFile(), kind: 'before' }), ctx({ id: 'req-1' }));
    expect(res.status).toBe(401);
    expect(upload).not.toHaveBeenCalled();
  });

  it('file 필드가 없으면 400 이다', async () => {
    const res = await createImageUploadHandlers({
      requireMasterKey: okKey,
      service: () => ({ upload: vi.fn() }) as never,
    }).POST(uploadRequest({ kind: 'before' }), ctx({ id: 'req-1' }));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('multipart 가 아니면 400 이다', async () => {
    const res = await createImageUploadHandlers({
      requireMasterKey: okKey,
      service: () => ({ upload: vi.fn() }) as never,
    }).POST(
      new Request('http://portal/x', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      }),
      ctx({ id: 'req-1' }),
    );
    expect(res.status).toBe(400);
  });
});

describe('GET /images/{imageId} (§2.11)', () => {
  const serve = vi.fn(async () => ({
    body: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
    mimeType: 'image/png',
  }));

  it('토큰을 서비스로 넘기고 이미지를 스트리밍한다', async () => {
    const res = await createImageServeHandlers({ service: () => ({ serve }) as never }).GET(
      new Request('http://portal/api/v1/sdlc/images/img-1?token=abc'),
      ctx({ imageId: 'img-1' }),
    );
    expect(serve).toHaveBeenCalledWith('img-1', 'abc');
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(
      new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
    );
  });

  it('영구 캐시 헤더를 붙인다 — 서명 URL 은 이미지에 묶여 있다', async () => {
    const res = await createImageServeHandlers({ service: () => ({ serve }) as never }).GET(
      new Request('http://portal/api/v1/sdlc/images/img-1?token=abc'),
      ctx({ imageId: 'img-1' }),
    );
    expect(res.headers.get('cache-control')).toBe('private, max-age=31536000, immutable');
  });

  it('토큰이 없으면 null 로 넘겨 서비스가 거부하게 한다', async () => {
    const rejecting = vi.fn(async () => {
      throw new AuthError(401, 'UNAUTHORIZED', '이미지 토큰이 없다');
    });
    const res = await createImageServeHandlers({
      service: () => ({ serve: rejecting }) as never,
    }).GET(
      new Request('http://portal/api/v1/sdlc/images/img-1'),
      ctx({ imageId: 'img-1' }),
    );
    expect(rejecting).toHaveBeenCalledWith('img-1', null);
    expect(res.status).toBe(401);
  });
});
