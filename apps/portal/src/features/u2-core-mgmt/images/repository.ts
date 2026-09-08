/** 이미지 메타데이터 접근 — `sdlc_request_images` (US-U2-07). */
import { getDb, schema } from '@aiways/lib/db';
import { eq } from 'drizzle-orm';
import type { ImageRepository } from './image-service';

export function createDrizzleImageRepository(db = getDb()): ImageRepository {
  return {
    async saveImage(input) {
      const rows = await db
        .insert(schema.sdlcRequestImages)
        .values(input)
        .returning({ id: schema.sdlcRequestImages.id });
      const row = rows[0];
      if (!row) throw new Error('이미지 저장 결과가 비어 있다');
      return row.id;
    },

    async findImage(imageId) {
      const rows = await db
        .select({
          objectKey: schema.sdlcRequestImages.objectKey,
          mimeType: schema.sdlcRequestImages.mimeType,
        })
        .from(schema.sdlcRequestImages)
        .where(eq(schema.sdlcRequestImages.id, imageId))
        .limit(1);
      return rows[0] ?? null;
    },
  };
}
