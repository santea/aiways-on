/**
 * @aiways/contracts — 유닛 경계를 넘는 계약의 단일 선언 지점.
 *
 * ⚠️ 이 패키지에는 **런타임 코드가 없다.** 타입·인터페이스 선언만 둔다.
 *    `pnpm verify:contracts-runtime-free` 가 컴파일 산출 JS 가 비어 있는지 검사한다.
 *    실행이 필요한 상수·헬퍼는 `@aiways/lib/domain` 에 둔다.
 *
 * 소유: U1. 다른 유닛은 import 만 한다 (NFR-27, AD-4).
 */
export type * from './stage';
export type * from './dto';
export type * from './ports';
export type * from './factory';
export type * from './state';
