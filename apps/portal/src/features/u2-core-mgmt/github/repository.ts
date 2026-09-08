/**
 * Org · Repo · Credential 데이터 접근 (C-2.3).
 *
 * 인터페이스와 Drizzle 구현을 나눈 이유: 비밀값 처리·검증 같은 **판단이 들어간 코드**는
 * `admin-service.ts` 에 두고 DB 없이 검증한다. 여기에는 쿼리만 남는다.
 *
 * 이 유닛은 테이블을 새로 만들지 않는다 — 전부 U1 이 선언한 스키마다.
 */
import { getDb, schema } from '@aiways/lib/db';
import { desc, eq } from 'drizzle-orm';

/** INSERT ... RETURNING 은 타입상 빈 배열일 수 있다. 조용히 undefined 를 흘리지 않는다. */
function firstOrThrow<T>(rows: readonly T[], what: string): T {
  const row = rows[0];
  if (!row) throw new Error(`${what} 생성 결과가 비어 있다`);
  return row;
}

export interface OrgRow {
  readonly id: string;
  readonly orgUrl: string;
  readonly orgName: string;
  readonly credentialId: string | null;
}

export interface RepoRow {
  readonly id: string;
  readonly orgId: string;
  readonly repoUrl: string;
  readonly repoName: string;
  readonly description: string | null;
  readonly defaultBranch: string;
  readonly autoPrMerge: boolean;
  readonly isUi: boolean;
  readonly runnable: boolean;
  readonly playwrightEnabled: boolean;
}

export interface CredentialRow {
  readonly id: string;
  readonly gitUserName: string;
  readonly gitUserEmail: string;
  readonly patSecretRefId: string;
}

export interface GithubRepository {
  listOrgs(): Promise<readonly OrgRow[]>;
  createOrg(input: {
    orgUrl: string;
    orgName: string;
    credentialId: string | null;
  }): Promise<OrgRow>;
  listRepos(orgId?: string | null): Promise<readonly RepoRow[]>;
  createRepo(input: {
    orgId: string;
    repoUrl: string;
    repoName: string;
    description: string | null;
    defaultBranch: string;
    autoPrMerge: boolean;
    isUi: boolean;
    runnable: boolean;
  }): Promise<RepoRow>;
  createCredential(input: {
    patSecretRefId: string;
    gitUserName: string;
    gitUserEmail: string;
  }): Promise<CredentialRow>;
  addRepoFile(input: {
    repoId: string;
    relativePath: string;
    contentSecretRefId: string;
  }): Promise<void>;
  addRepoEnvVar(input: {
    repoId: string;
    key: string;
    valueSecretRefId: string;
  }): Promise<void>;
  createSetupJob(input: { repoId: string; requestedBy: string | null }): Promise<void>;
}

const {
  sdlcGithubOrgs,
  sdlcGithubRepos,
  sdlcGithubCredentials,
  sdlcRepoFiles,
  sdlcRepoEnvVars,
  sdlcRepoSetupJobs,
} = schema;

export function createDrizzleGithubRepository(db = getDb()): GithubRepository {
  return {
    async listOrgs() {
      return db
        .select({
          id: sdlcGithubOrgs.id,
          orgUrl: sdlcGithubOrgs.orgUrl,
          orgName: sdlcGithubOrgs.orgName,
          credentialId: sdlcGithubOrgs.credentialId,
        })
        .from(sdlcGithubOrgs)
        .orderBy(desc(sdlcGithubOrgs.createdAt));
    },

    async createOrg(input) {
      const rows = await db.insert(sdlcGithubOrgs).values(input).returning({
        id: sdlcGithubOrgs.id,
        orgUrl: sdlcGithubOrgs.orgUrl,
        orgName: sdlcGithubOrgs.orgName,
        credentialId: sdlcGithubOrgs.credentialId,
      });
      return firstOrThrow(rows, 'Org');
    },

    async listRepos(orgId) {
      const columns = {
        id: sdlcGithubRepos.id,
        orgId: sdlcGithubRepos.orgId,
        repoUrl: sdlcGithubRepos.repoUrl,
        repoName: sdlcGithubRepos.repoName,
        description: sdlcGithubRepos.description,
        defaultBranch: sdlcGithubRepos.defaultBranch,
        autoPrMerge: sdlcGithubRepos.autoPrMerge,
        isUi: sdlcGithubRepos.isUi,
        runnable: sdlcGithubRepos.runnable,
        playwrightEnabled: sdlcGithubRepos.playwrightEnabled,
      };
      const query = db.select(columns).from(sdlcGithubRepos);
      return orgId
        ? query.where(eq(sdlcGithubRepos.orgId, orgId)).orderBy(sdlcGithubRepos.repoName)
        : query.orderBy(sdlcGithubRepos.repoName);
    },

    async createRepo(input) {
      const rows = await db
        .insert(sdlcGithubRepos)
        .values(input)
        .returning({
          id: sdlcGithubRepos.id,
          orgId: sdlcGithubRepos.orgId,
          repoUrl: sdlcGithubRepos.repoUrl,
          repoName: sdlcGithubRepos.repoName,
          description: sdlcGithubRepos.description,
          defaultBranch: sdlcGithubRepos.defaultBranch,
          autoPrMerge: sdlcGithubRepos.autoPrMerge,
          isUi: sdlcGithubRepos.isUi,
          runnable: sdlcGithubRepos.runnable,
          playwrightEnabled: sdlcGithubRepos.playwrightEnabled,
        });
      return firstOrThrow(rows, 'Repo');
    },

    async createCredential(input) {
      const rows = await db.insert(sdlcGithubCredentials).values(input).returning({
        id: sdlcGithubCredentials.id,
        gitUserName: sdlcGithubCredentials.gitUserName,
        gitUserEmail: sdlcGithubCredentials.gitUserEmail,
        patSecretRefId: sdlcGithubCredentials.patSecretRefId,
      });
      return firstOrThrow(rows, 'Credential');
    },

    async addRepoFile(input) {
      await db.insert(sdlcRepoFiles).values(input);
    },

    async addRepoEnvVar(input) {
      await db.insert(sdlcRepoEnvVars).values(input);
    },

    async createSetupJob({ repoId, requestedBy }) {
      await db.insert(sdlcRepoSetupJobs).values({
        repoId,
        requestedBy,
        podName: `sdlc-setup-${repoId}`,
        namespace: process.env.SDLC_REQUEST_NAMESPACE ?? 'bia-systems',
        status: 'pending',
      });
    },
  };
}

/** repo 하나를 org 와 함께 찾는다 — Issue·PR 생성 시 자격증명을 고르기 위해 쓴다. */
export async function findRepoWithCredential(repoUrl: string, db = getDb()) {
  const rows = await db
    .select({
      repoId: sdlcGithubRepos.id,
      repoName: sdlcGithubRepos.repoName,
      defaultBranch: sdlcGithubRepos.defaultBranch,
      autoPrMerge: sdlcGithubRepos.autoPrMerge,
      orgName: sdlcGithubOrgs.orgName,
      patSecretRefId: sdlcGithubCredentials.patSecretRefId,
    })
    .from(sdlcGithubRepos)
    .innerJoin(sdlcGithubOrgs, eq(sdlcGithubRepos.orgId, sdlcGithubOrgs.id))
    .leftJoin(
      sdlcGithubCredentials,
      eq(sdlcGithubOrgs.credentialId, sdlcGithubCredentials.id),
    )
    .where(eq(sdlcGithubRepos.repoUrl, repoUrl))
    .limit(1);
  return rows[0] ?? null;
}
