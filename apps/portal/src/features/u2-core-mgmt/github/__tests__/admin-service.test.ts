import { describe, expect, it } from 'vitest';
import { createGithubAdminService } from '../admin-service';
import type { GithubRepository } from '../repository';

function fakeRepository() {
  const orgs: Record<string, unknown>[] = [];
  const repos: Record<string, unknown>[] = [];
  const credentials: Record<string, unknown>[] = [];
  const repoFiles: Record<string, unknown>[] = [];
  const repoEnvVars: Record<string, unknown>[] = [];
  const setupJobs: Record<string, unknown>[] = [];
  let n = 0;

  const repository: GithubRepository & { _state: Record<string, unknown[]> } = {
    _state: { orgs, repos, credentials, repoFiles, repoEnvVars, setupJobs },
    async listOrgs() {
      return orgs as never;
    },
    async createOrg(input) {
      const row = { id: `org-${++n}`, ...input };
      orgs.push(row);
      return row as never;
    },
    async listRepos(orgId) {
      return (orgId ? repos.filter((r) => r.orgId === orgId) : repos) as never;
    },
    async createRepo(input) {
      const row = { id: `repo-${++n}`, ...input };
      repos.push(row);
      return row as never;
    },
    async createCredential(input) {
      const row = { id: `cred-${++n}`, ...input };
      credentials.push(row);
      return row as never;
    },
    async addRepoFile(input) {
      repoFiles.push(input);
    },
    async addRepoEnvVar(input) {
      repoEnvVars.push(input);
    },
    async createSetupJob(input) {
      setupJobs.push(input);
    },
  };
  return repository;
}

function fakeVault() {
  const stored: string[] = [];
  return {
    stored,
    async store(plaintext: string) {
      stored.push(plaintext);
      return `ref-${stored.length}`;
    },
    async reveal(id: string) {
      const index = Number(id.replace('ref-', '')) - 1;
      return stored[index] ?? null;
    },
  };
}

const make = () => {
  const repository = fakeRepository();
  const vault = fakeVault();
  return { repository, vault, service: createGithubAdminService({ repository, vault }) };
};

describe('createCredential (US-U2-05)', () => {
  it('PAT 를 응답에 담지 않는다 — 저장 후 평문을 되돌려주지 않는다 (NFR-10)', async () => {
    const { service } = make();
    const result = await service.createCredential({
      pat: 'ghp_secret_value',
      gitUserName: 'sdlc-runner',
      gitUserEmail: 'sdlc-runner@example.com',
    });
    expect(JSON.stringify(result)).not.toContain('ghp_secret_value');
    expect(result).toEqual({
      id: expect.any(String),
      gitUserName: 'sdlc-runner',
      gitUserEmail: 'sdlc-runner@example.com',
    });
  });

  it('PAT 는 vault 를 거쳐 참조로만 저장된다', async () => {
    const { service, repository, vault } = make();
    await service.createCredential({
      pat: 'ghp_secret_value',
      gitUserName: 'a',
      gitUserEmail: 'a@b.co',
    });
    expect(vault.stored).toEqual(['ghp_secret_value']);
    expect(repository._state.credentials?.[0]).toMatchObject({ patSecretRefId: 'ref-1' });
    expect(JSON.stringify(repository._state.credentials)).not.toContain('ghp_secret_value');
  });

  it('PAT 가 비면 검증 오류다', async () => {
    const { service } = make();
    await expect(
      service.createCredential({ pat: '  ', gitUserName: 'a', gitUserEmail: 'a@b.co' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('이메일 형식이 아니면 검증 오류다', async () => {
    const { service } = make();
    await expect(
      service.createCredential({ pat: 'ghp_x', gitUserName: 'a', gitUserEmail: '아무거나' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});

describe('registerOrg / registerRepo (US-U2-05)', () => {
  it('Org 를 등록한다', async () => {
    const { service } = make();
    const org = await service.registerOrg({
      orgUrl: 'https://github.com/org',
      orgName: 'org',
      credentialId: null,
    });
    expect(org.orgName).toBe('org');
  });

  it('URL 이 아니면 검증 오류다', async () => {
    const { service } = make();
    await expect(
      service.registerOrg({ orgUrl: 'not-a-url', orgName: 'org', credentialId: null }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('repo 의 files·envVars 값은 평문으로 남지 않는다', async () => {
    const { service, repository, vault } = make();
    const org = await service.registerOrg({
      orgUrl: 'https://github.com/org',
      orgName: 'org',
      credentialId: null,
    });
    await service.registerRepo({
      orgId: org.id,
      repoUrl: 'https://github.com/org/portal',
      repoName: 'portal',
      defaultBranch: 'main',
      autoPrMerge: true,
      isUi: false,
      runnable: true,
      description: null,
      files: [{ relativePath: '.env.local', content: 'DB_PASSWORD=hunter2' }],
      envVars: [{ key: 'DATABASE_URL', value: 'postgres://u:p@h/db' }],
    });
    expect(vault.stored).toContain('DB_PASSWORD=hunter2');
    expect(vault.stored).toContain('postgres://u:p@h/db');
    const persisted = JSON.stringify([
      repository._state.repoFiles,
      repository._state.repoEnvVars,
    ]);
    expect(persisted).not.toContain('hunter2');
    expect(persisted).not.toContain('postgres://u:p@h/db');
  });

  it('repo 등록은 셋업 잡을 함께 만든다 (05-portal-api.md §3.5)', async () => {
    const { service, repository } = make();
    const org = await service.registerOrg({
      orgUrl: 'https://github.com/org',
      orgName: 'org',
      credentialId: null,
    });
    await service.registerRepo({
      orgId: org.id,
      repoUrl: 'https://github.com/org/portal',
      repoName: 'portal',
      defaultBranch: 'main',
      autoPrMerge: false,
      isUi: false,
      runnable: false,
      description: null,
      files: [],
      envVars: [],
    });
    expect(repository._state.setupJobs).toHaveLength(1);
  });

  it('목록 조회는 orgId 로 걸러진다', async () => {
    const { service } = make();
    const a = await service.registerOrg({
      orgUrl: 'https://github.com/a',
      orgName: 'a',
      credentialId: null,
    });
    await service.registerRepo({
      orgId: a.id,
      repoUrl: 'https://github.com/a/x',
      repoName: 'x',
      defaultBranch: 'main',
      autoPrMerge: false,
      isUi: false,
      runnable: false,
      description: null,
      files: [],
      envVars: [],
    });
    expect(await service.listRepos(a.id)).toHaveLength(1);
    expect(await service.listRepos('org-없음')).toHaveLength(0);
  });
});
