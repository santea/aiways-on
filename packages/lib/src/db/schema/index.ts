/**
 * 스키마 배럴 — **U1 단독 소유** (UOW-8).
 *
 * 유닛은 자기 파일 안에서 자기 테이블만 추가한다. 이 파일과 공유 테이블
 * (`users`·`sessions`·`audit_events`·`secret_refs`·`sdlc_requests`), FK 규약의 변경은
 * U1 승인 대상이다.
 *
 * ⚠️ 재수출 순서 = FK 의존 순서 (04-db-schema.md §11.2).
 *    규정(memory)이 장애(incident)·개선(improvement)보다 먼저 온다.
 */
export * from './_schema';
export * from './core';
export * from './sdlc';
export * from './memory';
export * from './incident';
export * from './improvement';
