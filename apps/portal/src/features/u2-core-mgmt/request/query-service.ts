/**
 * `RequestQuery` — C-2.2 (US-U2-02 · US-U2-03).
 *
 * 두 가지가 이 파일의 핵심이다.
 *  - **소유권을 서버가 강제한다.** `user` 는 본인 SR 만 본다. 클라이언트가 보낸
 *    `submitterId` 는 신뢰하지 않고 세션 값으로 덮는다 (NFR-12, IDOR 방지).
 *  - **상태는 만들지 않고 읽기만 한다.** stage·substage·전이 이력은 전부
 *    `StateMachineReader` 에서 온다 (B-3). U2 에는 전이 함수가 없다.
 */
import type {
  DevSubStageState,
  PipelineProfile,
  SdlcRequestSummary,
  Stage,
  StateMachineReader,
  StageTransition,
} from '@aiways/contracts';
import { notFound } from '@aiways/lib/http';
import { formatRequestNo, todayYmd } from '../request-no';
import type {
  RequestChannelView,
  RequestGithubLinks,
  RequestPodView,
  SdlcRequestRepository,
} from './repository';

/** `08-sr-registration-ui.md` §3.2 — 등록 폼 select 옵션 */
export const DEV_TYPES = ['feature', 'bugfix', 'refactor', 'hotfix'] as const;

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export interface ListFilter {
  readonly status?: string | null;
  readonly search?: string | null;
  readonly page?: number;
  readonly limit?: number;
}

export interface ListResult {
  readonly items: readonly SdlcRequestSummary[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
}

export interface RequestDetailView {
  readonly id: string;
  readonly requestNo: string;
  readonly submitter: string;
  readonly submitterId: string | null;
  readonly submitterGithubLogin: string | null;
  readonly requestSystem: string;
  readonly requestSite: string;
  readonly devType: string;
  readonly module: string | null;
  readonly status: Stage;
  readonly profile: PipelineProfile;
  readonly metadata: Record<string, unknown>;
  readonly devSubStage: DevSubStageState | null;
  readonly channels: readonly RequestChannelView[];
  readonly pod: RequestPodView | null;
  readonly github: RequestGithubLinks;
  readonly stageHistory: readonly StageTransition[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SessionGuardSet {
  requireUser(): Promise<{ id: string; role: 'user' | 'admin' }>;
  requireOwnership(ownerId: string | null): Promise<{ id: string; role: 'user' | 'admin' }>;
}

export interface QueryServiceDeps {
  readonly repository: SdlcRequestRepository;
  readonly stateReader: StateMachineReader;
  readonly guards: SessionGuardSet;
}

/** 범위를 벗어난 페이지 값은 오류가 아니라 기본값으로 되돌린다 — 목록은 계속 열려야 한다. */
function clampPage(value: number | undefined): number {
  return Number.isInteger(value) && (value as number) >= 1 ? (value as number) : DEFAULT_PAGE;
}

function clampLimit(value: number | undefined): number {
  return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= MAX_LIMIT
    ? (value as number)
    : DEFAULT_LIMIT;
}

export function createQueryService({ repository, stateReader, guards }: QueryServiceDeps) {
  return {
    async listRequests(filter: ListFilter): Promise<ListResult> {
      const user = await guards.requireUser();
      const page = clampPage(filter.page);
      const limit = clampLimit(filter.limit);

      const { items, total } = await repository.list({
        // admin 이 아니면 본인 것만. 클라이언트가 무엇을 보냈든 여기서 덮는다.
        submitterId: user.role === 'admin' ? null : user.id,
        status: filter.status ?? null,
        search: filter.search ?? null,
        page,
        limit,
      });

      return { items, total, page, limit };
    },

    async getRequest(requestId: string): Promise<RequestDetailView> {
      const detail = await repository.findDetail(requestId);
      if (!detail) throw notFound('요청을 찾을 수 없다');
      await guards.requireOwnership(detail.submitterId);

      const [channels, pod, github, stageHistory, devSubStage, stage] = await Promise.all([
        repository.findChannels(requestId),
        repository.findPod(requestId),
        repository.findGithubLinks(requestId),
        stateReader.getTransitions(requestId),
        stateReader.getSubStage(requestId),
        stateReader.getStage(requestId),
      ]);

      return {
        id: detail.id,
        requestNo: detail.requestNo,
        submitter: detail.submitter,
        submitterId: detail.submitterId,
        submitterGithubLogin: detail.submitterGithubLogin,
        requestSystem: detail.requestSystem,
        requestSite: detail.requestSite,
        devType: detail.devType,
        module: detail.module,
        // B-3 — 상태의 출처는 StateMachine 이다. 행의 status 는 그것이 없을 때만 쓴다.
        status: stage ?? detail.status,
        profile: detail.profile,
        metadata: detail.metadata,
        devSubStage,
        channels,
        pod,
        github,
        stageHistory,
        createdAt: detail.createdAt,
        updatedAt: detail.updatedAt,
      };
    },

    async getGithubLinks(requestId: string): Promise<RequestGithubLinks> {
      const detail = await repository.findDetail(requestId);
      if (!detail) throw notFound('요청을 찾을 수 없다');
      await guards.requireOwnership(detail.submitterId);
      return repository.findGithubLinks(requestId);
    },

    /** `SR-YYYYMMDD-NNN` — 시각은 **서버에서만** 만든다 (`08-sr-registration-ui.md` §4.2). */
    async nextRequestNo(now: Date = new Date()): Promise<{ requestNo: string }> {
      await guards.requireUser();
      const ymd = todayYmd(now);
      return { requestNo: formatRequestNo(ymd, await repository.nextSequence(ymd)) };
    },

    async devTypes(): Promise<{ devTypes: readonly string[] }> {
      await guards.requireUser();
      return { devTypes: DEV_TYPES };
    },
  };
}

export type QueryService = ReturnType<typeof createQueryService>;
