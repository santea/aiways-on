import { describe, expect, it } from 'vitest';
import { AuthError } from '../guard';
import { createImageTokens } from '../image-token';

const SECRET = 'image-signing-secret';

describe('이미지 서명 토큰', () => {
  it('서명한 URL 을 자신이 검증할 수 있다', () => {
    const t = createImageTokens({ secret: SECRET, now: () => 1_000_000 });
    const url = t.signImageUrl({ imageId: 'img-1' });
    const token = new URL(url, 'https://portal.local').searchParams.get('token')!;
    expect(() => t.verifyImageToken({ imageId: 'img-1', token })).not.toThrow();
  });

  it('다른 이미지 id 로는 검증에 실패한다', () => {
    const t = createImageTokens({ secret: SECRET, now: () => 1_000_000 });
    const url = t.signImageUrl({ imageId: 'img-1' });
    const token = new URL(url, 'https://portal.local').searchParams.get('token')!;
    expect(() => t.verifyImageToken({ imageId: 'img-2', token })).toThrow(AuthError);
  });

  it('만료된 토큰을 거부한다', () => {
    const signer = createImageTokens({ secret: SECRET, now: () => 1_000_000 });
    const url = signer.signImageUrl({ imageId: 'img-1', ttlSeconds: 60 });
    const token = new URL(url, 'https://portal.local').searchParams.get('token')!;
    const later = createImageTokens({ secret: SECRET, now: () => 1_000_000 + 61_000 });
    expect(() => later.verifyImageToken({ imageId: 'img-1', token })).toThrow(AuthError);
  });

  it('변조된 토큰을 거부한다', () => {
    const t = createImageTokens({ secret: SECRET, now: () => 1_000_000 });
    expect(() => t.verifyImageToken({ imageId: 'img-1', token: 'garbage' })).toThrow(AuthError);
  });

  it('다른 비밀키로 만든 토큰을 거부한다', () => {
    const a = createImageTokens({ secret: SECRET, now: () => 1_000_000 });
    const b = createImageTokens({ secret: 'other-secret', now: () => 1_000_000 });
    const url = a.signImageUrl({ imageId: 'img-1' });
    const token = new URL(url, 'https://portal.local').searchParams.get('token')!;
    expect(() => b.verifyImageToken({ imageId: 'img-1', token })).toThrow(AuthError);
  });
});
