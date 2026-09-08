/**
 * 목업 이미지 서명 URL — C-2.5 가 소비하는 U1 계약 (B-4).
 *
 * 이미지 서빙은 미들웨어 인증 예외 경로이므로, 서명 토큰이 유일한 방어선이다.
 * HMAC-SHA256 으로 `imageId` 와 만료시각을 함께 서명해 다른 이미지로의 전용을 막는다.
 */
import { createHmac } from 'node:crypto';
import { AuthError } from './guard';
import { safeEqual } from './compare';

const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 7;

export interface ImageTokenDeps {
  readonly secret: string;
  /** 테스트에서 시간을 고정하기 위해 주입한다. */
  readonly now?: () => number;
}

function sign(secret: string, imageId: string, expMs: number): string {
  return createHmac('sha256', secret).update(`${imageId}.${expMs}`).digest('base64url');
}

export function createImageTokens({ secret, now = Date.now }: ImageTokenDeps) {
  if (!secret) {
    throw new Error('SDLC_IMAGE_SIGNING_SECRET 이 필요하다');
  }

  return {
    signImageUrl({ imageId, ttlSeconds = DEFAULT_TTL_SECONDS }: {
      imageId: string;
      ttlSeconds?: number;
    }): string {
      const exp = now() + ttlSeconds * 1000;
      const token = `${exp}.${sign(secret, imageId, exp)}`;
      return `/api/v1/sdlc/images/${encodeURIComponent(imageId)}?token=${encodeURIComponent(token)}`;
    },

    verifyImageToken({ imageId, token }: { imageId: string; token: string }): void {
      const sep = token.indexOf('.');
      if (sep <= 0) {
        throw new AuthError(401, 'UNAUTHORIZED', '이미지 토큰 형식이 올바르지 않다');
      }
      const expPart = token.slice(0, sep);
      const sigPart = token.slice(sep + 1);
      const exp = Number(expPart);
      if (!Number.isFinite(exp)) {
        throw new AuthError(401, 'UNAUTHORIZED', '이미지 토큰 만료시각이 올바르지 않다');
      }
      // 서명을 먼저 검증한다 — 만료 판정만으로 서명 없는 토큰을 통과시키지 않기 위해서다.
      if (!safeEqual(sigPart, sign(secret, imageId, exp))) {
        throw new AuthError(401, 'UNAUTHORIZED', '이미지 토큰 서명이 일치하지 않는다');
      }
      if (now() > exp) {
        throw new AuthError(401, 'UNAUTHORIZED', '이미지 토큰이 만료됐다');
      }
    },
  };
}
