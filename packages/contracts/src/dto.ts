/**
 * 유닛 경계를 넘는 DTO.
 * 근거: requirements/05-portal-api.md, requirements/04-db-schema.md
 */
import type {
  ChannelType,
  PipelineProfile,
  SdlcRequestMetadata,
  Stage,
} from './stage';

/** 사용자 역할 (단순 2단계 RBAC). 근거: 01-auth-github.md §5 */
export type UserRole = 'user' | 'admin';

/** 인증된 사용자. 세션에서 꺼내 쓰는 최소 정보. */
export interface AuthenticatedUser {
  readonly id: string;
  readonly role: UserRole;
  readonly login: string;
  readonly email: string | null;
}

/** SR 요약 — 목록·대시보드용. */
export interface SdlcRequestSummary {
  readonly id: string;
  readonly requestNo: string;
  readonly submitter: string;
  readonly submitterId: string | null;
  readonly requestSystem: string;
  readonly devType: string;
  readonly status: Stage;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** SR 상세 — 각인된 정책과 메타데이터를 포함한다. */
export interface SdlcRequestDetail extends SdlcRequestSummary {
  readonly requestSite: string;
  readonly module: string | null;
  readonly submitterEmail: string | null;
  readonly submitterGithubLogin: string | null;
  readonly dedupKey: string;
  readonly metadata: SdlcRequestMetadata;
}

/** SR 생성 입력. `dedupKey` 는 **호출자가** 생성해 전달한다 (B-1 멱등 책임). */
export interface CreateSdlcRequestInput {
  readonly requestNo?: string;
  readonly submitter: string;
  readonly submitterId?: string | null;
  readonly submitterEmail?: string | null;
  readonly submitterGithubLogin?: string | null;
  readonly requestSite: string;
  readonly devType: string;
  readonly requestSystem: string;
  readonly module?: string | null;
  readonly dedupKey: string;
  readonly metadata?: SdlcRequestMetadata;
}

/** 채널 스냅샷 한 건. */
export interface ChannelMessage {
  readonly messageId: string;
  readonly channelId: string;
  readonly channelType: ChannelType;
  readonly sender: string;
  readonly senderName: string | null;
  readonly content: string;
  readonly sentAt: string;
}

/** 상태 전이 이력 한 건. */
export interface StageTransition {
  readonly id: string;
  readonly requestId: string;
  readonly fromStatus: Stage;
  readonly toStatus: Stage;
  readonly idempotencyKey: string;
  readonly actor: string;
  readonly createdAt: string;
}

/** 표준 오류 응답. 근거: 05-portal-api.md */
export interface ApiError {
  readonly code: string;
  readonly message: string;
  readonly details?: unknown;
}

/** 프로파일별 기본 채널 구성을 설명하는 타입 (문서용). */
export type ProfileChannelMap = { readonly [P in PipelineProfile]: readonly ChannelType[] };
