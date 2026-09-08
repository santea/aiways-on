/**
 * 이미지 업로드·서빙 라우트 — `05-portal-api.md` §2.10·§2.11 (US-U2-07).
 *
 * 업로드는 `SDLC_MASTER_KEY`, 서빙은 쿼리 서명 토큰이다. 서빙 경로는 Slack 도메인에서
 * 열리므로 쿠키 인증이 불가능하고, 서명 토큰이 유일한 방어선이다.
 */
import type { RequireMasterKey } from '@aiways/lib/auth';
import { validationFailed } from '@aiways/lib/http';
import { handle, routeParam } from '../http/route-helpers';
import type { ImageKind, ImageService } from './image-service';

export interface ImageUploadHandlerDeps {
  readonly requireMasterKey: RequireMasterKey;
  readonly service: () => ImageService;
}

export function createImageUploadHandlers({
  requireMasterKey,
  service,
}: ImageUploadHandlerDeps) {
  return {
    POST: handle(async (request, context) => {
      requireMasterKey(request);
      const requestId = await routeParam(context, 'id');

      const form = await request.formData().catch(() => null);
      if (!form) throw validationFailed('multipart/form-data 가 필요하다');

      const file = form.get('file');
      if (!(file instanceof File)) throw validationFailed('file is required');

      const result = await service().upload(requestId, {
        file: new Uint8Array(await file.arrayBuffer()),
        fileName: file.name,
        mimeType: file.type,
        kind: String(form.get('kind') ?? '') as ImageKind,
        screenName: form.get('screenName') ? String(form.get('screenName')) : null,
      });

      return Response.json(result);
    }),
  };
}

export function createImageServeHandlers({ service }: { service: () => ImageService }) {
  return {
    GET: handle(async (request, context) => {
      const imageId = await routeParam(context, 'imageId');
      const token = new URL(request.url).searchParams.get('token');
      const image = await service().serve(imageId, token);

      // Uint8Array 를 그대로 넘기면 lib.dom 의 BodyInit 과 어긋난다.
      // 뷰를 복사해 Blob 으로 감싼다 — subarray 로 잘라 온 버퍼여도 안전하다.
      const blob = new Blob([new Uint8Array(image.body)], { type: image.mimeType });

      return new Response(blob, {
        headers: {
          'Content-Type': image.mimeType,
          // 서명 URL 은 이미지에 묶여 있고 내용이 바뀌지 않는다.
          'Cache-Control': 'private, max-age=31536000, immutable',
        },
      });
    }),
  };
}
