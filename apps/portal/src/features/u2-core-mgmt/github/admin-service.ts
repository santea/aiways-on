/**
 * 관리 화면 뒤의 도메인 로직 — US-U2-05 (C-2.3 · C-2.4).
 *
 * 이 파일의 존재 이유 하나: **비밀값이 평문으로 남는 경로를 한 곳에서 막는다.**
 * PAT · repo 파일 내용 · env var 값은 전부 vault 를 거쳐 `secret_refs` 참조로만 저장되고,
 * 응답에는 절대 실려 나가지 않는다 (NFR-10, SECURITY-03).
 */
import type { SecretVault } from '@aiways/lib/crypto';
import { validationFailed } from '@aiways/lib/http';
import { z } from 'zod';
import type { GithubRepository, OrgRow, RepoRow } from './repository';

const credentialSchema = z.object({
  pat: z.string().trim().min(1, 'pat 은 필수다'),
  gitUserName: z.string().trim().min(1, 'gitUserName 은 필수다'),
  gitUserEmail: z.email('gitUserEmail 형식이 올바르지 않다'),
});

const orgSchema = z.object({
  orgUrl: z.url('orgUrl 형식이 올바르지 않다'),
  orgName: z.string().trim().min(1, 'orgName 은 필수다'),
  credentialId: z.string().nullable().optional(),
});

const repoSchema = z.object({
  orgId: z.string().min(1, 'orgId 는 필수다'),
  repoUrl: z.url('repoUrl 형식이 올바르지 않다'),
  repoName: z.string().trim().min(1, 'repoName 은 필수다'),
  description: z.string().nullable().optional(),
  defaultBranch: z.string().trim().min(1).default('main'),
  autoPrMerge: z.boolean().default(false),
  isUi: z.boolean().default(false),
  runnable: z.boolean().default(false),
  files: z
    .array(z.object({ relativePath: z.string().min(1), content: z.string() }))
    .default([]),
  envVars: z.array(z.object({ key: z.string().min(1), value: z.string() })).default([]),
});

export type CreateCredentialInput = z.input<typeof credentialSchema>;
export type RegisterOrgInput = z.input<typeof orgSchema>;
export type RegisterRepoInput = z.input<typeof repoSchema>;

/** PAT 를 뺀 자격증명 응답 — `05-portal-api.md` §3.3 */
export interface CredentialView {
  readonly id: string;
  readonly gitUserName: string;
  readonly gitUserEmail: string;
}

export interface GithubAdminServiceDeps {
  readonly repository: GithubRepository;
  readonly vault: SecretVault;
}

/** zod 실패를 §7 표준 오류로 바꾼다 — 라우트마다 따로 만들지 않는다. */
function parseOrThrow<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw validationFailed(
      parsed.error.issues[0]?.message ?? '입력이 올바르지 않다',
      parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    );
  }
  return parsed.data;
}

export function createGithubAdminService({ repository, vault }: GithubAdminServiceDeps) {
  return {
    listOrgs(): Promise<readonly OrgRow[]> {
      return repository.listOrgs();
    },

    listRepos(orgId?: string | null): Promise<readonly RepoRow[]> {
      return repository.listRepos(orgId ?? null);
    },

    async createCredential(input: CreateCredentialInput): Promise<CredentialView> {
      const value = parseOrThrow(credentialSchema, input);
      const patSecretRefId = await vault.store(value.pat, 'github-pat');
      const row = await repository.createCredential({
        patSecretRefId,
        gitUserName: value.gitUserName,
        gitUserEmail: value.gitUserEmail,
      });
      // patSecretRefId 조차 응답에 넣지 않는다 — 화면이 알 필요가 없다.
      return { id: row.id, gitUserName: row.gitUserName, gitUserEmail: row.gitUserEmail };
    },

    async registerOrg(input: RegisterOrgInput): Promise<OrgRow> {
      const value = parseOrThrow(orgSchema, input);
      return repository.createOrg({
        orgUrl: value.orgUrl,
        orgName: value.orgName,
        credentialId: value.credentialId ?? null,
      });
    },

    async registerRepo(
      input: RegisterRepoInput,
      requestedBy: string | null = null,
    ): Promise<RepoRow> {
      const value = parseOrThrow(repoSchema, input);
      const repo = await repository.createRepo({
        orgId: value.orgId,
        repoUrl: value.repoUrl,
        repoName: value.repoName,
        description: value.description ?? null,
        defaultBranch: value.defaultBranch,
        autoPrMerge: value.autoPrMerge,
        isUi: value.isUi,
        runnable: value.runnable,
      });

      for (const file of value.files) {
        const contentSecretRefId = await vault.store(file.content, 'repo-file');
        await repository.addRepoFile({
          repoId: repo.id,
          relativePath: file.relativePath,
          contentSecretRefId,
        });
      }

      for (const envVar of value.envVars) {
        const valueSecretRefId = await vault.store(envVar.value, 'repo-env-var');
        await repository.addRepoEnvVar({
          repoId: repo.id,
          key: envVar.key,
          valueSecretRefId,
        });
      }

      // `05-portal-api.md` §3.5 — repo 등록은 초기 셋업 잡을 함께 만든다.
      await repository.createSetupJob({ repoId: repo.id, requestedBy });
      return repo;
    },
  };
}

export type GithubAdminService = ReturnType<typeof createGithubAdminService>;
