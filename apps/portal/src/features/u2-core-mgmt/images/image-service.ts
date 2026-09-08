/**
 * `ImageProxy` — C-2.5 (US-U2-07, B-4).
 *
 * Pod 가 캡처한 목업 PNG 를 오브젝트 스토리지에 넣고, **서명된 프록시 URL** 로만 서빙한다.
 * presigned URL 을 밖으로 내보내지 않는 것이 요점이다 — 그러면 만료·폐기를 우리가 못 쥔다.
 *
 * F-8 — US-U2-07 인수 조건은 토큰 실패를 403 이라고 적었지만 `05-portal-api.md` §2.11 은
 * 401 이고 §7 의 매핑 관례(인증=401·권한=403)도 401 을 가리킨다. Q5=A(명세 우선)에 따라
 * 401 을 쓴다. 두 문서 모두 고치지 않았다 — 정리는 사용자 판단이다.
 */
import { AuthError, createImageTokens } from '@aiways/lib/auth';
import { notFound, validationFailed } from '@aiways/lib/http';

/** `05-portal-api.md` §2.10 — 업로드 필드 `kind` */
export const IMAGE_KINDS = ['before', 'after', 'verify', 'merged'] as const;
export type ImageKind = (typeof IMAGE_KINDS)[number];

const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);
const MAX_BYTES = 10 * 1024 * 1024;

export interface ObjectStorage {
  put(objectKey: string, body: Uint8Array, mimeType: string): Promise<void>;
  get(objectKey: string): Promise<{ body: Uint8Array; mimeType: string } | null>;
}

export interface ImageRepository {
  saveImage(input: {
    requestId: string;
    kind: ImageKind;
    screenName: string | null;
    mimeType: string;
    objectKey: string;
  }): Promise<string>;
  findImage(imageId: string): Promise<{ objectKey: string; mimeType: string } | null>;
}

export interface UploadInput {
  readonly file: Uint8Array;
  readonly fileName: string;
  readonly mimeType: string;
  readonly kind: ImageKind;
  readonly screenName?: string | null;
}

export interface ImageServiceDeps {
  readonly env: { SDLC_IMAGE_SIGNING_SECRET?: string; AUTH_SECRET?: string };
  readonly storage: ObjectStorage;
  readonly repository: ImageRepository;
  readonly baseUrl: string;
}

const extensionOf = (fileName: string): string => {
  const dot = fileName.lastIndexOf('.');
  return dot > 0 ? fileName.slice(dot + 1).toLowerCase() : 'png';
};

export function createImageService({ env, storage, repository, baseUrl }: ImageServiceDeps) {
  const secret = env.SDLC_IMAGE_SIGNING_SECRET || env.AUTH_SECRET || '';
  const tokens = createImageTokens({ secret });

  const signServingUrl = (imageId: string): string =>
    new URL(tokens.signImageUrl({ imageId }), baseUrl).toString();

  return {
    signServingUrl: async (imageId: string) => signServingUrl(imageId),

    async upload(requestId: string, input: UploadInput) {
      if (!IMAGE_KINDS.includes(input.kind)) {
        throw validationFailed(`kind 는 ${IMAGE_KINDS.join(' | ')} 중 하나다`);
      }
      if (input.file.byteLength === 0) {
        throw validationFailed('file is required');
      }
      if (input.file.byteLength > MAX_BYTES) {
        throw validationFailed('이미지가 너무 크다');
      }
      // 이미지만 받는다 — 그러지 않으면 마스터 키를 가진 쪽이 임의 파일을 올릴 수 있다.
      if (!ALLOWED_MIME.has(input.mimeType)) {
        throw validationFailed('이미지 형식만 업로드할 수 있다');
      }

      const objectKey = `sdlc/${requestId}/${input.kind}-${Date.now()}.${extensionOf(input.fileName)}`;
      await storage.put(objectKey, input.file, input.mimeType);

      const imageId = await repository.saveImage({
        requestId,
        kind: input.kind,
        screenName: input.screenName ?? null,
        mimeType: input.mimeType,
        objectKey,
      });

      return { ok: true as const, imageId, servingUrl: signServingUrl(imageId) };
    },

    async serve(imageId: string, token: string | null) {
      if (!token) {
        throw new AuthError(401, 'UNAUTHORIZED', '이미지 토큰이 없다');
      }
      // 서명 검증이 먼저다. DB 조회를 먼저 하면 존재 여부가 토큰 없이 새어 나간다.
      tokens.verifyImageToken({ imageId, token });

      const image = await repository.findImage(imageId);
      if (!image) throw notFound('이미지를 찾을 수 없다');

      const object = await storage.get(image.objectKey);
      if (!object) throw notFound('이미지를 찾을 수 없다');

      return { body: object.body, mimeType: object.mimeType || image.mimeType };
    },
  };
}

export type ImageService = ReturnType<typeof createImageService>;
