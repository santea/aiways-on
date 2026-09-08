import { describe, expect, it, vi } from 'vitest';
import { createS3Storage, type S3Env } from '../s3-storage';

const ENV: S3Env = {
  S3_ENDPOINT: 'http://minio.internal:9000',
  S3_BUCKET: 'aiways-on-sdlc',
  S3_ACCESS_KEY: 'AKIA_TEST',
  S3_SECRET_KEY: 'secret-test',
  S3_REGION: 'ap-northeast-2',
};

function storage(responder: () => Response, env: S3Env = ENV) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return responder();
  }) as unknown as typeof fetch;
  return { calls, s3: createS3Storage(env, fetchImpl) };
}

describe('설정 검증', () => {
  it.each(['S3_ENDPOINT', 'S3_BUCKET', 'S3_ACCESS_KEY', 'S3_SECRET_KEY'])(
    '%s 가 없으면 이름을 밝히며 거부한다',
    (missing) => {
      const env = { ...ENV, [missing]: undefined };
      expect(() => createS3Storage(env)).toThrow(missing);
    },
  );
});

describe('put', () => {
  it('path-style URL 로 PUT 하고 SigV4 헤더를 붙인다', async () => {
    const { s3, calls } = storage(() => new Response(null, { status: 200 }));
    await s3.put('sdlc/req-1/a.png', new Uint8Array([1, 2, 3]), 'image/png');

    const call = calls[0];
    expect(call?.url).toBe('http://minio.internal:9000/aiways-on-sdlc/sdlc/req-1/a.png');
    expect(call?.init?.method).toBe('PUT');

    const headers = call?.init?.headers as Record<string, string>;
    expect(headers['Authorization']).toContain('AWS4-HMAC-SHA256 Credential=AKIA_TEST/');
    expect(headers['Authorization']).toContain('ap-northeast-2/s3/aws4_request');
    expect(headers['x-amz-content-sha256']).toMatch(/^[0-9a-f]{64}$/);
    expect(headers['content-type']).toBe('image/png');
  });

  it('시크릿 키 자체는 헤더에 실리지 않는다', async () => {
    const { s3, calls } = storage(() => new Response(null, { status: 200 }));
    await s3.put('k', new Uint8Array([1]), 'image/png');
    expect(JSON.stringify(calls[0]?.init?.headers)).not.toContain('secret-test');
  });

  it('prefix 가 있으면 키 앞에 붙는다', async () => {
    const { s3, calls } = storage(() => new Response(null, { status: 200 }), {
      ...ENV,
      S3_PREFIX: 'tenant-a/',
    });
    await s3.put('sdlc/x.png', new Uint8Array([1]), 'image/png');
    expect(calls[0]?.url).toContain('/aiways-on-sdlc/tenant-a/sdlc/x.png');
  });

  it('실패하면 상태 코드만 알리고 본문을 올리지 않는다 (NFR-16)', async () => {
    const { s3 } = storage(
      () => new Response('<Error><Message>AKIA_TEST leaked</Message></Error>', { status: 403 }),
    );
    await expect(s3.put('k', new Uint8Array([1]), 'image/png')).rejects.toThrow(/403/);
    await expect(s3.put('k', new Uint8Array([1]), 'image/png')).rejects.not.toThrow(/leaked/);
  });
});

describe('get', () => {
  it('바이트와 content-type 을 돌려준다', async () => {
    const { s3 } = storage(
      () =>
        new Response(new Uint8Array([9, 9]), {
          status: 200,
          headers: { 'content-type': 'image/png' },
        }),
    );
    const result = await s3.get('k');
    expect(result?.mimeType).toBe('image/png');
    expect(Array.from(result?.body ?? [])).toEqual([9, 9]);
  });

  it('404 는 null 이다 — 없는 이미지를 예외로 만들지 않는다', async () => {
    const { s3 } = storage(() => new Response(null, { status: 404 }));
    await expect(s3.get('k')).resolves.toBeNull();
  });

  it('content-type 이 없으면 octet-stream 으로 둔다', async () => {
    const { s3 } = storage(() => new Response(new Uint8Array([1]), { status: 200 }));
    const result = await s3.get('k');
    expect(result?.mimeType).toBe('application/octet-stream');
  });

  it('그 밖의 실패는 예외다', async () => {
    const { s3 } = storage(() => new Response(null, { status: 500 }));
    await expect(s3.get('k')).rejects.toThrow(/500/);
  });
});
