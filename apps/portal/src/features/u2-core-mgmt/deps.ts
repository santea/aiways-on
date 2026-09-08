/**
 * U2 조립 지점 (composition root).
 *
 * **경계 너머 구현을 교체하는 곳은 이 파일 하나다.** U3 T1·T2 가 끝나면 아래 세 줄만
 * 실제 구현으로 바꾸면 되고, 라우트·서비스 코드는 손대지 않는다 (B-1 · B-3).
 *
 * 의존을 **지연 생성**한다 — 모듈 로드 시점에 `getDb()` 를 부르면 `DATABASE_URL` 이 없는
 * 빌드·테스트 환경에서 import 만으로 터진다.
 */
import type {
  PodPort,
  SdlcRequestFactory,
  StateMachineReader,
} from '@aiways/contracts';
import {
  createServerAuth,
  createSessionGuards,
  type GetSessionUser,
  type ServerAuth,
} from '@aiways/lib/auth';
import { createSecretVault, type SecretVault } from '@aiways/lib/crypto';
import { getDb, schema } from '@aiways/lib/db';
import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { createGitHubAdapter, type GitHubAdapter } from './github/adapter';
import { createGithubAdminService, type GithubAdminService } from './github/admin-service';
import { createDrizzleGithubRepository } from './github/repository';
import { createRestGitHubClient } from './github/rest-client';
import { createAuditService, type AuditService } from './audit/audit-service';
import { createDrizzleAuditRepository } from './audit/repository';
import { createImageService, type ImageService } from './images/image-service';
import { createDrizzleImageRepository } from './images/repository';
import { createS3Storage } from './images/s3-storage';
import { createIntakeService, type CompensationPort, type IntakeService } from './request/intake-service';
import { createIssueService, type IssueService } from './request/issue-service';
import { createQueryService, type QueryService } from './request/query-service';
import { createDrizzleRequestRepository } from './request/repository';
import { createSdlcRequestFactoryStub } from './stubs/factory-stub';
import { createPodPortStub } from './stubs/pod-port-stub';
import { createStateMachineReaderStub } from './stubs/state-machine-stub';

/** 세션 사용자 조회 — Auth.js 세션에서 서버가 직접 읽는다 (클라이언트 주장 무시). */
export const getSessionUser: GetSessionUser = async () => {
  const session = await auth();
  const user = session?.user as
    | { id?: string; role?: 'user' | 'admin'; login?: string; email?: string | null }
    | undefined;
  if (!user?.id) return null;
  return {
    id: user.id,
    role: user.role ?? 'user',
    login: user.login ?? '',
    email: user.email ?? null,
  };
};

export const sessionGuards = createSessionGuards(getSessionUser);

function createVault(): SecretVault {
  const db = getDb();
  // 필요한 두 키만 명시적으로 넘긴다 — `process.env` 통째로 넘기면 의도가 흐려진다.
  return createSecretVault(
    {
      SDLC_SECRET_ENCRYPTION_KEY: process.env['SDLC_SECRET_ENCRYPTION_KEY'],
      AUTH_SECRET: process.env['AUTH_SECRET'],
    },
    {
      async insert(row) {
        const rows = await db
          .insert(schema.secretRefs)
          .values(row)
          .returning({ id: schema.secretRefs.id });
        const inserted = rows[0];
        if (!inserted) throw new Error('secret_refs 삽입 결과가 비어 있다');
        return inserted.id;
      },
      async findById(id) {
        const rows = await db
          .select({
            ciphertext: schema.secretRefs.ciphertext,
            iv: schema.secretRefs.iv,
            hint: schema.secretRefs.hint,
          })
          .from(schema.secretRefs)
          .where(eq(schema.secretRefs.id, id))
          .limit(1);
        return rows[0] ?? null;
      },
    },
  );
}

/**
 * F-7 — 보상 진입점 stub. `03-state-machine.md` §6 의 `compensateFailedSdlc` 에 해당하며
 * 구현은 U3 `CompensationHandler`(C-3.4) 소유다. contracts 에 계약이 없어 U2 가 임시로 둔다.
 */
const compensationStub: CompensationPort = {
  async compensate() {
    // U3 T1 교체 전까지는 아무것도 하지 않는다. 대신 접수는 성공을 가장하지 않고 500 이다.
  },
};

let serverAuthCache: ServerAuth | null = null;

/** 서버간 인증 — 지연 생성한다. 모듈 로드 시점에 환경변수를 읽지 않기 위해서다. */
export function serverAuth(): ServerAuth {
  serverAuthCache ??= createServerAuth(process.env);
  return serverAuthCache;
}

export interface U2Deps {
  readonly vault: SecretVault;
  readonly githubAdmin: GithubAdminService;
  readonly githubPort: GitHubAdapter;
  /** B-1 — U3 T1 완료 후 실제 Factory 로 교체 */
  readonly factory: SdlcRequestFactory;
  /** B-1 — U3 T2 완료 후 실제 PodOrchestrator 로 교체 */
  readonly podPort: PodPort;
  /** B-3 — U3 T1 완료 후 실제 StateMachine 의 **읽기 면**으로 교체 */
  readonly stateReader: StateMachineReader;
  readonly intake: IntakeService;
  readonly query: QueryService;
  readonly issues: IssueService;
  readonly audit: AuditService;
  readonly images: ImageService;
}

let cached: U2Deps | null = null;

export function u2Deps(): U2Deps {
  if (cached) return cached;
  const vault = createVault();
  const requestRepository = createDrizzleRequestRepository();
  const githubPort = createGitHubAdapter({ client: createRestGitHubClient({ vault }) });

  // ── 아래 3줄이 B-1 · B-3 교체 지점이다 ─────────────────────────────
  const factory = createSdlcRequestFactoryStub();
  const podPort = createPodPortStub();
  const stateReader = createStateMachineReaderStub();

  cached = {
    vault,
    githubAdmin: createGithubAdminService({
      repository: createDrizzleGithubRepository(),
      vault,
    }),
    githubPort,
    factory,
    podPort,
    stateReader,
    intake: createIntakeService({ factory, podPort, compensation: compensationStub }),
    query: createQueryService({
      repository: requestRepository,
      stateReader,
      guards: sessionGuards,
    }),
    issues: createIssueService({ githubPort, repository: requestRepository }),
    audit: createAuditService({ repository: createDrizzleAuditRepository() }),
    images: createImageService({
      env: {
        SDLC_IMAGE_SIGNING_SECRET: process.env['SDLC_IMAGE_SIGNING_SECRET'],
        AUTH_SECRET: process.env['AUTH_SECRET'],
      },
      storage: createS3Storage({
        S3_ENDPOINT: process.env['S3_ENDPOINT'],
        S3_BUCKET: process.env['S3_BUCKET'],
        S3_ACCESS_KEY: process.env['S3_ACCESS_KEY'],
        S3_SECRET_KEY: process.env['S3_SECRET_KEY'],
        S3_REGION: process.env['S3_REGION'],
        S3_PREFIX: process.env['S3_PREFIX'],
      }),
      repository: createDrizzleImageRepository(),
      baseUrl: process.env['APP_URL'] ?? 'http://localhost:3000',
    }),
  };
  return cached;
}

/** 테스트에서 조립을 갈아끼우기 위한 통로. 운영 코드에서는 부르지 않는다. */
export function __setU2Deps(deps: U2Deps | null): void {
  cached = deps;
}
