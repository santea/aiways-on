/** Repo 관리 — US-U2-05 (`08-sr-registration-ui.md` §8.2·§8.3). admin 전용. */
import { Badge } from '@/components/ui/badge';
import { Section } from '@/components/ui/surface';
import { EmptyRow, Table, TableWrap, Td, Th } from '@/components/ui/table';
import { sessionGuards, u2Deps } from '@/features/u2-core-mgmt/deps';
import { CreateRepoDialog } from '@/features/u2-core-mgmt/ui/admin-dialogs';

export const dynamic = 'force-dynamic';

export default async function AdminReposPage() {
  await sessionGuards.requireAdmin();
  const admin = u2Deps().githubAdmin;
  const [orgs, repos] = await Promise.all([admin.listOrgs(), admin.listRepos()]);

  return (
    <div className="flex flex-col gap-6" data-testid="admin-repos-page">
      <h1 className="font-headline text-2xl font-extrabold tracking-tight text-ink">
        관리 · GitHub Repo
      </h1>
      <Section
        title={`Repo ${repos.length}건`}
        action={<CreateRepoDialog orgs={orgs.map((o) => ({ id: o.id, orgName: o.orgName }))} />}
      >
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>Repo</Th>
                <Th>기본 브랜치</Th>
                <Th>설정</Th>
              </tr>
            </thead>
            <tbody>
              {repos.length === 0 ? (
                <EmptyRow colSpan={3}>등록된 Repo 가 없다</EmptyRow>
              ) : (
                repos.map((repo) => (
                  <tr key={repo.id}>
                    <Td className="font-mono-id text-[11.5px] text-ink">{repo.repoName}</Td>
                    <Td className="font-mono-id text-[11.5px]">{repo.defaultBranch}</Td>
                    <Td>
                      <span className="flex flex-wrap gap-1.5">
                        {repo.autoPrMerge ? <Badge tone="warning">자동 머지</Badge> : null}
                        {repo.isUi ? <Badge tone="accent">UI</Badge> : null}
                        {repo.runnable ? <Badge tone="accent">실행 가능</Badge> : null}
                      </span>
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </TableWrap>
      </Section>
    </div>
  );
}
