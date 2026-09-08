import { pgSchema } from 'drizzle-orm/pg-core';

/**
 * SDLC 비즈니스 테이블 스키마.
 *
 * 인증 테이블(`users`·`accounts`·`sessions`·`verification_tokens`)은 Auth.js Drizzle Adapter
 * 호환을 위해 `public` 스키마에 두고, 그 외 전부를 이 스키마에 둔다.
 * 근거: requirements/04-db-schema.md §11.3
 *
 * 명세는 `mySchema` 와 `sdlcSchema` 를 혼용하지만 여기서는 **`sdlcSchema` 로 통일**한다
 * (U1 Code Generation Part 1 §2 부수 정리 항목).
 */
export const sdlcSchema = pgSchema('sdlc');
